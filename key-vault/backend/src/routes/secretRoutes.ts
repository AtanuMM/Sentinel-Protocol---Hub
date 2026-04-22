import { FastifyInstance } from 'fastify';
import { SecretService } from '../services/SecretService.js';
import { verifyVaultToken } from '../middleware/auth.js'; // Import the guard
import prisma from '../lib/prisma.js'; // Import prisma to fix the error

export async function secretRoutes(fastify: FastifyInstance) {
  
  // Apply the guard to all routes in this file
  fastify.addHook('preHandler', verifyVaultToken);

  // POST: Store a secret
  fastify.post('/secrets', async (request: any, reply) => {
    const { serviceId, keyName, value } = request.body;
    const user = request.user; 

    if (!serviceId || !keyName || !value) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Security Check: Ensure user owns the service
    const service = await prisma.service.findFirst({
      where: { id: serviceId, ownerId: user.id }
    });

    if (!service) {
      return reply.status(403).send({ error: 'Unauthorized: Service not found or access denied.' });
    }

    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await SecretService.storeSecret(serviceId, keyName, stringValue);
    
    return reply.status(201).send({ message: `Secret '${keyName}' stored successfully.` });
  });

  // GET: Retrieve a secret
  fastify.get('/secrets/:serviceId/:keyName', async (request: any, reply) => {
    const { serviceId, keyName } = request.params;
    const user = request.user; 
  
    // 1. SECURITY CHECK: Does this service belong to the user?
    const service = await prisma.service.findFirst({
      where: { id: serviceId, ownerId: user.id }
    });
  
    if (!service) {
      return reply.status(403).send({ error: 'Access Denied: Unauthorized service access' });
    }
  
    // 2. Fetch and Decrypt the value
    const decryptedValue = await SecretService.getSecret(serviceId, keyName);
  
    if (!decryptedValue) {
      return reply.status(404).send({ error: 'Secret not found' });
    }
  
    // 3. Return the result
    try {
      return { keyName, value: JSON.parse(decryptedValue) };
    } catch {
      return { keyName, value: decryptedValue };
    }
  });
  // --- NEW: List All Secrets for a Service ---
  fastify.get('/secrets/:serviceId', async (request: any, reply) => {
    const { serviceId } = request.params;
    const user = request.user;

    // 1. Authorization: Verify ownership
    const service = await prisma.service.findFirst({
      where: { id: serviceId, ownerId: user.id }
    });

    if (!service) {
      return reply.status(403).send({ error: 'Access Denied: Service not found or unauthorized' });
    }

    // 2. Fetch and Batch Decrypt
    const allSecrets = await SecretService.getAllSecrets(serviceId);
    
    return allSecrets;
  });
}