import { route, body } from "../lib/http";
import { requireAuth } from "../lib/auth";
import { joinChannel, normCode } from "../lib/channel";

export default route("POST", async (req, res) => {
  const user = await requireAuth(req);
  const code = normCode(body(req).code);
  res.status(200).json(await joinChannel(code, user));
});
