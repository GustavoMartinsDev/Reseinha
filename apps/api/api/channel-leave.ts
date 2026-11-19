import { redis } from "../lib/redis";
import { route, body } from "../lib/http";
import { requireAuth } from "../lib/auth";
import { channelExists, kHb, kPresence, liveMembers, normCode } from "../lib/channel";

export default route("POST", async (req, res) => {
  const user = await requireAuth(req);
  const code = normCode(body(req).code);
  await redis.hdel(kPresence(code), user.id);
  await redis.del(kHb(code, user.id));
  if (await channelExists(code)) await liveMembers(code); // aplica EXPIRE se ficou vazio
  res.status(200).json({ ok: true });
});
