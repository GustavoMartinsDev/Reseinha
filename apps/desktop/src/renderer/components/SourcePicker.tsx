import { useEffect, useState } from 'react'
import { Monitor, AppWindow, X } from 'lucide-react'

export default function SourcePicker({
  onPick, onClose
}: { onPick: (id: string, withAudio: boolean) => void; onClose: () => void }) {
  const [sources, setSources] = useState<CaptureSource[] | null>(null)
  const [audio, setAudio] = useState(true)
  const [tab, setTab] = useState<'screen' | 'window'>('screen')

  useEffect(() => {
    window.capture.listSources().then(setSources).catch(() => setSources([]))
  }, [])

  const list = (sources ?? []).filter((s) => s.kind === tab)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-full flex flex-col rounded-3xl bg-surface border border-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex gap-1 bg-raised rounded-xl p-1 text-sm">
            {([['screen', 'Telas', Monitor], ['window', 'Janelas', AppWindow]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition ${tab === k ? 'bg-accent text-white' : 'text-mute hover:text-fg'}`}
              >
                <Icon size={14} strokeWidth={1.5} /> {label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-mute hover:text-fg hover:bg-raised transition">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sources === null && <p className="col-span-full text-center text-mute text-sm py-10">Carregando...</p>}
          {sources && list.length === 0 && <p className="col-span-full text-center text-mute text-sm py-10">Nada encontrado</p>}
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id, audio)}
              className="text-left rounded-2xl border border-line hover:border-accent transition p-2 bg-raised"
            >
              <div className="aspect-video rounded-xl bg-black overflow-hidden">
                <img src={s.thumbnail} alt="" className="w-full h-full object-contain" />
              </div>
              <p className="mt-2 px-1 text-xs text-mute truncate">{s.name}</p>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-4 px-6 py-4 border-t border-line text-sm cursor-pointer select-none">
          <span>Incluir áudio</span>
          <span
            role="switch"
            aria-checked={audio}
            onClick={() => setAudio(!audio)}
            className={`w-10 h-6 rounded-full p-0.5 transition ${audio ? 'bg-accent' : 'bg-line'}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${audio ? 'translate-x-4' : ''}`} />
          </span>
        </label>
      </div>
    </div>
  )
}
