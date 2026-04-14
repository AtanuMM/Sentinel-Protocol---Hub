import { FastifyInstance } from "fastify";
import { AppError } from "../errors/appError";

export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, detail: error.message });
      return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", detail: "Unexpected failure" });
  });
};
