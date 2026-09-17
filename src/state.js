/** Shared mutable app state */
export const state = {
  sex: 'male',
  health: 'healthy',
  heightCm: 170,
  weightKg: 70,
  simSpeed: 1,

  /** Derived vitals (updated by applyHealth) */
  heartRate: 72,
  bloodFlowIntensity: 1,
  digestionSpeed: 1,
  skinTone: 0xe8b89a,

  /** Camera / focus */
  focusedOrgan: null,

  /** Digestion */
  digestion: {
    active: false,
    food: null,
    progress: 0,
    stage: 'idle',
    energyBoost: 0,
    gutActivity: 0,
    duration: 0,
    elapsed: 0,
  },

  energy: 0.5,
}

export const FOOD_PROFILES = {
  spinach: {
    label: 'Spinach',
    color: 0x3ecf6e,
    energy: 0.35,
    duration: 8,
    gutActivity: 0.9,
    digestionMul: 1.35,
    note: 'Light energy · faster gut transit (stylized)',
  },
  rice: {
    label: 'Rice',
    color: 0xf5f0d8,
    energy: 0.65,
    duration: 12,
    gutActivity: 0.55,
    digestionMul: 1.0,
    note: 'Moderate carbs · steady digestion (stylized)',
  },
  meat: {
    label: 'Meat',
    color: 0xc45c4a,
    energy: 0.95,
    duration: 18,
    gutActivity: 0.4,
    digestionMul: 0.7,
    note: 'High energy · longer digestion (stylized)',
  },
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
  // Height: 140–210 cm → vertical scale around 0.82–1.24 (ref 170)
  const h = state.heightCm / 170
  // Weight relative to height-ish BMI proxy → girth
  const ideal = 22 * (state.heightCm / 100) ** 2
  const bmiRatio = state.weightKg / Math.max(ideal, 1)
  const girth = Math.min(1.45, Math.max(0.75, Math.sqrt(bmiRatio)))
  return { height: h, girth }
}
