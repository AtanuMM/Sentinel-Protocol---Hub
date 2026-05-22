import { createRequire } from "node:module";
import { join } from "node:path";
import type { FastifyServerOptions } from "fastify";

type FastifyLoggerConfig = NonNullable<FastifyServerOptions["logger"]>;

/** Resolve optional deps from package root (stable under Vitest / tsx). */
const nodeRequire = createRequire(join(process.cwd(), "package.json"));

function isPinoPrettyInstalled(): boolean {
  try {
    nodeRequire.resolve("pino-pretty");
    return true;
  } catch {
    return false;
  }
}

/**
 * Pretty logs whenever `NODE_ENV` is not `production` (e.g. local `npm run dev`, tests), unless `LOG_PRETTY=false`.
 * pino-pretty colorizes by level (e.g. error = red, warn = yellow).
 *
 * Set `LOG_PRETTY=false` to force JSON locally; `LOG_PRETTY=true` to force pretty in production.
 */
export function getFastifyLoggerOptions(): FastifyLoggerConfig {
  const level = process.env.LOG_LEVEL ?? "info";

  const prettyOff = process.env.LOG_PRETTY === "false";
  const prettyOn = process.env.LOG_PRETTY === "true";
  const usePretty =
    !prettyOff && (prettyOn || process.env.NODE_ENV !== "production") && isPinoPrettyInstalled();

  if (!usePretty) {
    return { level };
  }

  return {
    level,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: false,
        errorLikeObjectKeys: ["err", "error"],
      },
    },
  };
}
