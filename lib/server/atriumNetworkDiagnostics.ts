import { AsyncLocalStorage } from 'node:async_hooks'
import { channel } from 'node:diagnostics_channel'
import type { Socket } from 'node:net'

interface RequestTimeline {
  startedAt: number
  dnsMs?: number
  connectMs?: number
  tlsMs?: number
  sentHeadersMs?: number
}

const timelines = new AsyncLocalStorage<RequestTimeline>()
const requests = new WeakMap<object, RequestTimeline>()

// 仅观察 Node/Undici 公开诊断事件，不改变 DNS、连接、请求或 TLS 校验。
channel('net.client.socket').subscribe((message) => {
  const timeline = timelines.getStore()
  if (!timeline) return
  const socket = (message as { socket?: Socket })?.socket
  if (!socket?.once) return
  socket.once('lookup', () => { timeline.dnsMs = Date.now() - timeline.startedAt })
  socket.once('connect', () => { timeline.connectMs = Date.now() - timeline.startedAt })
  socket.once('secureConnect', () => { timeline.tlsMs = Date.now() - timeline.startedAt })
})

channel('undici:request:create').subscribe((message) => {
  const timeline = timelines.getStore()
  const request = (message as { request?: object })?.request
  if (timeline && request && typeof request === 'object') requests.set(request, timeline)
})

channel('undici:client:sendHeaders').subscribe((message) => {
  const request = (message as { request?: object })?.request
  if (!request || typeof request !== 'object') return
  const timeline = requests.get(request)
  if (timeline) timeline.sentHeadersMs = Date.now() - timeline.startedAt
})

export function traceAtriumRequest<T>(timeline: RequestTimeline, request: () => T): T {
  return timelines.run(timeline, request)
}
