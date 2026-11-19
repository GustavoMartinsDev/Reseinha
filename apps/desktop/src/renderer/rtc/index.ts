import {
  HEARTBEAT_MS,
  type IceServer,
  type Member,
  type ServerEvent,
  type SignalType,
  type User,
} from "@telacast/shared";
import { Peer } from "./peer";
import { openEvents } from "./sse";
import { watchSpeaking } from "./speaking";

export interface RoomClient {
  connect(): Promise<void>;
  startShare(sourceId: string, withAudio: boolean): Promise<void>;
  stopShare(): void;
  setMic(on: boolean): Promise<void>;
  leave(): Promise<void>;
  onMembers: (members: Member[]) => void;
  onLocalStream: (s: MediaStream | null) => void;
  onRemoteStream: (userId: string, s: MediaStream | null) => void;
  onError: (msg: string) => void;
  onSpeaking: (userId: string, speaking: boolean) => void;
  setDeafen(on: boolean): void;
  setVolume(userId: string, volume: number): void;
  listMics(): Promise<{ id: string; label: string }[]>;
  setMicDevice(id: string): Promise<void>;
}

export interface RoomOptions {
  apiUrl: string;
  token: string;
  me: User;
  code: string;
  iceServers: IceServer[];
}

export function createRoomClient(opts: RoomOptions): RoomClient {
  const { apiUrl, token, me, code, iceServers } = opts;
  const peers = new Map<string, Peer>();
  let share: MediaStream | null = null;
  let micStream: MediaStream | null = null;
  let stopEvents: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let micDevice: string | undefined;
  let left = false;

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    return res.json();
  };
  const fail = (e: unknown) => client.onError(e instanceof Error ? e.message : String(e));
  const signal = (to: string, type: SignalType, data: unknown) => {
    post("/api/signal", { code, to, type, data }).catch(fail);
  };

  // ---- voz: <audio> oculto por usuário, volume e detecção de fala ----
  const voices = new Map<string, { el: HTMLAudioElement; stop: () => void }>();
  const volumes = new Map<string, number>();
  let userMuted = false;
  let deafened = false;

  const setVoice = (userId: string, s: MediaStream | null) => {
    voices.get(userId)?.stop();
    voices.delete(userId);
    if (!s) return;
    const el = document.createElement("audio");
    el.style.display = "none";
    el.autoplay = true;
    el.srcObject = s;
    el.volume = volumes.get(userId) ?? 1;
    el.muted = deafened;
    document.body.appendChild(el);
    el.play().catch(() => {});
    const stopWatch = watchSpeaking(s, (v) => client.onSpeaking(userId, v));
    voices.set(userId, {
      el,
      stop: () => {
        stopWatch();
        el.srcObject = null;
        el.remove();
      },
    });
  };

  let stopLocalWatch: (() => void) | null = null;
  const applyMute = () => {
    micStream?.getAudioTracks().forEach((t) => (t.enabled = !(userMuted || deafened)));
  };
  const getMic = async (deviceId?: string) =>
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
  const startMic = async () => {
    const s = await getMic(micDevice);
    micStream = s;
    applyMute();
    stopLocalWatch?.();
    stopLocalWatch = watchSpeaking(s, (v) => client.onSpeaking(me.id, v));
    for (const p of peers.values()) s.getTracks().forEach((t) => p.addTrack(t, s));
  };

  const makePeer = (userId: string) => {
    // polite = menor id lexicográfico
    const p = new Peer(
      userId,
      me.id < userId,
      iceServers,
      signal,
      (s) => client.onRemoteStream(userId, s),
      (s) => setVoice(userId, s),
      () => micStream?.id,
    );
    peers.set(userId, p);
    for (const st of [share, micStream]) st?.getTracks().forEach((t) => p.addTrack(t, st));
    return p;
  };

  const onEvent = (ev: ServerEvent) => {
    if (ev.event === "members") {
      const ids = new Set(ev.data.filter((m) => m.userId !== me.id).map((m) => m.userId));
      for (const [id, p] of peers) {
        if (!ids.has(id)) {
          p.close();
          peers.delete(id);
        }
      }
      for (const id of ids) if (!peers.has(id)) makePeer(id);
      client.onMembers(ev.data);
    } else if (ev.event === "signal") {
      const { from, type, data } = ev.data;
      (peers.get(from) ?? makePeer(from)).handleSignal(type, data).catch(fail);
    } else if (ev.event === "closed") {
      client.onError(`Canal encerrado: ${ev.data.reason}`);
    }
  };

  const dropShare = () => {
    if (!share) return;
    for (const t of share.getTracks()) {
      for (const p of peers.values()) p.removeTrack(t);
      t.stop();
    }
    share = null;
    for (const id of peers.keys()) signal(id, "stream-stop", {});
    client.onLocalStream(null);
  };

  const client: RoomClient = {
    onMembers: () => {},
    onLocalStream: () => {},
    onRemoteStream: () => {},
    onError: () => {},
    onSpeaking: () => {},

    setDeafen(on) {
      deafened = on;
      voices.forEach((v) => (v.el.muted = on));
      applyMute();
    },

    setVolume(userId, volume) {
      const v = Math.min(1, Math.max(0, volume));
      volumes.set(userId, v);
      const el = voices.get(userId)?.el;
      if (el) el.volume = v;
    },

    async listMics() {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ id: d.deviceId, label: d.label || "Microfone" }));
    },

    async setMicDevice(id) {
      micDevice = id;
      if (!micStream) return startMic();
      const old = micStream.getAudioTracks()[0];
      const next = (await getMic(id)).getAudioTracks()[0];
      // mantém o MediaStream (mesmo id) e troca só a track, sem renegociar
      micStream.removeTrack(old);
      micStream.addTrack(next);
      await Promise.all([...peers.values()].map((p) => p.swapTrack(old, next)));
      old.stop();
      applyMute();
      stopLocalWatch?.();
      stopLocalWatch = watchSpeaking(micStream, (v) => client.onSpeaking(me.id, v));
    },

    async connect() {
      try {
        await startMic(); // entra com o mic ligado
      } catch (e) {
        userMuted = true; // permissão negada: entra mudo
        fail(new Error(`Microfone indisponível: ${(e as Error).message}`));
      }
      stopEvents = openEvents(
        `${apiUrl}/api/events?code=${encodeURIComponent(code)}`,
        token,
        onEvent,
        fail,
      );
      heartbeat = setInterval(() => {
        post("/api/presence", { code }).catch(fail);
      }, HEARTBEAT_MS);
      await post("/api/presence", { code });
    },

    async startShare(sourceId, withAudio) {
      if (share) dropShare();
      await window.capture.select(sourceId, withAudio);
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { max: 1920 }, height: { max: 1080 } },
        audio: withAudio,
      });
      share = s;
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (share === s) dropShare();
      });
      for (const p of peers.values()) s.getTracks().forEach((t) => p.addTrack(t, s));
      client.onLocalStream(s);
    },

    stopShare: dropShare,

    async setMic(on) {
      userMuted = !on;
      if (on && !micStream) {
        try {
          await startMic();
        } catch (e) {
          userMuted = true;
          fail(new Error(`Microfone indisponível: ${(e as Error).message}`));
        }
      }
      applyMute(); // só muta/desmuta, sem renegociar
    },

    async leave() {
      if (left) return;
      left = true;
      clearInterval(heartbeat);
      stopEvents?.();
      for (const p of peers.values()) p.close();
      peers.clear();
      voices.forEach((v) => v.stop());
      voices.clear();
      stopLocalWatch?.();
      share?.getTracks().forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
      share = micStream = null;
      client.onLocalStream(null);
      await post("/api/channel-leave", { code }).catch(() => {});
    },
  };
  return client;
}
