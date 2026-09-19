/**
 * Lean HuBMAP HRA female organ catalog (CDN GLBs).
 * Models: https://humanatlas.io/3d-reference-library (CC BY 4.0)
 */

export const MANIFEST_URL = `${(import.meta.env && import.meta.env.BASE_URL) || '/human-anatomy-explorer/'}models/hra-female-manifest.json`

/** HRA label → app organ id */
export const HRA_LABEL_TO_ID = {
  skin: 'skin',
  brain: 'brain',
  heart: 'heart',
  lung: 'lung',
  liver: 'liver',
  'Left kidney': 'leftKidney',
  'Right kidney': 'rightKidney',
  spleen: 'spleen',
  pancreas: 'pancreas',
  'small intestine': 'smallIntestine',
  'large intestine': 'largeIntestine',
  'urinary bladder': 'bladder',
  trachea: 'trachea',
  larynx: 'larynx',
  'spinal cord': 'spinalCord',
  thymus: 'thymus',
  uterus: 'uterus',
  'Left ovary': 'leftOvary',
  'Right ovary': 'rightOvary',
  'Left fallopian tube': 'leftFallopianTube',
  'Right fallopian tube': 'rightFallopianTube',
  'Left ureter': 'leftUreter',
  'Right ureter': 'rightUreter',
  'blood vasculature': 'vasculature',
  'Left eye': 'leftEye',
  'Right eye': 'rightEye',
}

/** Map organ id → BodyParts3D-style system id for shared toggles */
export const HRA_ORGAN_SYSTEM = {
  skin: 'integumentary',
  brain: 'nervous',
  spinalCord: 'nervous',
  heart: 'cardiac',
  lung: 'respiratory',
  trachea: 'respiratory',
  larynx: 'respiratory',
  liver: 'digestive',
  pancreas: 'digestive',
  spleen: 'lymphatic',
  smallIntestine: 'digestive',
  largeIntestine: 'digestive',
  leftKidney: 'urinary',
  rightKidney: 'urinary',
  bladder: 'urinary',
  leftUreter: 'urinary',
  rightUreter: 'urinary',
  uterus: 'reproductive',
  leftOvary: 'reproductive',
  rightOvary: 'reproductive',
  leftFallopianTube: 'reproductive',
  rightFallopianTube: 'reproductive',
  thymus: 'endocrine',
  vasculature: 'arterial',
  leftEye: 'sensory',
  rightEye: 'sensory',
}

export const ORGAN_META = {
  brain: { name: 'Brain', system: 'nervous' },
  leftEye: { name: 'Left eye', system: 'sensory', optional: true },
  rightEye: { name: 'Right eye', system: 'sensory', optional: true },
  larynx: { name: 'Larynx', system: 'respiratory' },
  spinalCord: { name: 'Spinal cord', system: 'nervous' },
  heart: { name: 'Heart', system: 'cardiac' },
  lung: { name: 'Lungs', system: 'respiratory' },
  trachea: { name: 'Trachea', system: 'respiratory' },
  thymus: { name: 'Thymus', system: 'endocrine' },
  liver: { name: 'Liver', system: 'digestive' },
  pancreas: { name: 'Pancreas', system: 'digestive' },
  spleen: { name: 'Spleen', system: 'lymphatic' },
  smallIntestine: { name: 'Small intestine', system: 'digestive' },
  largeIntestine: { name: 'Large intestine', system: 'digestive' },
  leftKidney: { name: 'Left kidney', system: 'urinary' },
  rightKidney: { name: 'Right kidney', system: 'urinary' },
  bladder: { name: 'Bladder', system: 'urinary' },
  leftUreter: { name: 'Left ureter', system: 'urinary' },
  rightUreter: { name: 'Right ureter', system: 'urinary' },
  uterus: { name: 'Uterus', system: 'reproductive' },
  leftOvary: { name: 'Left ovary', system: 'reproductive' },
  rightOvary: { name: 'Right ovary', system: 'reproductive' },
  leftFallopianTube: { name: 'Left fallopian tube', system: 'reproductive' },
  rightFallopianTube: { name: 'Right fallopian tube', system: 'reproductive' },
  vasculature: { name: 'Blood vessels', system: 'arterial', optional: true },
}

export const CORE_LABELS = [
  'skin',
  'brain',
  'heart',
  'lung',
  'liver',
  'Left kidney',
  'Right kidney',
  'spleen',
  'pancreas',
  'small intestine',
  'large intestine',
  'urinary bladder',
  'trachea',
  'larynx',
  'spinal cord',
  'thymus',
  'uterus',
  'Left ovary',
  'Right ovary',
  'Left fallopian tube',
  'Right fallopian tube',
  'Left ureter',
  'Right ureter',
]

export const OPTIONAL_LABELS = {
  vasculature: ['blood vasculature'],
  eyes: ['Left eye', 'Right eye'],
}

