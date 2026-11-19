import type { Member, ServerEvent, SignalMessage } from "@telacast/shared";
import { redis } from "../lib/redis";
import { route, str, HttpError } from "../lib/http";
import { requireAuth } from "../lib/auth";
import { channelExists, isMember, kSignals, liveMembers, normCode } from "../lib/channel";

const DURATION_MS = 55_000;
const POLL_MS = 700;
const MEMBERS_EVERY = 3; // checa membros a cada 3 ticks (~2s)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default route("GET", async (req, res) => {
  const user = await requireAuth(req);
  const raw = req.query.code;
  const code = normCode(Array.isArray(raw) ? raw[0] : str(raw));
  if (!(await channelExists(code))) throw new HttpError(404, "Canal não existe");
  if (!(await isMember(code, user.id))) throw new HttpError(403, "Você não está no canal");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*"
  });

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });
  const send = (e: ServerEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);

  let lastSig = "";
  const sync = async (): Promise<boolean> => {
    if (!(await channelExists(code))) {
      send({ event: "closed", data: { reason: "Canal encerrado" } });
      return false;
    }
    const members: Member[] = await liveMembers(code);
    const sig = JSON.stringify(members);
    if (sig !== lastSig) {
      lastSig = sig;
      send({ event: "members", data: members });
    }
    return true;
  };

  const end = Date.now() + DURATION_MS;
  if (await sync()) {
    let tick = 0;
    while (!aborted && Date.now() < end) {
      const sigs = await redis.rpop<SignalMessage[]>(kSignals(code, user.id), 50);
      if (sigs) for (const s of sigs) send({ event: "signal", data: s });
      if (++tick % MEMBERS_EVERY === 0 && !(await sync())) break;
      await sleep(POLL_MS);
    }
  }
  res.end();
});
