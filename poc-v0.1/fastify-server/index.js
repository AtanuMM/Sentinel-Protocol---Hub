// index.js
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const Minio = require('minio');
const Redis = require('ioredis');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const { Sequelize, DataTypes } = require('sequelize');
const { pipeline } = require('stream/promises'); // For memory-safe streaming
const { Readable } = require('stream');

fastify.register(cors, { origin: '*' });

// --- 1. CLIENT INITIALIZATION ---
// const minioClient = new Minio.Client({
//     endPoint: process.env.MINIO_ENDPOINT || 'localhost',
//     port: 9000,
//     useSSL: false,
//     accessKey: process.env.MINIO_ACCESS_KEY || 'root',
//     secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
// });
//const pgClient = new Client({ connectionString: process.env.DB_URL || 'postgres://postgres:postgres123@localhost:5432/sentinel_mdm' });
// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');
// const kafka = new Kafka({ brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092'] });
// const producer = kafka.producer();

const sequelize = new Sequelize(process.env.DB_URL || 'postgres://postgres:postgres123@localhost:5432/sentinel_mdm', {
    logging: false, // Keep console clean, we have our own logs
});

const IngestionChannel = sequelize.define('IngestionChannel', {
    organisation_id: { type: DataTypes.STRING, primaryKey: true },
    source_prefix: { type: DataTypes.STRING },
    source_bucket: { type: DataTypes.STRING },
    external_username: { type: DataTypes.STRING },
    external_password: { type: DataTypes.TEXT },
    region: { type: DataTypes.STRING },
    // ADD THIS:
    is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false } 
}, { tableName: 'Ingestion_Channel_Master' });
// --- 1. CLIENT CONFIGURATIONS ---

// MinIO
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin', // Updated to standard community root
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

// Postgres
// const pgClient = new Client({ 
//     connectionString: process.env.DB_URL || 'postgres://postgres:postgres123@localhost:5432/sentinel_mdm' 
// });

// Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

// Kafka
const kafka = new Kafka({ 
    clientId: 'sentinel-core',
    brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092'] 
});
const producer = kafka.producer();

// --- START SERVER WITH CONNECTIVITY CHECK ---

// --- HEARTBEAT API ---
fastify.get('/api/ping', async (request, reply) => {
    return { 
        status: 'online', 
        timestamp: new Date().toISOString(),
        node_version: process.version 
    };
});

// --- 2. REACT API: LINK BUCKET ---
fastify.post('/api/link-bucket', async (request, reply) => {
    const { orgId, zone, username, password, bucketName, region } = request.body;
    
    // The base path we want to create immediately
    const prefix = `${orgId}/${zone}/`;
    const rootMarker = `${prefix}.sentinel_root`;

    try {
        // 1. FIRST: Prove the connection and create the root folders in MinIO
        const tpaClient = new Minio.Client({
            endPoint: 'localhost', 
            port: 9000,
            useSSL: false,
            accessKey: username,
            secretKey: password
        });

        // Physically create the /{Org}/{Zone}/ hierarchy
        await tpaClient.putObject(
            bucketName, 
            rootMarker, 
            Buffer.from('HIERARCHY_INITIALIZED'), 
            { 'content-type': 'text/plain' }
        );

        // 2. SECOND: If MinIO succeeds, save the configuration to the DB
        const [record, created] = await IngestionChannel.upsert({
            organisation_id: orgId,
            source_prefix: prefix,
            source_bucket: bucketName,
            external_username: username,
            external_password: password,
            region: region || zone,
            // We set this to TRUE immediately since we just created the folders
            is_onboarded: true 
        });

        fastify.log.info(`Integration Linked & Hierarchy Created for Org: ${orgId}`);

        return { 
            status: 'success', 
            message: `Integration Linked & Folders Created for ${bucketName}.`,
            is_onboarded: true
        };
    } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ 
            error: 'Handshake Failed. Check Credentials or Bucket Name.', 
            detail: err.message 
        });
    }
});

// --- 3. REACT API: INITIALIZE TODAY ---
fastify.post('/api/init-today', async (request, reply) => {
    const { orgId, zone } = request.body;
    const today = new Date().toISOString().split('T')[0];
    
    // Pattern: /{OrgID}/{ZoneID}/{YYYY-MM-DD}/
    const targetFolder = `${orgId}/${zone}/${today}/`;
    const markerFile = `${targetFolder}.sentinel_ready`;

    try {
        // 1. Fetch the Channel and verify Onboarding Status
        const channel = await IngestionChannel.findByPk(orgId);

        if (!channel) {
            return reply.code(404).send({ error: 'Organisation not found. Please link credentials first.' });
        }

        // GUARDRAIL: Ensure the Root Hierarchy exists before allowing date partitions
        if (!channel.is_onboarded) {
            return reply.code(403).send({ 
                error: 'Hierarchy Not Initialized', 
                detail: 'Please run "Initialize Org Hierarchy" before provisioning daily folders.' 
            });
        }

        // 2. Initialize TPA-specific client
        const tpaClient = new Minio.Client({
            endPoint: 'localhost', 
            port: 9000,
            useSSL: false,
            accessKey: channel.external_username,
            secretKey: channel.external_password
        });

        const sourceBucket = channel.source_bucket;
        
        // 3. Physical check: Verify the root marker actually exists in MinIO
        // This ensures the DB state and MinIO state are in sync
        try {
            await tpaClient.statObject(sourceBucket, `${orgId}/${zone}/.sentinel_root`);
        } catch (e) {
            return reply.code(500).send({ 
                error: 'Root Path Missing', 
                detail: 'The parent folder structure was deleted in MinIO. Please re-onboard.' 
            });
        }

        // 4. Drop the Daily Marker
        await tpaClient.putObject(
            sourceBucket, 
            markerFile, 
            Buffer.from(`PROVISIONED_ON_${new Date().toISOString()}`), 
            { 'content-type': 'text/plain' }
        );

        fastify.log.info(`Daily Partition Active: ${sourceBucket}/${targetFolder}`);

        return { 
            status: 'success', 
            message: `Daily partition ${today} is now active.`,
            path: targetFolder 
        };

    } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ 
            error: 'Provisioning Failed', 
            detail: err.message 
        });
    }
});

