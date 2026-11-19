/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}
interface CaptureSource {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnail: string
}
interface Window {
  capture: {
    listSources(): Promise<CaptureSource[]>
    select(id: string, withAudio: boolean): Promise<void>
  }
}
