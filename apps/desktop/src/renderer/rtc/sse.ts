import type { ServerEvent } from "@telacast/shared";

/** Lê um stream SSE via fetch (precisa de header Authorization). Reconecta sozinho. */
export function openEvents(
  url: string,
  token: string,
  onEvent: (e: ServerEvent) => void,
  onError: (msg: string) => void,
): () => void {
  const ctrl = new AbortController();
  let stopped = false;

  const run = async () => {
    while (!stopped) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`events HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            let event = "message";
            const data: string[] = [];
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
            }
            if (!data.length) continue; // comentário/keepalive
            try {
              onEvent({ event, data: JSON.parse(data.join("\n")) } as ServerEvent);
            } catch {
              /* evento malformado */
            }
          }
        }
      } catch (e) {
        if (stopped) return;
        onError(`Conexão de eventos: ${(e as Error).message}`);
      }
      if (!stopped) await new Promise((r) => setTimeout(r, 1000));
    }
  };
  void run();
  return () => {
    stopped = true;
    ctrl.abort();
  };
}
