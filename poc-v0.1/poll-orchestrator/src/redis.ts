import Redis from 'ioredis'
import { config } from './config'

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (redisClient) return redisClient
  redisClient = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  })
  redisClient.on('error', (err) => {
    console.error('[redis] Connection error:', err)
  })
  return redisClient
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient()
  await client.ping()
  console.log('[redis] Connected')
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
