import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChannelState, Member, User } from '@telacast/shared'
import {
  Copy, Check, Mic, MicOff, Headphones, HeadphoneOff, MonitorUp, MonitorOff, DoorOpen, Cast, Settings
} from 'lucide-react'
import { API_URL, api, getToken } from '../lib/api'
import { createRoomClient, type RoomClient } from '../rtc'
import SourcePicker from '../components/SourcePicker'

// Métodos de voz que o agente de rtc está adicionando; opcionais até existirem.
type VoiceClient = RoomClient & {
  onSpeaking?: (userId: string, speaking: boolean) => void
  setDeafen?: (on: boolean) => void
  setVolume?: (userId: string, v: number) => void
  listMics?: () => Promise<{ id: string; label: string }[]>
  setMicDevice?: (id: string) => Promise<void>
}

function RemoteAudio({ stream, volume, deaf }: { stream: MediaStream; volume: number; deaf: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [volume])
  return <audio ref={ref} autoPlay muted={deaf} />
}

function Video({ stream, name }: { stream: MediaStream; name: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return (
    <div className="relative flex-1 min-w-0 h-full rounded-2xl bg-black overflow-hidden border border-line">
      <video ref={ref} autoPlay playsInline muted className="w-full h-full object-contain" />
      <span className="absolute left-3 top-3 text-xs px-3 py-1 rounded-full bg-black/60 backdrop-blur">{name}</span>
    </div>
  )
}

function Avatar({
  m, speaking, muted, small, volume, onVolume, isMe
}: {
  m: Member; speaking: boolean; muted: boolean; small: boolean; volume: number
  onVolume: (v: number) => void; isMe: boolean
}) {
  const [open, setOpen] = useState(false)
  const size = small ? 'w-10 h-10 text-sm' : 'w-24 h-24 text-3xl'
  return (
    <div
      className="relative flex flex-col items-center gap-2 group"
      onContextMenu={(e) => { e.preventDefault(); if (!isMe) setOpen(!open) }}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={`${size} rounded-full bg-raised flex items-center justify-center font-medium uppercase transition-shadow relative ${speaking ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'ring-1 ring-line'}`}
      >
        {m.username[0]}
        {muted && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface border border-line flex items-center justify-center text-mute">
            <MicOff size={11} strokeWidth={1.5} />
          </span>
        )}
      </div>
      <span className="text-xs text-mute max-w-[7rem] truncate">{m.username}</span>
      {!isMe && (
        <div
          className={`absolute top-full z-20 mt-1 w-32 p-3 rounded-xl bg-surface border border-line ${open ? 'block' : 'hidden group-hover:block'}`}
        >
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="w-full accent-[#8b5cf6]"
          />
        </div>
      )}
    </div>
  )
}

