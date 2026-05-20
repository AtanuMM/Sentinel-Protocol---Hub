import { FastifyInstance } from "fastify";
import { AppError } from "../errors/appError";

export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const ctx = { statusCode: error.statusCode, code: error.code, detail: error.message };
      if (error.statusCode >= 500) {
        request.log.error(ctx, "AppError");
      } else {
        request.log.warn(ctx, "AppError");
      }
      reply.code(error.statusCode).send({ error: error.code, detail: error.message });
      return;
    }

    request.log.error({ err: error }, "Unhandled error");
    reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", detail: "Unexpected failure" });
  });
};
