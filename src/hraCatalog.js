/**
 * HuBMAP Human Reference Atlas (HRA) organ catalog helpers.
 * Models: https://humanatlas.io/3d-reference-library (CC BY 4.0)
 */

/** Map HRA manifest labels → app organ ids */
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
  prostate: 'prostate',
  uterus: 'uterus',
  'Left ovary': 'leftOvary',
  'Right ovary': 'rightOvary',
  'Left fallopian tube': 'leftFallopianTube',
  'Right fallopian tube': 'rightFallopianTube',
  'blood vasculature': 'vasculature',
  'Left eye': 'leftEye',
  'Right eye': 'rightEye',
  // Explicitly skipped (too large / not needed)
  // mouth — never load
}

export const ORGAN_META = {
  brain: { name: 'Brain', system: 'head' },
  leftEye: { name: 'Left eye', system: 'head', optional: true },
  rightEye: { name: 'Right eye', system: 'head', optional: true },
  larynx: { name: 'Larynx', system: 'head' },
  spinalCord: { name: 'Spinal cord', system: 'head' },
  heart: { name: 'Heart', system: 'chest' },
  lung: { name: 'Lungs', system: 'chest' },
  trachea: { name: 'Trachea', system: 'chest' },
  thymus: { name: 'Thymus', system: 'chest' },
  liver: { name: 'Liver', system: 'abdomen' },
  pancreas: { name: 'Pancreas', system: 'abdomen' },
  spleen: { name: 'Spleen', system: 'abdomen' },
  smallIntestine: { name: 'Small intestine', system: 'abdomen' },
  largeIntestine: { name: 'Large intestine', system: 'abdomen' },
  leftKidney: { name: 'Left kidney', system: 'abdomen' },
  rightKidney: { name: 'Right kidney', system: 'abdomen' },
  bladder: { name: 'Bladder', system: 'pelvis' },
  uterus: { name: 'Uterus', system: 'pelvis', sex: 'female' },
  leftOvary: { name: 'Left ovary', system: 'pelvis', sex: 'female' },
  rightOvary: { name: 'Right ovary', system: 'pelvis', sex: 'female' },
  leftFallopianTube: { name: 'Left fallopian tube', system: 'pelvis', sex: 'female' },
  rightFallopianTube: { name: 'Right fallopian tube', system: 'pelvis', sex: 'female' },
  prostate: { name: 'Prostate', system: 'pelvis', sex: 'male' },
  vasculature: { name: 'Blood vessels', system: 'chest', optional: true },
}

export const SYSTEM_LABELS = {
  head: 'Head & neck',
  chest: 'Chest',
  abdomen: 'Abdomen',
  pelvis: 'Pelvis',
}

/** Always-load labels (sex-filtered at runtime). Mouth never included. */
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
]

export const MALE_EXTRA_LABELS = ['prostate']
export const FEMALE_EXTRA_LABELS = [
  'uterus',
  'Left ovary',
  'Right ovary',
  'Left fallopian tube',
  'Right fallopian tube',
]

/** Optional / deferred (user toggle). Eyes are huge; vasculature is large. */
export const OPTIONAL_LABELS = {
  vasculature: ['blood vasculature'],
  eyes: ['Left eye', 'Right eye'],
}

export function sexKey(sex) {
  return sex === 'female' ? 'Female' : 'Male'
}

export function coreLabelsForSex(sex) {
  const extra = sex === 'female' ? FEMALE_EXTRA_LABELS : MALE_EXTRA_LABELS
  return [...CORE_LABELS, ...extra]
}

/**
 * @param {Array<{label:string,sex:string,file:string}>} manifest
 * @param {'male'|'female'} sex
 * @param {string[]} labels
 */
export function resolveEntries(manifest, sex, labels) {
  const sk = sexKey(sex)
  const out = []
  for (const label of labels) {
    const entry = manifest.find((m) => m.label === label && m.sex === sk)
    if (!entry) continue
    const id = HRA_LABEL_TO_ID[label]
    if (!id) continue
    out.push({ id, label, file: entry.file, sex: entry.sex })
  }
  return out
}
