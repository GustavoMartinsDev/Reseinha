import type { IceServer, SignalType } from "@telacast/shared";

const MAX_VIDEO_BITRATE = 4_000_000;

export type SendSignal = (to: string, type: SignalType, data: unknown) => void;

/** Conexão com um membro, usando "perfect negotiation". */
export class Peer {
  readonly pc: RTCPeerConnection;
  readonly remote = new MediaStream(); // tela (vídeo + áudio do sistema)
  readonly voice = new MediaStream(); // voz (microfone) do outro lado
  private remoteVoiceId: string | undefined;
  private senders = new Map<string, RTCRtpSender>(); // track.id -> sender
  private making = false;
  private ignoreOffer = false;

  constructor(
    readonly userId: string,
    private polite: boolean,
    iceServers: IceServer[],
    private send: SendSignal,
    private onRemote: (s: MediaStream | null) => void,
    private onVoice: (s: MediaStream | null) => void,
    private getVoiceId: () => string | undefined,
  ) {
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send(userId, "candidate", e.candidate.toJSON());
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.making = true;
        await this.pc.setLocalDescription();
        this.sendDesc();
        this.limitBitrate();
      } catch {
        /* glare tratado pelo lado polite */
      } finally {
        this.making = false;
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === "failed") this.pc.restartIce();
    };

    this.pc.ontrack = ({ track, streams }) => {
      if (track.kind === "audio" && streams[0]?.id === this.remoteVoiceId) {
        this.voice.addTrack(track);
        this.onVoice(this.voice);
        return;
      }
      this.remote.addTrack(track);
      this.notify();
      // Quando o outro lado remove o sender, a track fica muted (e volta no unmute).
      track.onmute = () => {
        this.remote.removeTrack(track);
        this.notify();
      };
      track.onunmute = () => {
        this.remote.addTrack(track);
        this.notify();
      };
      track.onended = track.onmute;
    };
  }

  /** Envia a descrição local; "voice" diz qual stream é a voz (vai junto do SDP, sem corrida). */
  private sendDesc() {
    const d = this.pc.localDescription!;
    this.send(this.userId, d.type === "offer" ? "offer" : "answer", {
      type: d.type,
      sdp: d.sdp,
      voice: this.getVoiceId(),
    });
  }

  /** Troca a track enviada (ex.: outro microfone) sem renegociar. */
  async swapTrack(oldT: MediaStreamTrack, newT: MediaStreamTrack) {
    const s = this.senders.get(oldT.id);
    if (!s) return;
    await s.replaceTrack(newT);
    this.senders.delete(oldT.id);
    this.senders.set(newT.id, s);
  }

  private notify() {
    this.onRemote(this.remote.getTracks().length ? this.remote : null);
  }

  private limitBitrate() {
    for (const s of this.pc.getSenders()) {
      if (s.track?.kind !== "video") continue;
      const p = s.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
      s.setParameters(p).catch(() => {});
    }
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    if (this.senders.has(track.id)) return;
    this.senders.set(track.id, this.pc.addTrack(track, stream));
  }

  removeTrack(track: MediaStreamTrack) {
    const s = this.senders.get(track.id);
    if (!s) return;
    this.senders.delete(track.id);
    if (this.pc.signalingState !== "closed") this.pc.removeTrack(s);
  }

  async handleSignal(type: SignalType, data: unknown) {
    if (type === "stream-stop") {
      for (const t of this.remote.getVideoTracks()) this.remote.removeTrack(t);
      this.notify();
      return;
    }
    if (type === "candidate") {
      try {
        await this.pc.addIceCandidate(data as RTCIceCandidateInit);
      } catch (e) {
        if (!this.ignoreOffer) throw e;
      }
      return;
    }
    const desc = data as RTCSessionDescriptionInit & { voice?: string };
    this.remoteVoiceId = desc.voice;
    const collision = desc.type === "offer" && (this.making || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && collision;
    if (this.ignoreOffer) return;
    await this.pc.setRemoteDescription(desc); // rollback implícito se polite
    if (desc.type === "offer") {
      await this.pc.setLocalDescription();
      this.sendDesc();
    }
  }

  close() {
    this.pc.close();
    this.onRemote(null);
    this.onVoice(null);
  }
}
