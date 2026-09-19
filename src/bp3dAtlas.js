/** BodyParts3D 4.0 atlas helpers (packaged by ashemag/human-atlas). */

export const CDN_BASE =
  'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models'

/** Local fallback if CDN is blocked (optional vendored copy). */
export const LOCAL_BASE = `${(import.meta.env && import.meta.env.BASE_URL) || '/human-anatomy-explorer/'}models/bp3d`

export const SYSTEMS = [
  {
    id: 'skeletal',
    name: 'Skeleton',
    color: '#e2d9ba',
    kidsDefault: true,
    description: 'Bones support the body, protect organs, and attach muscles.',
  },
  {
    id: 'nervous',
    name: 'Nervous system',
    color: '#d8b565',
    kidsDefault: true,
    description: 'Brain, spinal cord, and nerves carry signals for sensing and movement.',
  },
  {
    id: 'digestive',
    name: 'Digestive',
    color: '#b8916b',
    kidsDefault: true,
    description: 'Breaks down food and absorbs nutrients — includes the stomach.',
  },
  {
    id: 'respiratory',
    name: 'Respiratory',
    color: '#b98991',
    kidsDefault: true,
    description: 'Airways that carry air toward the lungs.',
  },
  {
    id: 'cardiac',
    name: 'Heart',
    color: '#b96760',
    kidsDefault: true,
    description: 'Heart chambers and valves that pump blood.',
  },
  {
    id: 'urinary',
    name: 'Urinary',
    color: '#b47961',
    kidsDefault: true,
    description: 'Kidneys and bladder filter blood and store urine.',
  },
  {
    id: 'endocrine',
    name: 'Endocrine',
    color: '#c5a09a',
    kidsDefault: true,
    description: 'Glands that release hormones into the blood.',
  },
  {
    id: 'reproductive',
    name: 'Reproductive',
    color: '#bda098',
    kidsDefault: true,
    description: 'Male reproductive structures in this adult-male reference atlas.',
  },
  {
    id: 'muscular',
    name: 'Muscles',
    color: '#a85b50',
    kidsDefault: false,
    description: 'Skeletal muscles that move the body.',
  },
  {
    id: 'arterial',
    name: 'Arteries',
    color: '#c05245',
    kidsDefault: false,
    description: 'Arteries carry blood away from the heart.',
  },
  {
    id: 'venous',
    name: 'Veins',
    color: '#527c9f',
    kidsDefault: false,
    description: 'Veins return blood toward the heart.',
  },
  {
    id: 'lymphatic',
    name: 'Lymphatic',
    color: '#879f7c',
    kidsDefault: false,
    description: 'Lymph vessels and organs that help fluid balance and immunity.',
  },
  {
    id: 'sensory',
    name: 'Sensory organs',
    color: '#b0c8ce',
    kidsDefault: false,
    description: 'Structures for sight, hearing, and related senses.',
  },
  {
    id: 'connective',
    name: 'Connective tissue',
    color: '#aec3bb',
    kidsDefault: false,
    description: 'Cartilage, ligaments, and supporting tissue.',
  },
  {
    id: 'integumentary',
    name: 'Body surface',
    color: '#ba9b7d',
    kidsDefault: false,
    description: 'Outer body surface (skin) — often hidden so organs stay visible.',
  },
]

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]))

export const DEFAULT_VISIBLE = SYSTEMS.filter((s) => s.kidsDefault).map((s) => s.id)

export const PRESETS = {
  organs: {
    label: 'Organs',
    systems: [
      'digestive',
      'respiratory',
      'cardiac',
      'urinary',
      'endocrine',
      'reproductive',
      'nervous',
    ],
  },
  skeleton: {
    label: 'Skeleton',
    systems: ['skeletal'],
  },
  nerves: {
    label: 'Nerves',
    systems: ['nervous', 'skeletal'],
  },
  full: {
    label: 'Full systems',
    systems: DEFAULT_VISIBLE.slice(),
  },
}

/** Quick-focus shortcuts for classroom (matched by exact or includes name). */
export const FOCUS_SHORTCUTS = [
  { id: 'stomach', label: 'Stomach', match: (n) => n === 'Stomach' },
  { id: 'esophagus', label: 'Esophagus', match: (n) => n === 'Esophagus' },
  { id: 'heart', label: 'Heart', match: (n) => n === 'Wall of ventricle' },
  { id: 'brain', label: 'Brain', match: (n) => n === 'Cerebellum' },
  { id: 'kidneyL', label: 'Left kidney', match: (n) => n === 'Left kidney' },
  { id: 'kidneyR', label: 'Right kidney', match: (n) => n === 'Right kidney' },
  { id: 'spleen', label: 'Spleen', match: (n) => n === 'Spleen' },
  { id: 'pancreas', label: 'Pancreas', match: (n) => n === 'Pancreas' },
  { id: 'trachea', label: 'Trachea', match: (n) => n === 'Trachea' },
  { id: 'bladder', label: 'Bladder', match: (n) => n === 'Urinary bladder' },
  { id: 'duodenum', label: 'Duodenum', match: (n) => n === 'Duodenum' },
  { id: 'colon', label: 'Colon', match: (n) => n === 'Transverse colon' },
]

/**
 * Static hosts may serve .gz as a compressed response or as a raw gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid double-decompress.
 */
export async function decodeModelResponse(response, expectedBytes, compressed) {
  if (!response.ok) {
    throw new Error(`Anatomy chunk failed (${response.status})`)
  }
  const payload = await response.arrayBuffer()
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength))
  const gzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b
  const buffer = gzip
    ? await new Response(
        new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer()
    : payload
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(
      `Incomplete anatomy file (${buffer.byteLength} ≠ ${expectedBytes} bytes). Reload.`
    )
  }
  return buffer
}

export function rewriteChunkUrls(atlas, base) {
  const b = base.replace(/\/$/, '')
  return {
    ...atlas,
    chunks: atlas.chunks.map((c) => ({
      ...c,
      url: absoluteUrl(c.url, b),
      gzip: c.gzip ? absoluteUrl(c.gzip, b) : undefined,
    })),
  }
}

function absoluteUrl(pathOrUrl, base) {
  if (!pathOrUrl) return pathOrUrl
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const name = pathOrUrl.split('/').pop()
  return `${base}/${name}`
}

export function partCenter(part) {
  const [[x0, y0, z0], [x1, y1, z1]] = part.bounds
  return [(x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5]
}

export function explanationFor(part) {
  const name = part.name.toLowerCase()
  const tips = {
    stomach:
      'A muscular chamber between the esophagus and small intestine. It mixes food with acid and enzymes.',
    esophagus: 'The tube that carries swallowed food from the throat to the stomach.',
    duodenum: 'The first part of the small intestine, right after the stomach.',
    pancreas: 'Makes digestive enzymes and hormones such as insulin.',
    spleen: 'Filters blood and helps the immune system.',
    trachea: 'The main airway that carries air toward the bronchi.',
    cerebellum: 'Part of the brain that helps with balance and coordination.',
    'urinary bladder': 'Stores urine from the kidneys until it leaves the body.',
    'left kidney': 'Filters blood and helps balance water and salts.',
    'right kidney': 'Filters blood and helps balance water and salts.',
    'wall of ventricle': 'Thick heart muscle that squeezes to pump blood.',
  }
  if (tips[name]) return tips[name]
  return SYSTEM_BY_ID[part.system]?.description || ''
}
