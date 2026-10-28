type Handler = (req: { url: URL; method: string; body: unknown }) => { status?: number; json?: unknown; headers?: Record<string, string> }

const page = (items: unknown[] = []) => ({ items, page: 0, size: 20, totalItems: items.length, totalPages: 1 })
export const pageOf = page

/** Replaces `fetch` with a router keyed by "METHOD /path"; unmatched calls answer an empty page. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown; url: URL }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const req = input as Request
    const url = new URL(req.url, 'http://localhost')
    const body = req.method === 'GET' ? undefined : await req.clone().json().catch(() => undefined)
    const key = `${req.method} ${url.pathname}`
    calls.push({ key, body, url })
    const out = routes[key]?.({ url, method: req.method, body }) ?? { json: page() }
    const status = out.status ?? 200
    const noBody = status === 204 || status === 205
    return new Response(noBody ? null : JSON.stringify(out.json ?? null), { status, headers: noBody ? undefined : { 'Content-Type': 'application/json', ...out.headers } })
  })
  return calls
}