export default function Room({ me, channel, onLeave }: { me: User; channel: ChannelState; onLeave: () => void }) {
  const [members, setMembers] = useState<Member[]>(channel.members)
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [remotes, setRemotes] = useState<Record<string, MediaStream>>({})
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({})
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  // Como no Discord: lembra se você estava mudo; padrão é microfone ligado.
  const [mic, setMic] = useState(() => {
    try { return localStorage.getItem('telacast.mic') !== '0' } catch { return true }
  })
  const [deaf, setDeaf] = useState(false)
  const [picker, setPicker] = useState(false)
  const [settings, setSettings] = useState(false)
  const [mics, setMics] = useState<{ id: string; label: string }[]>([])
  const [micId, setMicId] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [barVisible, setBarVisible] = useState(true)
  const client = useRef<VoiceClient | null>(null)
  const hideTimer = useRef<number>()

  useEffect(() => {
    const c: VoiceClient = createRoomClient({
      apiUrl: API_URL, token: getToken() ?? '', me, code: channel.code, iceServers: channel.iceServers
    })
    client.current = c
    c.onMembers = setMembers
    c.onLocalStream = setLocal
    c.onRemoteStream = (id, s) =>
      setRemotes((r) => {
        const n = { ...r }
        if (s) n[id] = s
        else delete n[id]
        return n
      })
    c.onSpeaking = (id, s) => setSpeaking((p) => ({ ...p, [id]: s }))
    c.onError = setError
    // mic ligado ao entrar
    c.connect().then(() => c.setMic(mic)).catch((e) => setError((e as Error).message))
    return () => {
      c.leave().catch(() => {})
    }
  }, [])

  const videoTiles = [
    ...(local && local.getVideoTracks().length ? [{ key: 'me', stream: local, name: me.username }] : []),
    ...Object.entries(remotes)
      .filter(([, s]) => s.getVideoTracks().length)
      .map(([id, stream]) => ({ key: id, stream, name: members.find((m) => m.userId === id)?.username ?? 'Alguém' }))
  ].slice(0, 2)
  const hasVideo = videoTiles.length > 0
  const sharing = !!local && local.getVideoTracks().length > 0

  const poke = useCallback(() => {
    setBarVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setBarVisible(false), 3000)
  }, [])
  useEffect(() => {
    poke()
    return () => window.clearTimeout(hideTimer.current)
  }, [poke])
  const showBar = !hasVideo || barVisible || picker || settings

  const copy = () => {
    navigator.clipboard.writeText(channel.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const leave = async () => {
    await client.current?.leave().catch(() => {})
    client.current = null
    api.leaveChannel(channel.code).catch(() => {})
    onLeave()
  }

  const pick = async (id: string, withAudio: boolean) => {
    setPicker(false)
    try {
      await window.capture.select(id, withAudio)
      await client.current?.startShare(id, withAudio)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggleMic = async () => {
    const next = !mic
    try {
      await client.current?.setMic(next)
      setMic(next)
      try { localStorage.setItem('telacast.mic', next ? '1' : '0') } catch { /* ignore */ }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggleDeaf = async () => {
    const next = !deaf
    setDeaf(next)
    client.current?.setDeafen?.(next)
    // ensurdecer muta você; ao voltar, restaura o mic
    try {
      await client.current?.setMic(next ? false : true)
      setMic(!next)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const openSettings = async () => {
    setSettings(!settings)
    if (!settings && client.current?.listMics) setMics(await client.current.listMics().catch(() => []))
  }

  const setVol = (id: string, v: number) => {
    setVolumes((p) => ({ ...p, [id]: v }))
    client.current?.setVolume?.(id, v)
  }

  const list = (
    <div className={hasVideo ? 'flex items-center justify-center gap-5 py-3' : 'flex flex-wrap items-center justify-center gap-10'}>
      {members.map((m) => (
        <Avatar
          key={m.userId} m={m} small={hasVideo} isMe={m.userId === me.id}
          speaking={!!speaking[m.userId] && !(m.userId === me.id && !mic)}
          muted={m.userId === me.id && (!mic || deaf)}
          volume={volumes[m.userId] ?? 1} onVolume={(v) => setVol(m.userId, v)}
        />
      ))}
    </div>
  )

  const bar = 'p-3 rounded-xl transition hover:bg-raised'
  return (
    <div className="h-full flex flex-col relative" onMouseMove={poke}>
      <header className="flex items-center justify-between px-6 py-4">
        <button onClick={copy} title="Copiar código" className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-surface border border-line hover:border-accent transition">
          <span className="tracking-[0.25em] font-medium">{channel.code}</span>
          {copied ? <Check size={14} strokeWidth={1.5} className="text-ok" /> : <Copy size={14} strokeWidth={1.5} className="text-mute" />}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-mute">
          <span className="w-1.5 h-1.5 rounded-full bg-ok" />
          {members.length} presente{members.length === 1 ? '' : 's'}
        </span>
      </header>

      {Object.entries(remotes).map(([id, s]) => (
        <RemoteAudio key={id} stream={s} volume={volumes[id] ?? 1} deaf={deaf} />
      ))}

      <main className="flex-1 min-h-0 px-6 pb-24 flex flex-col">
        {hasVideo ? (
          <>
            <div className="flex gap-4 flex-1 min-h-0">
              {videoTiles.map((t) => <Video key={t.key} stream={t.stream} name={t.name} />)}
            </div>
            {list}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">{list}</div>
        )}
      </main>

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-xl bg-surface border border-line text-danger cursor-pointer" onClick={() => setError('')}>
          {error}
        </div>
      )}

      {settings && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-72 p-4 rounded-2xl bg-surface border border-line space-y-2">
          <p className="text-xs text-mute">Microfone</p>
          <select
            className="input"
            value={micId}
            onChange={(e) => { setMicId(e.target.value); client.current?.setMicDevice?.(e.target.value).catch((x) => setError((x as Error).message)) }}
          >
            <option value="">Padrão</option>
            {mics.map((d) => <option key={d.id} value={d.id}>{d.label || d.id}</option>)}
          </select>
        </div>
      )}

      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-2 rounded-2xl bg-surface/90 backdrop-blur border border-line transition-opacity duration-300 ${showBar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <button className={`${bar} ${mic ? 'text-fg' : 'text-danger'}`} title={mic ? 'Silenciar microfone' : 'Ativar microfone'} onClick={toggleMic}>
          {mic ? <Mic size={18} strokeWidth={1.5} /> : <MicOff size={18} strokeWidth={1.5} />}
        </button>
        <button className={`${bar} ${deaf ? 'text-danger' : 'text-fg'}`} title={deaf ? 'Ouvir' : 'Ensurdecer'} onClick={toggleDeaf}>
          {deaf ? <HeadphoneOff size={18} strokeWidth={1.5} /> : <Headphones size={18} strokeWidth={1.5} />}
        </button>
        {sharing ? (
          <button className={`${bar} text-danger`} title="Parar transmissão" onClick={() => client.current?.stopShare()}>
            <MonitorOff size={18} strokeWidth={1.5} />
          </button>
        ) : (
          <button className={`${bar} text-accent`} title="Transmitir" onClick={() => setPicker(true)}>
            <MonitorUp size={18} strokeWidth={1.5} />
          </button>
        )}
        <button className={`${bar} text-mute`} title="Áudio" onClick={openSettings}>
          <Settings size={18} strokeWidth={1.5} />
        </button>
        <span className="w-px h-6 bg-line mx-1" />
        <button className={`${bar} text-mute`} title="Sair" onClick={leave}>
          <DoorOpen size={18} strokeWidth={1.5} />
        </button>
      </div>

      {picker && <SourcePicker onPick={pick} onClose={() => setPicker(false)} />}
    </div>
  )
}
