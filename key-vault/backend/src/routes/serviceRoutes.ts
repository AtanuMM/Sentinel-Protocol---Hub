import { FastifyInstance } from 'fastify';
import { verifyVaultToken } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

export async function serviceRoutes(fastify: FastifyInstance) {
  
  // Protect all service management routes
  fastify.addHook('preHandler', verifyVaultToken);

  /**
   * POST /services
   * Creates a new 'Channel' or 'Project' (e.g., "Email-Channel")
   */
  fastify.post('/services', async (request: any, reply) => {
    const { name, description } = request.body;
    const user = request.user; // Injected by verifyVaultToken

    if (!name) {
      return reply.status(400).send({ error: 'Service name is required' });
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        ownerId: user.id // Links to the internal UUID of the Keycloak user
      }
    });

    return reply.status(201).send(service);
  });

  /**
   * GET /services
   * Lists all projects/channels belonging to the authenticated user
   */
  fastify.get('/services', async (request: any, reply) => {
    const user = request.user;

    const services = await prisma.service.findMany({
      where: { ownerId: user.id },
      include: {
        _count: {
          select: { secrets: true } // Shows how many secrets are in each channel
        }
      }
    });

    return services;
  });
}