import bcrypt from "bcryptjs";
import type { AuthResponse } from "@telacast/shared";
import { redis } from "../lib/redis";
import { route, body, str, clientIp, HttpError } from "../lib/http";
import { signToken } from "../lib/auth";

export default route("POST", async (req, res) => {
  const rk = `ratelimit:login:${clientIp(req)}`;
  const n = await redis.incr(rk);
  if (n === 1) await redis.expire(rk, 60);
  if (n > 10) throw new HttpError(429, "Muitas tentativas, aguarde um minuto");

  const b = body(req);
  const username = str(b.username).trim().toLowerCase();
  const password = str(b.password);
  const rec = username
    ? await redis.get<{ id: string; passwordHash: string }>(`user:${username}`)
    : null;
  const valid = rec ? await bcrypt.compare(password, rec.passwordHash) : false;
  if (!rec || !valid) throw new HttpError(401, "Usuário ou senha incorretos");
  const user = { id: rec.id, username };
  const out: AuthResponse = { token: await signToken(user), user };
  res.status(200).json(out);
});