// --- 7. API: GET LIVE FEED ---
fastify.get('/api/live-feed', async (request, reply) => {
    try {
        // Fetching the last 5 registered channels to show activity
        const activities = await IngestionChannel.findAll({
            limit: 5,
            order: [['updatedAt', 'DESC']]
        });
        return activities;
    } catch (err) {
        return reply.code(500).send({ error: 'Failed to fetch logs' });
    }
});

// --- 4. MINIO WEBHOOK: THE HARVESTER ---
fastify.post('/api/webhook', async (request, reply) => {
    // 1. Initial validation of the MinIO event
    const record = request.body.Records?.[0];
    if (!record) return { status: 'ignored', reason: 'no_records' };

    const sourceBucket = record.s3.bucket.name;
    const sourcePath = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const etag = record.s3.object.eTag;

    // 2. Filter out sentinel/meta files
    if (sourcePath.endsWith('.sentinel_ready') || sourcePath.endsWith('.sentinel_root')) {
        return { status: 'ignored' };
    }

    // 3. Extract path parts: {OrgId}/{ZoneId}/{FolderDate}/{FileName}
    const pathParts = sourcePath.split('/');
    if (pathParts.length < 4) return reply.code(400).send({ error: 'Invalid Path Structure' });

    const [orgId, zoneId, folderDate] = pathParts;
    const today = new Date().toISOString().split('T')[0];

    // 4. Stale Date Check
    if (folderDate !== today) {
        return reply.code(400).send({ error: 'Stale Date Partition' });
    }

    try {
        // 5. REDIS DEDUPLICATION: Check if this file was already processed
        const redisKey = `file:dedup:${etag}`;
        const isDuplicate = await redis.get(redisKey);
        if (isDuplicate) {
            console.log(`[HARVESTER] 🛡️ Duplicate file detected (eTag: ${etag}). Skipping.`);
            return { status: 'ignored', reason: 'duplicate' };
        }

        // 6. DB CHECK: Ensure the TPA is authorized
        const channel = await IngestionChannel.findByPk(orgId);
        if (!channel) return reply.code(403).send({ error: 'Channel Not Registered' });

        // 7. LANDING CONFIG: Define UUID and landing path
        const traceId = uuidv4();
        const landingBucket = 'sentinel-landing-bucket';
        // Requirement: TPA ID -> ZONE -> date -> raw -> traceId.pdf
        const landingPath = `${orgId}/${zoneId}/${today}/raw/${traceId}.pdf`;

        console.log(`[HARVESTER] 📦 Streaming: ${sourcePath} -> ${landingPath}`);

        // 8. THE STREAMING BRIDGE (Source -> Fastify -> Landing)
        // We get the readable stream from the source MinIO
        const dataStream = await minioClient.getObject(sourceBucket, sourcePath);

        // We pipe the dataStream into the putObject sink. 
        // pipeline() ensures that if one stream fails, both are destroyed properly to prevent memory leaks.
        await pipeline(
            dataStream,
            async function* (source) {
                // This wrapper allows minioClient.putObject to consume the stream
                await minioClient.putObject(landingBucket, landingPath, Readable.from(source));
            }
        );

        // 9. CLEANUP: Delete from source only after successful landing
        await minioClient.removeObject(sourceBucket, sourcePath);

        // 10. KAFKA: Notify the next process (The Parser/Validator)
        await producer.send({
            topic: 'claims-ingestion-trace',
            messages: [{ 
                key: orgId,
                value: JSON.stringify({ 
                    traceId, 
                    orgId, 
                    zoneId, 
                    landingPath, 
                    originalPath: sourcePath,
                    timestamp: new Date().toISOString() 
                }) 
            }]
        });

        // 11. REDIS MARK: Set processed with 24hr expiry
        await redis.set(redisKey, 'processed', 'EX', 86400);

        return { status: 'success', traceId, path: landingPath };

    } catch (err) {
        console.error(`[HARVESTER] 💀 Pipeline Crash:`, err);
        return reply.code(500).send({ error: 'Pipeline Crash', message: err.message });
    }
});

// --- START SERVER ---
// const start = async () => {
//     await pgClient.connect();
//     // await producer.connect();
//     await fastify.listen({ port: 3000, host: '0.0.0.0' });
// };
const start = async () => {
    console.log('\n🚀 Starting Sentinel.Protocol (ORM Mode)...');
    console.log('------------------------------------------------');

    try {
        // 1. Database & Migrations
        await sequelize.authenticate();
        console.log('✅ DB CONNECTION: Authenticated');
        
        // This creates/updates tables to match the Model definition above
        await sequelize.sync({ alter: true }); 
        console.log('✅ DB SCHEMA: Synchronized (Migrations Applied)');

        // 2. Redis
        await redis.ping();
        console.log('✅ REDIS: Connected');

        // 3. Kafka
        await producer.connect();
        console.log('✅ KAFKA: Producer Ready');

        // 4. MinIO
        await minioClient.listBuckets();
        console.log('✅ MINIO: Storage Ready');

        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('------------------------------------------------');
        console.log('✨ SYSTEM ONLINE');
        
    } catch (err) {
        console.error('\n❌ STARTUP ERROR:', err.message);
        process.exit(1);
    }
};

start();