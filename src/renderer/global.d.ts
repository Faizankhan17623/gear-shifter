import type { GearShifterApi } from '../main/preload';

declare global {
  interface Window {
    gearShifter: GearShifterApi;
  }
}

export {};
