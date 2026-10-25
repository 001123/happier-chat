import { DurableStreamTestServer } from '@durable-streams/server'

const port = Number(process.env.DURABLE_STREAMS_PORT || 4437)
const server = new DurableStreamTestServer({
  port,
  host: '127.0.0.1',
  dataDir: process.env.DURABLE_STREAMS_DATA_DIR || '.data/streams',
})

await server.start()
console.log(`Durable Streams: ${server.url}`)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => void server.stop().then(() => process.exit(0)))
}
