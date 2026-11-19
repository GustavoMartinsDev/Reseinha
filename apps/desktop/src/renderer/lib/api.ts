import type {
  AuthResponse, ApiError, ChannelState, LoginRequest, Member, RegisterRequest, User
} from '@telacast/shared'

export const API_URL: string = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
const KEY = 'telacast.token'
const USER_KEY = 'telacast.user'

export const getToken = (): string | null => localStorage.getItem(KEY)
export const setToken = (t: string | null): void => {
  if (t) localStorage.setItem(KEY, t)
  else localStorage.removeItem(KEY)
}
export const getSavedUser = (): User | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as User | null } catch { return null }
}
export const saveUser = (u: User | null): void => {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as ApiError).error || `Erro ${res.status}`)
  return data as T
}

export const api = {
  register: (b: RegisterRequest) => post<AuthResponse>('/api/register', b),
  login: (b: LoginRequest) => post<AuthResponse>('/api/login', b),
  createChannel: () => post<ChannelState>('/api/channel-create', {}),
  joinChannel: (code: string) => post<ChannelState>('/api/channel-join', { code }),
  leaveChannel: (code: string) => post<{ ok: true }>('/api/channel-leave', { code }),
  presence: (code: string) => post<{ members: Member[] }>('/api/presence', { code })
}
