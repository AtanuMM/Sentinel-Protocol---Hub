import { Consumer, Kafka, Producer } from 'kafkajs'
import { config } from './config'

export interface PollJobMessage {
  credId: string
  orgId: string
  zoneId: string
  kmsServiceId: string
  vaultToken: string
  channelType: 'FTP' | 'EMAIL' | 'WHATSAPP'
  scheduledAt: string
  // EMAIL only — needed because Email_Source_Master is keyed by email_address, not kms_service_id
  emailAddress?: string
}

const REQUIRED_TOPICS = [
  { topic: 'poll-jobs', numPartitions: 3, replicationFactor: 1 },
  { topic: 'ingestion-events', numPartitions: 3, replicationFactor: 1 },
]

let kafkaInstance: Kafka | null = null
let producer: Producer | null = null
const consumers = new Map<string, Consumer>()

function getKafkaInstance(): Kafka {
  if (kafkaInstance) return kafkaInstance
  const brokers = config.kafkaBroker
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)
  kafkaInstance = new Kafka({
    clientId: 'sentinel-poll-orchestrator',
    brokers,
    retry: {
      initialRetryTime: 300,
      retries: 10,
    },
  })
  return kafkaInstance
}

export async function provisionTopics(): Promise<void> {
  const kafka = getKafkaInstance()
  const admin = kafka.admin()
  await admin.connect()
  try {
    const existing = await admin.listTopics()
    const toCreate = REQUIRED_TOPICS.filter((t) => !existing.includes(t.topic))
    if (toCreate.length === 0) {
      console.log('[kafka] All required topics already exist')
      return
    }
    await admin.createTopics({ topics: toCreate })
    console.log(`[kafka] Created topics: ${toCreate.map((t) => t.topic).join(', ')}`)
  } finally {
    await admin.disconnect()
  }
}

export async function getProducer(): Promise<Producer> {
  if (producer) {
    return producer
  }
  producer = getKafkaInstance().producer()
  await producer.connect()
  return producer
}

export async function getConsumer(groupId: string): Promise<Consumer> {
  const existing = consumers.get(groupId)
  if (existing) {
    return existing
  }
  const consumer = getKafkaInstance().consumer({ groupId })
  await consumer.connect()
  consumers.set(groupId, consumer)
  return consumer
}

export async function publishPollJob(payload: PollJobMessage): Promise<void> {
  const p = await getProducer()
  await p.send({
    topic: config.pollJobsTopic,
    messages: [
      {
        key: payload.credId,
        value: JSON.stringify(payload),
      },
    ],
  })
}
