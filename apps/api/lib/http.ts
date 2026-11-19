import type { VercelRequest, VercelResponse } from "@vercel/node";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function cors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

/** Aplica CORS, OPTIONS, método e tratamento de erros {error}. */
export function route(method: "GET" | "POST", fn: Handler) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    try {
      if (req.method !== method) throw new HttpError(405, "Método não permitido");
      await fn(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const msg = e instanceof HttpError ? e.message : "Erro interno";
      if (!(e instanceof HttpError)) console.error(e);
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(status).json({ error: msg });
    }
  };
}

export function body(req: VercelRequest): Record<string, unknown> {
  let b: unknown = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch {
      throw new HttpError(400, "JSON inválido");
    }
  }
  return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function clientIp(req: VercelRequest): string {
  const xff = req.headers["x-forwarded-for"];
  const s = Array.isArray(xff) ? xff[0] : xff;
  return (s?.split(",")[0] ?? req.socket?.remoteAddress ?? "unknown").trim();
}
