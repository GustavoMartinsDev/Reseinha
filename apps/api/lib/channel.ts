import type { ChannelState, IceServer, Member } from "@telacast/shared";
import {
  CODE_LENGTH,
  EMPTY_CHANNEL_TTL_S,
  MAX_MEMBERS,
  PRESENCE_TTL_S
} from "@telacast/shared";
import { redis } from "./redis";
import { HttpError } from "./http";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I

export const kChannel = (c: string) => `channel:${c}`;
export const kPresence = (c: string) => `presence:${c}`;
export const kHb = (c: string, u: string) => `presence-hb:${c}:${u}`;
export const kSignals = (c: string, u: string) => `signals:${c}:${u}`;

export function genCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function normCode(v: unknown): string {
  const c = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (!new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(c)) {
    throw new HttpError(400, "Código de canal inválido");
  }
  return c;
}

export function iceServers(): IceServer[] {
  try {
    const raw = process.env.ICE_SERVERS_JSON;
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length) return p as IceServer[];
    }
  } catch {
    /* cai no default */
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export async function channelExists(code: string): Promise<boolean> {
  return (await redis.exists(kChannel(code))) === 1;
}

/** Membros com heartbeat vivo. Limpa mortos; se vazio, agenda expiração do canal. */
export async function liveMembers(code: string): Promise<Member[]> {
  const all = (await redis.hgetall<Record<string, unknown>>(kPresence(code))) ?? {};
  const ids = Object.keys(all);
  if (ids.length) {
    const p = redis.pipeline();
    for (const id of ids) p.exists(kHb(code, id));
    const alive = (await p.exec()) as number[];
    const members: Member[] = [];
    const dead: string[] = [];
    ids.forEach((id, i) => {
      if (alive[i] === 1) members.push({ userId: id, username: String(all[id]) });
      else dead.push(id);
    });
    if (dead.length) await redis.hdel(kPresence(code), ...dead);
    if (members.length) {
      return members.sort((a, b) => a.userId.localeCompare(b.userId));
    }
  }
  await redis.expire(kChannel(code), EMPTY_CHANNEL_TTL_S);
  return [];
}

export async function isMember(code: string, userId: string): Promise<boolean> {
  return (await redis.exists(kHb(code, userId))) === 1;
}

export async function touch(code: string, user: { id: string; username: string }): Promise<void> {
  const p = redis.pipeline();
  p.hset(kPresence(code), { [user.id]: user.username });
  p.set(kHb(code, user.id), 1, { ex: PRESENCE_TTL_S });
  p.persist(kChannel(code));
  await p.exec();
}

export async function joinChannel(
  code: string,
  user: { id: string; username: string }
): Promise<ChannelState> {
  if (!(await channelExists(code))) throw new HttpError(404, "Canal não existe");
  const members = await liveMembers(code);
  if (!members.some((m) => m.userId === user.id) && members.length >= MAX_MEMBERS) {
    throw new HttpError(409, "Canal lotado");
  }
  await touch(code, user);
  return { code, members: await liveMembers(code), iceServers: iceServers() };
}
