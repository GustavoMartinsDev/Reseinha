import { route, body, HttpError } from "../lib/http";
import { requireAuth } from "../lib/auth";
import { channelExists, isMember, liveMembers, normCode, touch } from "../lib/channel";

export default route("POST", async (req, res) => {
  const user = await requireAuth(req);
  const code = normCode(body(req).code);
  if (!(await channelExists(code))) throw new HttpError(404, "Canal não existe");
  if (!(await isMember(code, user.id))) throw new HttpError(403, "Você não está no canal");
  await touch(code, user);
  res.status(200).json({ members: await liveMembers(code) });
});
