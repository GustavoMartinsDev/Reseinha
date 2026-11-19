const THRESHOLD = 0.02; // RMS (0..1)
const HOLD_MS = 200; // histerese: só "para de falar" após 200ms abaixo do limiar

let ctx: AudioContext | null = null;

/** Detecta fala num stream de áudio. Retorna função para parar. */
export function watchSpeaking(stream: MediaStream, cb: (speaking: boolean) => void): () => void {
  if (!stream.getAudioTracks().length) return () => {};
  ctx ??= new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  const buf = new Uint8Array(an.fftSize);
  let speaking = false;
  let lastLoud = 0;
  const timer = setInterval(() => {
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    const now = performance.now();
    if (Math.sqrt(sum / buf.length) > THRESHOLD) lastLoud = now;
    const next = now - lastLoud < HOLD_MS;
    if (next !== speaking) cb((speaking = next));
  }, 50);
  return () => {
    clearInterval(timer);
    src.disconnect();
    if (speaking) cb(false);
  };
}
