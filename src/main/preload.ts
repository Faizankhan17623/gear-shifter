import { contextBridge, ipcRenderer } from 'electron';
import type { GearConfig } from '../shared/models';

export interface AutoTypeResult {
  ok: boolean;
  reason?: string;
}

export interface AutoTypeTarget {
  ok: boolean;
  title?: string;
  reason?: string;
}

export interface GearShifterApi {
  copyModelCommand: (modelId: string) => Promise<boolean>;
  getAutoTypeTarget: () => Promise<AutoTypeTarget>;
  commitAutoType: (modelId: string) => Promise<AutoTypeResult>;
  getGearConfig: () => Promise<GearConfig[]>;
  setGearConfig: (config: GearConfig[]) => Promise<GearConfig[]>;
  resetGearConfig: () => Promise<GearConfig[]>;
  readClipboard: () => Promise<string>;
}

const api: GearShifterApi = {
  copyModelCommand: (modelId: string) => ipcRenderer.invoke('clipboard:copy-model', modelId),
  getAutoTypeTarget: () => ipcRenderer.invoke('autotype:get-target'),
  commitAutoType: (modelId: string) => ipcRenderer.invoke('autotype:commit', modelId),
  getGearConfig: () => ipcRenderer.invoke('config:get'),
  setGearConfig: (config: GearConfig[]) => ipcRenderer.invoke('config:set', config),
  resetGearConfig: () => ipcRenderer.invoke('config:reset'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
};

contextBridge.exposeInMainWorld('gearShifter', api);
