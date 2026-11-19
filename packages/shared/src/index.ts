// Contrato único entre API (Vercel) e app desktop. Mudou aqui, mudou nos dois.

export const MAX_MEMBERS = 4;
export const HEARTBEAT_MS = 20_000;
export const PRESENCE_TTL_S = 45; // sem heartbeat por 45s = saiu
export const EMPTY_CHANNEL_TTL_S = 15 * 60; // canal vazio morre em 15 min
export const CODE_LENGTH = 6;

export interface User {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  username: string; // 3-20, a-z 0-9 _
  password: string; // min 6
  invite: string; // código de convite do servidor
}
export interface LoginRequest {
  username: string;
  password: string;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface Member {
  userId: string;
  username: string;
}

export interface ChannelState {
  code: string;
  members: Member[];
  iceServers: IceServer[];
}

// ---- Sinalização WebRTC ----
export type SignalType = "offer" | "answer" | "candidate" | "stream-stop";

export interface SignalRequest {
  code: string;
  to: string; // userId destino
  type: SignalType;
  data: unknown; // SDP / ICE candidate / {}
}

export interface SignalMessage {
  from: string; // userId origem
  type: SignalType;
  data: unknown;
}

// ---- Eventos SSE (GET /api/events?code=XXXXXX) ----
export type ServerEvent =
  | { event: "members"; data: Member[] }
  | { event: "signal"; data: SignalMessage }
  | { event: "closed"; data: { reason: string } };

export interface ApiError {
  error: string;
}

/**
 * Endpoints (todos JSON, exceto events = text/event-stream).
 * Auth: header "Authorization: Bearer <token>" em tudo menos register/login.
 *
 * POST /api/register        RegisterRequest        -> AuthResponse
 * POST /api/login           LoginRequest           -> AuthResponse
 * POST /api/channel-create  {}                     -> ChannelState
 * POST /api/channel-join    { code }               -> ChannelState   (409 se lotado, 404 se não existe)
 * POST /api/channel-leave   { code }               -> { ok: true }
 * POST /api/presence        { code }               -> { members: Member[] }  (heartbeat)
 * POST /api/signal          SignalRequest          -> { ok: true }
 * GET  /api/events?code=X   (fetch stream, header Authorization) -> SSE de ServerEvent
 */
