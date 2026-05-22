import type Redis from "ioredis";

/** SCAN + DEL for keys matching a Redis glob (used for bounded prefix clears, e.g. dedup on resetCursor). */
export async function deleteRedisKeysByPattern(redis: Redis, match: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", match, "COUNT", 200);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");
  return deleted;
}
