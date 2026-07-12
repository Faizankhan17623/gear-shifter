export type GearId = 'R' | '1' | '2' | '3' | '4' | '5';

export const GEAR_ORDER: GearId[] = ['R', '1', '2', '3', '4', '5'];

export interface ModelInfo {
  /** The exact string passed to `/model <id>` */
  modelId: string;
  /** Short display name, e.g. "Haiku 4.5" */
  name: string;
  /** One-line description of what this model is good for */
  description: string;
}

export interface GearConfig {
  gear: GearId;
  /** null means this gear is locked/reserved (no model assigned) */
  model: ModelInfo | null;
}

/** The full catalog of models a gear could be assigned to, for the settings dropdown. */
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    modelId: 'claude-haiku-4-5',
    name: 'Haiku 4.5',
    description: 'Fastest, cheapest — quick answers',
  },
  {
    modelId: 'claude-sonnet-5',
    name: 'Sonnet 5',
    description: 'Balanced speed and intelligence — everyday tasks',
  },
  {
    modelId: 'claude-opus-4-8',
    name: 'Opus 4.8',
    description: 'Deep reasoning, slower — complex tasks',
  },
  {
    modelId: 'claude-fable-5',
    name: 'Fable 5',
    description: 'Most capable, slowest — hardest & longest-running tasks',
  },
];

function findModel(modelId: string): ModelInfo {
  const m = AVAILABLE_MODELS.find((x) => x.modelId === modelId);
  if (!m) throw new Error(`Unknown model id: ${modelId}`);
  return m;
}

/** Default gear -> model mapping, lightest/fastest to heaviest/most-capable. */
export const DEFAULT_GEAR_CONFIG: GearConfig[] = [
  { gear: 'R', model: findModel('claude-haiku-4-5') },
  { gear: '1', model: findModel('claude-haiku-4-5') },
  { gear: '2', model: findModel('claude-sonnet-5') },
  { gear: '3', model: findModel('claude-opus-4-8') },
  { gear: '4', model: findModel('claude-fable-5') },
  { gear: '5', model: null },
];

export function buildModelCommand(modelId: string): string {
  return `/model ${modelId}`;
}
