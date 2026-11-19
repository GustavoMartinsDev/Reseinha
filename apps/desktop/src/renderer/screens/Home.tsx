import { useState, type FormEvent } from 'react'
import type { ChannelState, User } from '@telacast/shared'
import { CODE_LENGTH } from '@telacast/shared'
import { LogOut, Plus, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'

export default function Home({
  user, onChannel, onLogout
}: { user: User; onChannel: (c: ChannelState) => void; onLogout: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<ChannelState>) => {
    setError('')
    setBusy(true)
    try {
      onChannel(await fn())
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const join = (e: FormEvent) => {
    e.preventDefault()
    run(() => api.joinChannel(code.trim().toUpperCase()))
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-end gap-2 p-5 text-sm text-mute">
        <span>{user.username}</span>
        <button onClick={onLogout} title="Sair" className="p-2 rounded-lg hover:text-fg hover:bg-raised transition">
          <LogOut size={16} strokeWidth={1.5} />
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-5">
          <button
            disabled={busy}
            onClick={() => run(api.createChannel)}
            className="rounded-3xl bg-surface border border-line hover:border-accent transition p-8 h-56 flex flex-col items-center justify-center gap-4 disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              <Plus size={22} strokeWidth={1.5} />
            </div>
            <span className="text-base font-medium">Criar canal</span>
          </button>
          <form onSubmit={join} className="rounded-3xl bg-surface border border-line p-8 h-56 flex flex-col items-center justify-center gap-4">
            <span className="text-base font-medium">Entrar com código</span>
            <div className="relative w-full">
              <input
                className="input text-center tracking-[0.3em] uppercase pr-12"
                placeholder="CÓDIGO"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                disabled={busy || code.trim().length < CODE_LENGTH}
                className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square rounded-lg bg-accent text-white flex items-center justify-center disabled:opacity-30 hover:bg-accent-hover transition"
              >
                <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </form>
        </div>
      </main>
      <div className="h-12 text-center text-sm text-danger">{error}</div>
    </div>
  )
}
