import { redis } from "../lib/redis";
import { route, HttpError } from "../lib/http";
import { requireAuth } from "../lib/auth";
import { genCode, kChannel, joinChannel } from "../lib/channel";

export default route("POST", async (req, res) => {
  const user = await requireAuth(req);
  for (let i = 0; i < 10; i++) {
    const code = genCode();
    if (await redis.set(kChannel(code), Date.now(), { nx: true })) {
      res.status(200).json(await joinChannel(code, user));
      return;
    }
  }
  throw new HttpError(500, "Não foi possível gerar código de canal");
});
