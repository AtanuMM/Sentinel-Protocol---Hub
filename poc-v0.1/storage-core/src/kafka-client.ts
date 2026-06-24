import { Kafka, Producer } from 'kafkajs'
import type { KafkaEventPayload } from './types'

const INGESTION_EVENTS_TOPIC = 'ingestion-events'

let producer: Producer | null = null

async function getProducer(): Promise<Producer> {
  if (producer) return producer

  const brokerList = process.env.KAFKA_BROKER?.trim()
  if (!brokerList) throw new Error('KAFKA_BROKER is not set.')

  const brokers = brokerList.split(',').map(b => b.trim()).filter(Boolean)
  if (brokers.length === 0) throw new Error('KAFKA_BROKER has no valid addresses.')

  const kafka = new Kafka({ clientId: 'sentinel-storage-core', brokers })
  producer = kafka.producer()
  await producer.connect()
  return producer
}

export async function publishEvent(payload: KafkaEventPayload): Promise<void> {
  const p = await getProducer()
  await p.send({
    topic: INGESTION_EVENTS_TOPIC,
    messages: [{ key: payload.orgId, value: JSON.stringify(payload) }]
  })
}
