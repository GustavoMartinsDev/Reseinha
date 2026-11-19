import { BrowserWindow, desktopCapturer, ipcMain, session } from "electron";

export interface CaptureSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string;
}

export function registerCapture(win: BrowserWindow): void {
  let selected: { id: string; withAudio: boolean } | null = null;

  ipcMain.handle("capture:list-sources", async (): Promise<CaptureSource[]> => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith("screen:") ? "screen" : "window",
      thumbnail: s.thumbnail.toDataURL(),
    }));
  });

  ipcMain.handle("capture:select", (_e, id: string, withAudio: boolean) => {
    selected = { id, withAudio: !!withAudio };
  });

  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    const choice = selected;
    selected = null; // uso único: cada getDisplayMedia exige nova seleção
    if (!choice) return callback({}); // sem seleção: nega
    desktopCapturer
      .getSources({ types: ["screen", "window"] })
      .then((all) => {
        const video = all.find((s) => s.id === choice.id);
        if (!video) return callback({});
        callback({ video, audio: choice.withAudio ? "loopback" : undefined });
      })
      .catch(() => callback({}));
  });

  win.on("closed", () => {
    ipcMain.removeHandler("capture:list-sources");
    ipcMain.removeHandler("capture:select");
    selected = null;
  });
}
