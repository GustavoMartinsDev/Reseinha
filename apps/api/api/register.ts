import bcrypt from "bcryptjs";
import type { AuthResponse } from "@telacast/shared";
import { redis } from "../lib/redis";
import { route, body, str, HttpError } from "../lib/http";
import { signToken } from "../lib/auth";

export default route("POST", async (req, res) => {
  const b = body(req);
  const username = str(b.username).trim().toLowerCase();
  const password = str(b.password);
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new HttpError(400, "Usuário deve ter 3-20 caracteres (a-z, 0-9, _)");
  }
  if (password.length < 6) throw new HttpError(400, "Senha deve ter no mínimo 6 caracteres");
  const invite = process.env.INVITE_CODE;
  if (!invite || str(b.invite) !== invite) throw new HttpError(403, "Convite inválido");

  const user = { id: crypto.randomUUID(), username };
  const ok = await redis.set(
    `user:${username}`,
    { id: user.id, passwordHash: await bcrypt.hash(password, 10), createdAt: Date.now() },
    { nx: true }
  );
  if (!ok) throw new HttpError(409, "Usuário já existe");
  const out: AuthResponse = { token: await signToken(user), user };
  res.status(200).json(out);
});
