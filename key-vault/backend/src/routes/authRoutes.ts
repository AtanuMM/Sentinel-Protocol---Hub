import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';

export async function authRoutes(fastify: FastifyInstance) {
  
  fastify.post('/auth/provision', async (request, reply) => {
    const { keycloakId, email } = request.body as any;

    if (!keycloakId || !email) {
      return reply.status(400).send({ error: 'Missing keycloakId or email' });
    }

    // 1. Generate a Raw API Key (Only shown once to the user)
    const rawKey = `sv_live_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // 2. Upsert the User (Link Keycloak ID to internal UUID)
    const user = await prisma.user.upsert({
      where: { keycloakId } as any,
      update: { apiKeyHash: hash } as any, // Regenerates key if user exists
      create: {
        keycloakId,
        email,
        apiKeyHash: hash
      }
    });

    return { 
      message: 'User provisioned successfully',
      apiKey: rawKey, // CLIENT MUST STORE THIS SECURELY
      userId: user.id 
    };
  });
}