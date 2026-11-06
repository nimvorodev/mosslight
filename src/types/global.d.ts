import type { MosslightBridge } from '../lib/types';

declare global {
  interface Window {
    mosslight?: MosslightBridge;
  }
}

export {};
