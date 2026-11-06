import type { MosslightBridge } from '../lib/types';

declare global {
  interface Window {
    mosslight?: MosslightBridge;
    /** Debug/export hook: renders the wallpaper portrait as a PNG data URL. */
    __mosslightPortrait?: (width: number, height: number) => string;
  }
}

export {};
