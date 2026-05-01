import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';

export const verifyVaultToken = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers['x-vault-token'] as string;

  if (!token) {
    return reply.status(401).send({ error: 'Missing X-Vault-Token header' });
  }

  // Hash the incoming raw token to match what's in the DB
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  // Find the User who owns this Master API Key
  const user = await prisma.user.findUnique({
    where: { apiKeyHash: hash } as any
  });

  if (!user) {
    return reply.status(401).send({ error: 'Invalid or unauthorized API Key' });
  }

  // Attach the user object to the request so routes know who is calling
  (request as any).user = user;
};