import 'dotenv/config'
import { sequelize } from './db'
import { provisionTopics } from './kafka'
import { startScheduler, stopScheduler } from './scheduler/cron'
import { startWorkerPool, stopWorkerPool } from './workers/pool'

async function main() {
  await provisionTopics()
  console.log('[orchestrator] Kafka topics provisioned')

  await sequelize.authenticate()
  console.log('[orchestrator] DB connected')

  await startWorkerPool()
  console.log('[orchestrator] Worker pool started')

  startScheduler()
  console.log('[orchestrator] Scheduler started')

  const shutdown = async () => {
    console.log('[orchestrator] Shutting down...')
    stopScheduler()
    await stopWorkerPool()
    await sequelize.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[orchestrator] Fatal startup error:', err)
  process.exit(1)
})
