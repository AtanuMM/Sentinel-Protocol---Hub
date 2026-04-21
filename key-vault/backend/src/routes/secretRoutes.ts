import { FastifyInstance } from 'fastify';
import { SecretService } from '../services/SecretService.js';

export async function secretRoutes(fastify: FastifyInstance) {
  
  // POST: Store a secret
  fastify.post('/secrets', async (request, reply) => {
    const { serviceId, keyName, value } = request.body as any;

    if (!serviceId || !keyName || !value) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // If value is an object, stringify it so we can encrypt it
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    await SecretService.storeSecret(serviceId, keyName, stringValue);
    
    return reply.status(201).send({ message: `Secret '${keyName}' stored successfully.` });
  });

  // GET: Retrieve a secret
  fastify.get('/secrets/:serviceId/:keyName', async (request, reply) => {
    const { serviceId, keyName } = request.params as any;

    const decryptedValue = await SecretService.getSecret(serviceId, keyName);

    if (!decryptedValue) {
      return reply.status(404).send({ error: 'Secret not found' });
    }

    // Try to parse back to JSON if it looks like JSON
    try {
      return { keyName, value: JSON.parse(decryptedValue) };
    } catch {
      return { keyName, value: decryptedValue };
    }
  });
}