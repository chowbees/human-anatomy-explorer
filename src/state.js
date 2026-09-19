import { DEFAULT_VISIBLE } from './bp3dAtlas.js'

/** Shared mutable app state */
export const state = {
  /** male = BodyParts3D atlas; female = HuBMAP HRA organ GLBs */
  sex: 'male',
  referenceNote: 'Adult male reference (BodyParts3D 4.0)',
  health: 'healthy',
  heightCm: 170,
  weightKg: 70,
  simSpeed: 1,

  heartRate: 72,
  bloodFlowIntensity: 1,
  digestionSpeed: 1,
  skinTone: 0xe8b89a,
  /** translucent | solid | hidden — drives integumentary / HRA skin */
  skinMode: 'hidden',

  /** Visible anatomical systems (shared ids across male/female loaders) */
  visibleSystems: DEFAULT_VISIBLE.slice(),

  focusedOrgan: null,
  /** Optional HRA toggles (female) */
  optionalEyes: false,
  optionalVasculature: false,

  digestion: {
    active: false,
    food: null,
    progress: 0,
    stage: 'idle',
    energyBoost: 0,
    gutActivity: 0,
    duration: 0,
    elapsed: 0,
    nutrients: {
      energy: 0,
      vitamins: 0,
      protein: 0,
      carbs: 0,
      fiber: 0,
      minerals: 0,
    },
  },

  energy: 0.5,
}

/**
 * Nutrient maps are educational / stylized (not lab assays).
 * Values 0–1 are relative “release strength” for UI bars + particles.
 */
export const FOOD_PROFILES = {
  spinach: {
    label: 'Spinach',
    color: 0x3ecf6e,
    energy: 0.28,
    duration: 8,
    gutActivity: 0.9,
    digestionMul: 1.35,
    note: 'Rich in vitamins & minerals · lower energy (stylized)',
    nutrients: {
      energy: 0.25,
      vitamins: 0.95, // A, K, C, folate
      protein: 0.25,
      carbs: 0.2,
      fiber: 0.85,
      minerals: 0.9, // iron, magnesium
    },
    vitaminLabels: ['A', 'K', 'C', 'Folate'],
    mineralLabels: ['Iron', 'Magnesium'],
    bolusStages: {
      mouth: 0x3ecf6e,
      stomach: 0x5ad88a,
      smallIntestine: 0x7ee0a8,
      largeIntestine: 0xa8e8c4,
    },
  },
  rice: {
    label: 'Rice',
    color: 0xf5f0d8,
    energy: 0.72,
    duration: 12,
    gutActivity: 0.55,
    digestionMul: 1.0,
    note: 'Carbs → energy (glucose) · some B vitamins (stylized)',
    nutrients: {
      energy: 0.85,
      vitamins: 0.4, // B vitamins
      protein: 0.2,
      carbs: 0.95,
      fiber: 0.15,
      minerals: 0.2,
    },
    vitaminLabels: ['B1', 'B3'],
    mineralLabels: [],
    bolusStages: {
      mouth: 0xf5f0d8,
      stomach: 0xf0e4b0,
      smallIntestine: 0xe8d078,
      largeIntestine: 0xd4c060,
    },
  },
  meat: {
    label: 'Meat',
    color: 0xc45c4a,
    energy: 0.92,
    duration: 18,
    gutActivity: 0.4,
    digestionMul: 0.7,
    note: 'Protein → amino acids · fats → energy · iron & B12 (stylized)',
    nutrients: {
      energy: 0.9,
      vitamins: 0.55, // B12
      protein: 0.95,
      carbs: 0.05,
      fiber: 0.0,
      minerals: 0.7, // iron
    },
    vitaminLabels: ['B12'],
    mineralLabels: ['Iron'],
    bolusStages: {
      mouth: 0xc45c4a,
      stomach: 0xb05040,
      smallIntestine: 0x9a4838,
      largeIntestine: 0x7a3a30,
    },
  },
}

export const NUTRIENT_KEYS = ['energy', 'vitamins', 'protein', 'carbs', 'fiber', 'minerals']

export const NUTRIENT_META = {
  energy: { label: 'Energy', color: '#e6c07b' },
  vitamins: { label: 'Vitamins', color: '#7ec8e3' },
  protein: { label: 'Protein', color: '#e07a7a' },
  carbs: { label: 'Carbs', color: '#d4b85a' },
  fiber: { label: 'Fiber', color: '#6ecf8e' },
  minerals: { label: 'Minerals', color: '#b0a0e0' },
}

export function applyHealth(health) {
  state.health = health
  if (health === 'healthy') {
    state.heartRate = 68
    state.bloodFlowIntensity = 1.0
    state.digestionSpeed = 1.15
    state.skinTone = 0xe8b89a
  } else {
    state.heartRate = 95
    state.bloodFlowIntensity = 0.55
    state.digestionSpeed = 0.7
    state.skinTone = 0xc4a090
  }
}

export function bodyScaleFromAnthropometrics() {
  const h = state.heightCm / 170
  const ideal = 22 * (state.heightCm / 100) ** 2
  const bmiRatio = state.weightKg / Math.max(ideal, 1)
  const girth = Math.min(1.45, Math.max(0.75, Math.sqrt(bmiRatio)))
  return { height: h, girth }
}

export function setSex(sex) {
  state.sex = sex === 'female' ? 'female' : 'male'
  state.referenceNote =
    state.sex === 'female'
      ? 'Adult female organs (HuBMAP HRA · CC BY)'
      : 'Adult male reference (BodyParts3D 4.0 · CC BY)'
}
