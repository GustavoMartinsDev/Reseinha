import { useState, type FormEvent } from 'react'
import type { User } from '@telacast/shared'
import { Cast } from 'lucide-react'
import { api } from '../lib/api'

export default function Auth({ onDone }: { onDone: (token: string, user: User) => void }) {
  const [register, setRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = register
        ? await api.register({ username: username.trim(), password, invite: invite.trim() })
        : await api.login({ username: username.trim(), password })
      onDone(r.token, r.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-surface border border-line p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
            <Cast size={22} strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-medium">{register ? 'Criar conta' : 'Entrar'}</h1>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Usuário" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="input" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {register && (
            <input className="input" placeholder="Código de convite" value={invite} onChange={(e) => setInvite(e.target.value)} />
          )}
        </div>
        {error && <p className="text-sm text-danger text-center">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !username || !password || (register && !invite)}>
          {busy ? '...' : register ? 'Criar conta' : 'Entrar'}
        </button>
        <button
          type="button"
          className="w-full text-sm text-mute hover:text-fg transition"
          onClick={() => { setRegister(!register); setError('') }}
        >
          {register ? 'Já tenho conta' : 'Criar uma conta'}
        </button>
      </form>
    </div>
  )
}
