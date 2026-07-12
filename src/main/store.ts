import Store from 'electron-store';
import { DEFAULT_GEAR_CONFIG, type GearConfig } from '../shared/models';

interface StoreSchema {
  gearConfig: GearConfig[];
}

export const settingsStore = new Store<StoreSchema>({
  name: 'gear-shifter-config',
  defaults: {
    gearConfig: DEFAULT_GEAR_CONFIG,
  },
});

export function getGearConfig(): GearConfig[] {
  return settingsStore.get('gearConfig');
}

export function setGearConfig(config: GearConfig[]): void {
  settingsStore.set('gearConfig', config);
}

export function resetGearConfig(): GearConfig[] {
  settingsStore.set('gearConfig', DEFAULT_GEAR_CONFIG);
  return DEFAULT_GEAR_CONFIG;
}
