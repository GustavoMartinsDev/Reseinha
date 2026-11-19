import type { SignalMessage, SignalType } from "@telacast/shared";
import { redis } from "../lib/redis";
import { route, body, str, HttpError } from "../lib/http";
import { requireAuth } from "../lib/auth";
import { channelExists, isMember, kSignals, normCode } from "../lib/channel";

const TYPES: SignalType[] = ["offer", "answer", "candidate", "stream-stop"];

export default route("POST", async (req, res) => {
  const user = await requireAuth(req);
  const b = body(req);
  const code = normCode(b.code);
  const to = str(b.to);
  const type = str(b.type) as SignalType;
  if (!to) throw new HttpError(400, "Destino ausente");
  if (!TYPES.includes(type)) throw new HttpError(400, "Tipo de sinal inválido");
  if (!(await channelExists(code))) throw new HttpError(404, "Canal não existe");
  if (!(await isMember(code, user.id))) throw new HttpError(403, "Você não está no canal");
  if (!(await isMember(code, to))) throw new HttpError(404, "Destinatário não está no canal");

  const msg: SignalMessage = { from: user.id, type, data: b.data ?? {} };
  const key = kSignals(code, to);
  await redis.lpush(key, msg);
  await redis.expire(key, 60);
  res.status(200).json({ ok: true });
});
