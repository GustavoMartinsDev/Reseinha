import type { VercelRequest } from "@vercel/node";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@telacast/shared";
import { HttpError } from "./http";

function key(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(s);
}

export async function signToken(user: User): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function requireAuth(req: VercelRequest): Promise<User> {
  const h = req.headers.authorization ?? "";
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) throw new HttpError(401, "Não autenticado");
  try {
    const { payload } = await jwtVerify(m[1], key(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.username !== "string") throw new Error("bad");
    return { id: payload.sub, username: payload.username };
  } catch {
    throw new HttpError(401, "Token inválido ou expirado");
  }
}