/** Female focus shortcuts (organ ids) */
export const FEMALE_FOCUS_SHORTCUTS = [
  { id: 'heart', label: 'Heart', organId: 'heart' },
  { id: 'lung', label: 'Lungs', organId: 'lung' },
  { id: 'brain', label: 'Brain', organId: 'brain' },
  { id: 'liver', label: 'Liver', organId: 'liver' },
  { id: 'kidneyL', label: 'Left kidney', organId: 'leftKidney' },
  { id: 'kidneyR', label: 'Right kidney', organId: 'rightKidney' },
  { id: 'stomach', label: 'Small intestine', organId: 'smallIntestine' },
  { id: 'colon', label: 'Large intestine', organId: 'largeIntestine' },
  { id: 'spleen', label: 'Spleen', organId: 'spleen' },
  { id: 'pancreas', label: 'Pancreas', organId: 'pancreas' },
  { id: 'bladder', label: 'Bladder', organId: 'bladder' },
  { id: 'uterus', label: 'Uterus', organId: 'uterus' },
  { id: 'ovaryL', label: 'Left ovary', organId: 'leftOvary' },
  { id: 'ovaryR', label: 'Right ovary', organId: 'rightOvary' },
  { id: 'trachea', label: 'Trachea', organId: 'trachea' },
]

/**
 * Educational inner-layer labels for monolithic HRA organs (kids-safe cutaway).
 */
export const HRA_INNER_SCHEMATICS = {
  heart: [
    { id: 'hra-lv', label: 'Left ventricle (chamber)', tip: 'Pumps oxygen-rich blood to the body.' },
    { id: 'hra-rv', label: 'Right ventricle (chamber)', tip: 'Pumps blood toward the lungs.' },
    { id: 'hra-la', label: 'Left atrium', tip: 'Receives blood from the lungs.' },
    { id: 'hra-ra', label: 'Right atrium', tip: 'Receives blood from the body.' },
    { id: 'hra-valves', label: 'Valves (schematic)', tip: 'One-way doors that keep blood flowing forward.' },
  ],
  lung: [
    { id: 'hra-lobe-ru', label: 'Right upper lobe', tip: 'Top section of the right lung.' },
    { id: 'hra-lobe-rm', label: 'Right middle lobe', tip: 'Middle section of the right lung.' },
    { id: 'hra-lobe-rl', label: 'Right lower lobe', tip: 'Bottom section of the right lung.' },
    { id: 'hra-lobe-lu', label: 'Left upper lobe', tip: 'Top section of the left lung.' },
    { id: 'hra-lobe-ll', label: 'Left lower lobe', tip: 'Bottom section of the left lung.' },
    { id: 'hra-airways', label: 'Bronchi (airways)', tip: 'Tubes that carry air into each lobe.' },
  ],
  smallIntestine: [
    { id: 'hra-mucosa', label: 'Mucosa (inner lining)', tip: 'Absorbs vitamins, minerals, and nutrients.' },
    { id: 'hra-muscle', label: 'Muscle layer', tip: 'Squeezes food along (peristalsis).' },
    { id: 'hra-villi', label: 'Villi (schematic)', tip: 'Tiny folds that boost absorption area.' },
  ],
  largeIntestine: [
    { id: 'hra-colon-wall', label: 'Colon wall', tip: 'Absorbs water and forms stool.' },
    { id: 'hra-mucosa-li', label: 'Inner lining', tip: 'Helps reclaim water and salts.' },
  ],
  liver: [
    { id: 'hra-lobules', label: 'Lobules (schematic)', tip: 'Tiny work units that process nutrients.' },
    { id: 'hra-bile', label: 'Bile pathways', tip: 'Help digest fats.' },
  ],
  leftKidney: [
    { id: 'hra-cortex', label: 'Cortex (outer)', tip: 'Filters blood in tiny units called nephrons.' },
    { id: 'hra-medulla', label: 'Medulla (inner)', tip: 'Collects filtered fluid toward the ureter.' },
  ],
  rightKidney: [
    { id: 'hra-cortex-r', label: 'Cortex (outer)', tip: 'Filters blood in tiny units called nephrons.' },
    { id: 'hra-medulla-r', label: 'Medulla (inner)', tip: 'Collects filtered fluid toward the ureter.' },
  ],
  uterus: [
    { id: 'hra-endo', label: 'Endometrium (lining)', tip: 'Inner lining of the uterus.' },
    { id: 'hra-myo', label: 'Myometrium (muscle)', tip: 'Thick muscle wall of the uterus.' },
  ],
}

export function resolveEntries(manifest, labels) {
  const out = []
  for (const label of labels) {
    const entry = manifest.find((m) => m.label === label && m.sex === 'Female')
    if (!entry) continue
    const id = HRA_LABEL_TO_ID[label]
    if (!id) continue
    out.push({ id, label, file: entry.file, sex: 'Female', optional: !!entry.optional })
  }
  return out
}

export function explanationForHra(id) {
  const tips = {
    heart: 'A muscular pump with four chambers that moves blood through the body.',
    lung: 'Organs that take in oxygen and release carbon dioxide.',
    brain: 'The control center for thinking, sensing, and movement.',
    liver: 'Processes nutrients and helps clean the blood.',
    smallIntestine: 'Long tube where most vitamins, minerals, and nutrients are absorbed.',
    largeIntestine: 'Absorbs water and forms solid waste.',
    leftKidney: 'Filters blood and helps balance water and salts.',
    rightKidney: 'Filters blood and helps balance water and salts.',
    uterus: 'A muscular organ in the female pelvis (educational model).',
    leftOvary: 'Produces eggs and hormones (educational model).',
    rightOvary: 'Produces eggs and hormones (educational model).',
    bladder: 'Stores urine from the kidneys.',
    spleen: 'Filters blood and helps the immune system.',
    pancreas: 'Makes digestive enzymes and hormones such as insulin.',
  }
  return tips[id] || ORGAN_META[id]?.name || ''
}
