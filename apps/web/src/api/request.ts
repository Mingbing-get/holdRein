import { type WebPlugin } from '@hold-rein/plugin-web'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

export async function request<T>(options: WebPlugin.RequestOptions): Promise<WebPlugin.Result<T>> {
  let url = `${apiBaseUrl.replace(/\/$/, "")}${options.path}`;

  const queryList: string[] = []
  for (const key in options.query) {
    const value = options.query[key]

    if (value === undefined) {
      queryList.push(`${key}=`)
    } else {
      queryList.push(`${key}=${encodeURIComponent(value)}`)
    }
  }

  if (queryList.length > 0) {
    url = `${url}?${queryList.join('&')}`
  }
  
  const response = await fetch(url, {
    body: options.body,
    headers: options.headers,
    method: options.method,
  } as RequestInit);
  
  if (!response.ok) {
    throw new Error("Failed to load directory entries");
  }
  
  return await response.json()
}
