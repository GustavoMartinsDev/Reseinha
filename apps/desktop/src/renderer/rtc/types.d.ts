export {};

declare global {
  interface Window {
    capture: {
      listSources(): Promise<
        { id: string; name: string; kind: "screen" | "window"; thumbnail: string }[]
      >;
      select(id: string, withAudio: boolean): Promise<void>;
    };
  }
}
