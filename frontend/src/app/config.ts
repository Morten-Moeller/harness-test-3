export type AppConfig = {
  apiBaseUrl: string
}

export async function loadConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
  const response = await fetchFn('/config.json', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`config.json answered ${response.status}`)
  }
  const data: unknown = await response.json()
  if (typeof data !== 'object' || data === null) {
    throw new Error('config.json is not an object')
  }
  const apiBaseUrl = (data as Record<string, unknown>).apiBaseUrl
  if (typeof apiBaseUrl !== 'string') {
    throw new Error('config.json: apiBaseUrl is missing')
  }
  return { apiBaseUrl }
}
