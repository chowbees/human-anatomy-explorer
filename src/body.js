import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { state, bodyScaleFromAnthropometrics } from './state.js'
import {
  CDN_BASE,
  LOCAL_BASE,
  SYSTEMS,
  SYSTEM_BY_ID,
  DEFAULT_VISIBLE,
  decodeModelResponse,
  rewriteChunkUrls,
  partCenter,
  explanationFor,
  FOCUS_SHORTCUTS,
  INNER_PART_GROUPS,
  innerGroupForPartName,
} from './bp3dAtlas.js'
import {
  MANIFEST_URL as HRA_MANIFEST_URL,
  CORE_LABELS as HRA_CORE_LABELS,
  OPTIONAL_LABELS as HRA_OPTIONAL,
  ORGAN_META as HRA_ORGAN_META,
  HRA_ORGAN_SYSTEM,
  HRA_INNER_SCHEMATICS,
  FEMALE_FOCUS_SHORTCUTS,
  resolveEntries as resolveHraEntries,
  explanationForHra,
} from './hraFemale.js'

export { SYSTEMS, SYSTEM_BY_ID, DEFAULT_VISIBLE, FOCUS_SHORTCUTS }
export const ORGAN_META = HRA_ORGAN_META
export const SYSTEM_LABELS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.name]))

const TARGET_BODY_HEIGHT = 1.7
const PARALLEL_CHUNKS = 3
const HEART_BEAT_AMP = 0.045 // ~4.5%
const LUNG_BREATH_AMP = 0.028 // ~2.8%

/**
 * Dual-mode anatomy body:
 *  - male  → BodyParts3D 4.0 adult male atlas (skeleton, nerves, stomach, …)
 *  - female → HuBMAP HRA female GLBs (lean organ set + reproductive organs)
 */
export class AnatomyBody {
  constructor(scene, options = {}) {
    this.scene = scene
    this.onProgress = options.onProgress || (() => {})
    this.onReady = options.onReady || (() => {})

    this.root = new THREE.Group()
    this.root.name = 'bodyRoot'
    this.organRoot = new THREE.Group()
    this.organRoot.name = 'anatomyParts'
    this.root.add(this.organRoot)
    scene.add(this.root)

    this.mode = 'bp3d' // 'bp3d' | 'hra'
    this.atlas = null
    this.hraManifest = null
    this.loader = new GLTFLoader()

    this.partMeshes = {}
    this.partById = {}
    this.organMeshes = {}
    this.organHitTargets = []
    this.systemMaterials = {}
    this.skinMeshes = []
    this.skinMaterials = []
    this.vesselPaths = []
    this.digestPath = []

    this._loadToken = 0
    this._loading = false
    this._baseScale = 1
    this._highlightedId = null
    this._conceptByElement = new Map()
    this._optionalLoaded = { vasculature: false, eyes: false }

    this._heartPivot = null
    this._lungPivots = { left: null, right: null }
    this._interiorIds = new Set()
    this._interiorGroupKey = null
    this._schematicGroup = null

    this._initMaterials()
    this.ready = this.reload()
  }

  _initMaterials() {
    for (const s of SYSTEMS) {
      const isSkin = s.id === 'integumentary'
      const mat = new THREE.MeshStandardMaterial({
        color: s.color,
        metalness: 0.08,
        roughness: 0.53,
        side: THREE.DoubleSide,
        transparent: isSkin,
        opacity: isSkin ? 0.12 : 1,
        depthWrite: !isSkin,
      })
      mat.userData.systemId = s.id
      mat.userData.baseColor = mat.color.clone()
      this.systemMaterials[s.id] = mat
    }
  }

  getFocusShortcuts() {
    return this.mode === 'hra' ? FEMALE_FOCUS_SHORTCUTS : FOCUS_SHORTCUTS
  }

  async setSex(sex) {
    const next = sex === 'female' ? 'female' : 'male'
    if (state.sex === next && !this._loading) {
      // still reload if mode mismatch
      if ((next === 'female') === (this.mode === 'hra')) return
    }
    state.sex = next
    state.referenceNote =
      next === 'female'
        ? 'Adult female organs (HuBMAP HRA · CC BY)'
        : 'Adult male reference (BodyParts3D 4.0 · CC BY)'
    state.focusedOrgan = null
    this.clearInteriorView()
    await this.reload()
  }

  async reload() {
    const token = ++this._loadToken
    this._loading = true
    this._clearContent()
    this._optionalLoaded = { vasculature: false, eyes: false }

    try {
      if (state.sex === 'female') {
        this.mode = 'hra'
        await this._loadHraFemale(token)
      } else {
        this.mode = 'bp3d'
        await this._loadBp3d(token)
      }
      if (token !== this._loadToken) return

      this._finalizePlacement()
      this.applyAnthropometrics()
      this.applyVisibleSystems(state.visibleSystems)
      this.setHealthVisual()
      if (this.mode === 'hra') this.setSkinMode(state.skinMode || 'hidden')
      this.vesselPaths = this._buildVesselPaths()
      this.digestPath = this._buildDigestPath()
      this._setupAnimPivots()
      this._loading = false
      this.onReady({
        organs: this.listOrganIds(),
        parts: this.atlas?.parts?.length || Object.keys(this.organMeshes).length,
        systems: SYSTEMS.map((s) => s.id),
        mode: this.mode,
        sex: state.sex,
      })
    } catch (err) {
      console.error('[Anatomy] load failed', err)
      this._loading = false
      this.onProgress({
        phase: 'error',
        loaded: 0,
        total: 1,
        fraction: 0,
        label: String(err.message || err),
      })
      throw err
    }
  }

  // ─── BodyParts3D (male) ───────────────────────────────────────────

  async _loadBp3d(token) {
    const atlas = await this._loadAtlas()
    if (token !== this._loadToken) return
    this.atlas = atlas
    this._indexConcepts(atlas)
    await this._loadAllChunks(atlas, token)
  }

  async _loadAtlas() {
    const urls = [`${CDN_BASE}/atlas.json`, `${LOCAL_BASE}/atlas.json`]
    let lastErr
    for (const url of urls) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`atlas ${res.status}`)
        const raw = await res.json()
        const base = url.startsWith(CDN_BASE) ? CDN_BASE : LOCAL_BASE
        this._assetBase = base
        return rewriteChunkUrls(raw, base)
      } catch (e) {
        lastErr = e
      }
    }
    throw new Error(
      `Could not load BodyParts3D atlas.json (CDN + local). ${lastErr?.message || ''}`
    )
  }

  _indexConcepts(atlas) {
    this._conceptByElement.clear()
    for (const c of atlas.concepts || []) {
      for (const el of c.elements || []) {
        if (!this._conceptByElement.has(el)) this._conceptByElement.set(el, c)
      }
    }
  }

  async _loadAllChunks(atlas, token) {
    const total = atlas.chunks.length
    let loaded = 0
    this.onProgress({
      phase: 'chunks',
      loaded: 0,
      total,
      fraction: 0,
      label: 'Starting BodyParts3D chunks…',
    })

    let cursor = 0
    const workers = Array.from({ length: PARALLEL_CHUNKS }, async () => {
      while (cursor < total) {
        if (token !== this._loadToken) return
        const ci = cursor++
        await this._loadChunk(atlas, ci)
        loaded++
        this.onProgress({
          phase: 'chunks',
          loaded,
          total,
          fraction: loaded / total,
          label: `Chunk ${loaded} / ${total}`,
        })
      }
    })
    await Promise.all(workers)
  }

  async _loadChunk(atlas, ci) {
    const chunk = atlas.chunks[ci]
    const compressed = !!chunk.gzip && typeof DecompressionStream !== 'undefined'
    const url = compressed ? chunk.gzip : chunk.url
    const response = await fetch(url)
    const buffer = await decodeModelResponse(response, chunk.bytes, compressed)

    for (const p of atlas.parts) {
      if (p.chunk !== ci) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3)
      )
      g.setAttribute(
        'normal',
        new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true)
      )
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1))
      g.computeBoundingSphere()
      g.computeBoundingBox()

      const mat = this.systemMaterials[p.system] || this.systemMaterials.skeletal
      const mesh = new THREE.Mesh(g, mat)
      mesh.name = p.id
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.frustumCulled = true
      mesh.userData.organId = p.id
      mesh.userData.partId = p.id
      mesh.userData.partName = p.name
      mesh.userData.system = p.system
      mesh.userData.conceptId = p.conceptId

      this.organRoot.add(mesh)
      this.partMeshes[p.id] = mesh
      this.organMeshes[p.id] = mesh
      this.partById[p.id] = p
      this.organHitTargets.push(mesh)
    }
  }

  // ─── HuBMAP HRA (female) ──────────────────────────────────────────

  async _loadHraFemale(token) {
    this.atlas = null
    if (!this.hraManifest) {
      const res = await fetch(HRA_MANIFEST_URL)
      if (!res.ok) throw new Error(`HRA manifest ${res.status}`)
      this.hraManifest = await res.json()
    }
    const entries = resolveHraEntries(this.hraManifest, HRA_CORE_LABELS)
    await this._loadHraEntries(entries, token, { phase: 'hra' })

    if (state.optionalVasculature) await this.loadOptional('vasculature')
    if (state.optionalEyes) await this.loadOptional('eyes')
  }

  async _loadHraEntries(entries, token, { phase }) {
    const total = entries.length
    let loaded = 0
    this.onProgress({
      phase,
      loaded: 0,
      total,
      fraction: 0,
      label: 'Starting HuBMAP HRA organs…',
    })

    const BATCH = 3
    for (let i = 0; i < entries.length; i += BATCH) {
      if (token !== this._loadToken) return
      const batch = entries.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (entry) => {
          await this._loadHraOne(entry)
          loaded += 1
          this.onProgress({
            phase,
            loaded,
            total,
            fraction: loaded / total,
            label: entry.label,
          })
        })
      )
    }
  }

  _loadHraOne(entry) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        entry.file,
        (gltf) => {
          try {
            this._integrateHraGltf(entry, gltf)
            resolve()
          } catch (e) {
            reject(e)
          }
        },
        undefined,
        (err) => reject(err)
      )
    })
  }

  _integrateHraGltf(entry, gltf) {
    const { id } = entry
    const model = gltf.scene
    model.name = id
    model.userData.organId = id
    model.userData.hraLabel = entry.label
    model.userData.system = HRA_ORGAN_SYSTEM[id] || 'digestive'
    model.userData.partName = HRA_ORGAN_META[id]?.name || entry.label

    model.traverse((c) => {
      if (!c.isMesh) return
      c.castShadow = false
      c.receiveShadow = false
      c.userData.organId = id
      c.userData.system = model.userData.system
      c.userData.partName = model.userData.partName

      const mats = Array.isArray(c.material) ? c.material : [c.material]
      for (const mat of mats) {
        if (!mat) continue
        mat.side = THREE.DoubleSide
        if (mat.roughness !== undefined) {
          mat.roughness = Math.min(0.85, Math.max(0.35, mat.roughness ?? 0.55))
        }
        if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness ?? 0, 0.08)
        mat.userData = mat.userData || {}
        mat.userData.baseOpacity = mat.opacity ?? 1
        mat.userData.baseTransparent = !!mat.transparent
      }

      if (id === 'skin') {
        this.skinMeshes.push(c)
        for (const mat of mats) {
          if (mat && !this.skinMaterials.includes(mat)) this.skinMaterials.push(mat)
        }
      } else {
        this.organHitTargets.push(c)
      }
    })

    if (this.organMeshes[id]) {
      this._disposeObject(this.organMeshes[id])
      this.organRoot.remove(this.organMeshes[id])
    }
    this.organRoot.add(model)
    this.organMeshes[id] = model
    this.partMeshes[id] = model
  }

  async loadOptional(kind) {
    if (this.mode !== 'hra' || this._optionalLoaded[kind]) return
    const labels = HRA_OPTIONAL[kind]
    if (!labels) return
    const token = this._loadToken
    const entries = resolveHraEntries(this.hraManifest, labels)
    if (!entries.length) return
    await this._loadHraEntries(entries, token, { phase: `optional:${kind}` })
    if (token !== this._loadToken) return
    this._optionalLoaded[kind] = true
    this._finalizePlacement()
    this.applyAnthropometrics()
    this.setSkinMode(state.skinMode || 'hidden')
    this.applyVisibleSystems(state.visibleSystems)
    this.vesselPaths = this._buildVesselPaths()
    this.digestPath = this._buildDigestPath()
    this._setupAnimPivots()
  }

  async unloadOptional(kind) {
    if (this.mode !== 'hra') return
    const ids =
      kind === 'eyes'
        ? ['leftEye', 'rightEye']
        : kind === 'vasculature'
          ? ['vasculature']
          : []
    for (const id of ids) {
      const obj = this.organMeshes[id]
      if (!obj) continue
      this._disposeObject(obj)
      this.organRoot.remove(obj)
      delete this.organMeshes[id]
      delete this.partMeshes[id]
    }
    this.organHitTargets = this.organHitTargets.filter(
      (m) => m.userData.organId && this.organMeshes[m.userData.organId]
    )
    this._optionalLoaded[kind] = false
    this.vesselPaths = this._buildVesselPaths()
  }

  async setOptional(kind, enabled) {
    if (kind === 'eyes') state.optionalEyes = enabled
    if (kind === 'vasculature') state.optionalVasculature = enabled
    if (enabled) await this.loadOptional(kind)
    else await this.unloadOptional(kind)
  }

  // ─── Shared helpers ───────────────────────────────────────────────

  _clearContent() {
    this.clearInteriorView()
    this._heartPivot = null
    this._lungPivots = { left: null, right: null }

    while (this.organRoot.children.length) {
      const c = this.organRoot.children[0]
      this.organRoot.remove(c)
      this._disposeObject(c)
    }
    this.partMeshes = {}
    this.organMeshes = {}
    this.partById = {}
    this.organHitTargets = []
    this.skinMeshes = []
    this.skinMaterials = []
    this.vesselPaths = []
    this.digestPath = []
    this._highlightedId = null
  }

  _disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.()
      if (this.mode === 'hra' && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          // Don't dispose shared system materials (bp3d)
          if (m && !Object.values(this.systemMaterials).includes(m)) {
            m.map?.dispose?.()
            m.dispose?.()
          }
        }
      }
    })
  }

  _finalizePlacement() {
    this.organRoot.position.set(0, 0, 0)
    this.organRoot.scale.set(1, 1, 1)
    this.organRoot.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(this.organRoot)
    if (box.isEmpty()) return

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const height = Math.max(size.y, 0.01)
    this._baseScale = TARGET_BODY_HEIGHT / height

    this.organRoot.position.set(
      -center.x * this._baseScale,
      -box.min.y * this._baseScale,
      -center.z * this._baseScale
    )
    this.organRoot.scale.setScalar(this._baseScale)
    this.organRoot.updateMatrixWorld(true)
  }

  applyVisibleSystems(systemIds) {
    const set = new Set(systemIds || state.visibleSystems)
    state.visibleSystems = [...set]

    if (this.mode === 'hra') {
      for (const [id, obj] of Object.entries(this.organMeshes)) {
        if (id === 'skin') {
          obj.visible = set.has('integumentary')
          continue
        }
        const sys = HRA_ORGAN_SYSTEM[id] || obj.userData.system
        obj.visible = set.has(sys)
      }
      return
    }

    for (const mesh of Object.values(this.partMeshes)) {
      const sys = mesh.userData.system
      // Keep interior-focused parts visible even if system toggled off
      if (this._interiorIds.has(mesh.userData.partId || mesh.userData.organId)) {
        mesh.visible = true
        continue
      }
      mesh.visible = set.has(sys)
    }
  }

  setSystemVisible(systemId, visible) {
    const set = new Set(state.visibleSystems)
    if (visible) set.add(systemId)
    else set.delete(systemId)
    this.applyVisibleSystems([...set])
  }

  applyPreset(presetSystems) {
    this.applyVisibleSystems(presetSystems)
  }

  findPartId(predicate) {
    if (this.mode === 'hra') {
      for (const [id, obj] of Object.entries(this.organMeshes)) {
        const name = obj.userData.partName || id
        if (predicate(name, { id, name, system: obj.userData.system })) return id
      }
      return null
    }
    if (!this.atlas) return null
    for (const p of this.atlas.parts) {
      if (predicate(p.name, p)) return p.id
    }
    return null
  }

  findPartByExactName(name) {
    return this.findPartId((n) => n === name)
  }

  resolveShortcut(shortcutId) {
    if (this.mode === 'hra') {
      const sc = FEMALE_FOCUS_SHORTCUTS.find((s) => s.id === shortcutId)
      return sc && this.organMeshes[sc.organId] ? sc.organId : null
    }
    const sc = FOCUS_SHORTCUTS.find((s) => s.id === shortcutId)
    if (!sc) return null
    return this.findPartId((n) => sc.match(n))
  }

  _partLocalCenter(part) {
    const [x, y, z] = partCenter(part)
    const v = new THREE.Vector3(x, y, z)
    this.organRoot.localToWorld(v)
    this.root.worldToLocal(v)
    return v
  }

  _buildVesselPaths() {
    if (this.mode === 'hra') {
      const heart = this.getOrganWorldPosition('heart')
      if (!heart) return []
      const toLocal = (w) => {
        const v = w.clone()
        this.root.worldToLocal(v)
        return v
      }
      const h = toLocal(heart)
      const pts = [h.clone()]
      for (const id of ['brain', 'rightKidney', 'leftKidney', 'bladder']) {
        const w = this.getOrganWorldPosition(id)
        if (w) pts.push(toLocal(w))
      }
      pts.push(h.clone())
      return [pts]
    }

    const heartId =
      this.findPartByExactName('Wall of ventricle') ||
      this.findPartByExactName('Cavity of left ventricle')
    const brainId = this.findPartByExactName('Cerebellum')
    const kidneyL = this.findPartByExactName('Left kidney')
    const kidneyR = this.findPartByExactName('Right kidney')
    const bladder = this.findPartByExactName('Urinary bladder')
    const heartPart = heartId && this.partById[heartId]
    if (!heartPart) return []

    const h = this._partLocalCenter(heartPart)
    const pts = [h.clone()]
    if (brainId && this.partById[brainId]) {
      const b = this._partLocalCenter(this.partById[brainId])
      pts.push(new THREE.Vector3().lerpVectors(h, b, 0.55), b)
    }
    if (kidneyR && this.partById[kidneyR]) pts.push(this._partLocalCenter(this.partById[kidneyR]))
    if (kidneyL && this.partById[kidneyL]) pts.push(this._partLocalCenter(this.partById[kidneyL]))
    if (bladder && this.partById[bladder]) pts.push(this._partLocalCenter(this.partById[bladder]))
    pts.push(h.clone())
    return [pts]
  }

  _buildDigestPath() {
    if (this.mode === 'hra') {
      const toLocal = (w) => {
        const v = w.clone()
        this.root.worldToLocal(v)
        return v
      }
      const pts = []
      const brain = this.getOrganWorldPosition('brain')
      const larynx = this.getOrganWorldPosition('larynx')
      const heart = this.getOrganWorldPosition('heart')
      const small = this.getOrganWorldPosition('smallIntestine')
      const large = this.getOrganWorldPosition('largeIntestine')
      const bladder = this.getOrganWorldPosition('bladder')
      if (brain && larynx) {
        const b = toLocal(brain)
        const l = toLocal(larynx)
        pts.push(new THREE.Vector3(b.x, b.y - 0.05, b.z + 0.08))
        pts.push(new THREE.Vector3(l.x, l.y, l.z + 0.04))
      } else if (larynx) {
        const l = toLocal(larynx)
        pts.push(l.clone().add(new THREE.Vector3(0, 0.08, 0.05)), l)
      }
      if (heart) pts.push(toLocal(heart).add(new THREE.Vector3(0.02, -0.05, 0.04)))
      if (small) pts.push(toLocal(small))
      if (large) pts.push(toLocal(large))
      if (bladder) pts.push(toLocal(bladder))
      if (pts.length < 2) {
        return [
          new THREE.Vector3(0, 1.5, 0.1),
          new THREE.Vector3(0, 1.0, 0.05),
          new THREE.Vector3(0, 0.55, 0.05),
          new THREE.Vector3(0, 0.25, 0.04),
        ]
      }
      return pts
    }

    const names = [
      'Esophagus',
      'Stomach',
      'Duodenum',
      'Proximal part of jejunum',
      'Middle part of jejunum',
      'Proximal part of ileum',
      'Ascending colon',
      'Transverse colon',
      'Descending colon',
      'Rectum',
    ]
    const pts = []
    const seen = new Set()
    for (const name of names) {
      const id = this.findPartByExactName(name)
      if (!id || seen.has(id) || !this.partById[id]) continue
      seen.add(id)
      pts.push(this._partLocalCenter(this.partById[id]))
    }
    if (pts.length < 2) {
      return [
        new THREE.Vector3(0, 1.5, 0.1),
        new THREE.Vector3(0, 1.0, 0.05),
        new THREE.Vector3(0, 0.55, 0.05),
        new THREE.Vector3(0, 0.25, 0.04),
      ]
    }
    return pts
  }

  getOrganWorldPosition(id) {
    const mesh = this.partMeshes[id] || this.organMeshes[id]
    if (!mesh) return null
    const box = new THREE.Box3().setFromObject(mesh)
    if (box.isEmpty()) {
      const v = new THREE.Vector3()
      mesh.getWorldPosition(v)
      return v
    }
    return box.getCenter(new THREE.Vector3())
  }

  getOrganFocusTarget(id) {
    const mesh = this.partMeshes[id] || this.organMeshes[id]
    if (!mesh) return null
    const pos = this.getOrganWorldPosition(id)
    if (!pos) return null
    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.y, size.z, 0.05)
    const dist = Math.max(0.35, radius * 3.2)

    if (this.mode === 'hra') {
      return {
        target: pos.clone(),
        camera: pos.clone().add(new THREE.Vector3(dist * 0.55, dist * 0.25, dist * 0.9)),
        label: HRA_ORGAN_META[id]?.name || mesh.userData.partName || id,
        concept: '',
        system: HRA_ORGAN_SYSTEM[id] || mesh.userData.system,
        explanation: explanationForHra(id),
      }
    }

    const part = this.partById[id]
    if (!part) return null
    const concept = this._conceptByElement.get(id)
    const label =
      concept && concept.name !== part.name ? `${part.name} · ${concept.name}` : part.name
    return {
      target: pos.clone(),
      camera: pos.clone().add(new THREE.Vector3(dist * 0.55, dist * 0.25, dist * 0.9)),
      label,
      concept: concept?.name || part.conceptId || '',
      system: part.system,
      explanation: explanationFor(part),
    }
  }

  listOrganIds() {
    if (this.mode === 'hra') {
      return Object.keys(this.organMeshes).filter((id) => id !== 'skin')
    }
    return Object.keys(this.partMeshes)
  }

  applyAnthropometrics() {
    const { height, girth } = bodyScaleFromAnthropometrics()
    this.root.scale.set(girth, height, girth)
  }

  setHealthVisual() {
    const mul = state.health === 'healthy' ? 1 : 0.82
    for (const mat of Object.values(this.systemMaterials)) {
      if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone()
      mat.color.copy(mat.userData.baseColor).multiplyScalar(mul)
      mat.needsUpdate = true
    }
    if (this.mode === 'hra') {
      const unhealthy = state.health !== 'healthy'
      for (const mat of this.skinMaterials) {
        if (mat.emissive) {
          mat.emissive.setHex(unhealthy ? 0x3a2a28 : 0x000000)
          mat.emissiveIntensity = unhealthy ? 0.04 : 0
        }
      }
    }
  }

  setSkinMode(mode) {
    state.skinMode = mode
    if (this.mode === 'hra') {
      const opacity = mode === 'hidden' ? 0 : mode === 'solid' ? 0.55 : 0.14
      const show = mode !== 'hidden'
      for (const mesh of this.skinMeshes) {
        mesh.visible = show
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          if (!mat) continue
          mat.transparent = true
          mat.opacity = opacity
          mat.depthWrite = false
          mat.needsUpdate = true
        }
      }
      if (this.organMeshes.skin) this.organMeshes.skin.visible = show
      this.setSystemVisible('integumentary', show)
      return
    }

    const mat = this.systemMaterials.integumentary
    if (!mat) return
    if (mode === 'hidden') {
      mat.opacity = 0
      mat.transparent = true
      mat.depthWrite = false
      this.setSystemVisible('integumentary', false)
    } else if (mode === 'solid') {
      mat.opacity = 0.55
      mat.transparent = true
      mat.depthWrite = false
      this.setSystemVisible('integumentary', true)
    } else {
      mat.opacity = 0.12
      mat.transparent = true
      mat.depthWrite = false
      this.setSystemVisible('integumentary', true)
    }
    mat.needsUpdate = true
  }

  // ─── Heartbeat / lung pivots (scale about bbox center) ────────────

  /**
   * Wrap object(s) in a Group positioned at their combined world bbox center
   * so scale animations expand about the anatomical center (not geometry origin).
   */
  _makeCenterPivot(objects, name) {
    const list = (Array.isArray(objects) ? objects : [objects]).filter(Boolean)
    if (!list.length) return null

    this.organRoot.updateMatrixWorld(true)
    const box = new THREE.Box3()
    for (const o of list) box.expandByObject(o)
    if (box.isEmpty()) return null

    const worldCenter = box.getCenter(new THREE.Vector3())
    const localCenter = worldCenter.clone()
    this.organRoot.worldToLocal(localCenter)

    const pivot = new THREE.Group()
    pivot.name = name
    this.organRoot.add(pivot)
    pivot.position.copy(localCenter)
    pivot.updateMatrixWorld(true)

    for (const o of list) {
      pivot.attach(o)
    }
    return pivot
  }

  _setupAnimPivots() {
    this._heartPivot = null
    this._lungPivots = { left: null, right: null }

    if (this.mode === 'hra') {
      if (this.organMeshes.heart) {
        this._heartPivot = this._makeCenterPivot(this.organMeshes.heart, 'heartPivot')
      }
      // HRA lung is one GLB — split bbox left/right by center X for gentle asymmetric breath
      const lung = this.organMeshes.lung
      if (lung) {
        this._lungPivots.left = this._makeCenterPivot(lung, 'lungPivot')
      }
      return
    }

    // Heart: wall of ventricle (+ atrium walls if present) under one pivot
    const heartMeshes = []
    for (const name of [
      'Wall of ventricle',
      'Wall of left atrium',
      'Wall of right atrium',
      'Cavity of left ventricle',
      'Cavity of right ventricle',
    ]) {
      const id = this.findPartByExactName(name)
      if (id && this.partMeshes[id]) heartMeshes.push(this.partMeshes[id])
    }
    if (heartMeshes.length) {
      this._heartPivot = this._makeCenterPivot(heartMeshes, 'heartPivot')
    }

    // Lungs: concept element sets
    const leftEls = this._conceptElements('FMA7310')
    const rightEls = this._conceptElements('FMA7309')
    if (leftEls.length) {
      this._lungPivots.left = this._makeCenterPivot(leftEls, 'leftLungPivot')
    }
    if (rightEls.length) {
      this._lungPivots.right = this._makeCenterPivot(rightEls, 'rightLungPivot')
    }
  }

  _conceptElements(conceptId) {
    if (!this.atlas) return []
    const concept = (this.atlas.concepts || []).find((c) => c.id === conceptId)
    if (!concept) return []
    const out = []
    for (const el of concept.elements || []) {
      const m = this.partMeshes[el]
      if (m) out.push(m)
    }
    return out
  }

  update(dt, time) {
    // Heartbeat — scale about pivot center (stays inside ribcage)
    if (this._heartPivot) {
      const bpm = state.heartRate
      const freq = (bpm / 60) * state.simSpeed
      const pulse = Math.max(0, Math.sin(time * freq * Math.PI * 2)) ** 2
      const beat = 1 + HEART_BEAT_AMP * pulse
      this._heartPivot.scale.setScalar(beat)
    }

    // Lung breathing — gentle expand/contract on respiratory rhythm
    const breathHz = (14 / 60) * state.simSpeed // ~14 breaths/min
    const breath = Math.sin(time * breathHz * Math.PI * 2)
    const lungScale = 1 + LUNG_BREATH_AMP * breath
    // Slight phase offset between sides looks more natural
    if (this._lungPivots.left) {
      this._lungPivots.left.scale.set(lungScale, lungScale * 1.02, lungScale)
    }
    if (this._lungPivots.right) {
      const s = 1 + LUNG_BREATH_AMP * Math.sin(time * breathHz * Math.PI * 2 + 0.15)
      this._lungPivots.right.scale.set(s, s * 1.02, s)
    }

    const gutActivity = state.digestion.gutActivity
    if (gutActivity > 0.05 && this.mode === 'bp3d') {
      const sid = this.findPartByExactName('Stomach')
      const stomach = sid && this.partMeshes[sid]
      if (stomach) {
        stomach.rotation.z = Math.sin(time * 1.8 * state.simSpeed) * 0.015 * gutActivity
      }
    }
  }

  // ─── Interior / cutaway on focus ──────────────────────────────────

  /**
   * Resolve clickable inner parts for a focused organ id.
   * @returns {{ groupKey: string, items: Array<{id:string,label:string,tip:string,schematic?:boolean,partId?:string}> }}
   */
  getInnerPartsForFocus(focusId) {
    if (this.mode === 'hra') {
      const key =
        focusId === 'heart'
          ? 'heart'
          : focusId === 'lung'
            ? 'lung'
            : focusId === 'smallIntestine'
              ? 'smallIntestine'
              : focusId === 'largeIntestine'
                ? 'largeIntestine'
                : focusId === 'liver'
                  ? 'liver'
                  : focusId === 'leftKidney' || focusId === 'rightKidney'
                    ? focusId
                    : focusId === 'uterus'
                      ? 'uterus'
                      : null
      const schematic = key && HRA_INNER_SCHEMATICS[key]
      if (!schematic) return { groupKey: null, items: [] }

      // Prefer child mesh names from the GLB when present
      const root = this.organMeshes[focusId]
      const childItems = []
      if (root) {
        root.traverse((c) => {
          if (!c.isMesh || c === root) return
          const n = (c.name || '').trim()
          if (n && n.length > 1 && n !== focusId) {
            childItems.push({
              id: `child:${c.uuid}`,
              label: n.replace(/_/g, ' '),
              tip: 'Sub-mesh from the HRA organ model.',
              partId: focusId,
              meshUuid: c.uuid,
            })
          }
        })
      }
      if (childItems.length >= 2) {
        return { groupKey: key, items: childItems.slice(0, 12) }
      }
      return {
        groupKey: key,
        items: schematic.map((s) => ({ ...s, schematic: true })),
      }
    }

    const part = this.partById[focusId]
    if (!part) return { groupKey: null, items: [] }
    const groupKey = innerGroupForPartName(part.name)
    if (!groupKey) return { groupKey: null, items: [] }
    const group = INNER_PART_GROUPS[groupKey]
    const items = []
    for (const p of group.parts) {
      if (p.schematic) {
        items.push({
          id: `schematic:${p.label}`,
          label: p.label,
          tip: p.tip,
          schematic: true,
        })
        continue
      }
      const id = this.findPartId((n) => p.match(n))
      if (!id) continue
      items.push({
        id: `part:${id}`,
        label: p.label,
        tip: p.tip,
        partId: id,
      })
    }
    return { groupKey, items }
  }

  enterInteriorView(focusId) {
    this.clearInteriorView()
    const { groupKey, items } = this.getInnerPartsForFocus(focusId)
    this._interiorGroupKey = groupKey
    if (!groupKey || !items.length) return items

    if (this.mode === 'bp3d') {
      // Soften outer wall; emphasize inner meshes
      for (const item of items) {
        if (!item.partId) continue
        const mesh = this.partMeshes[item.partId]
        if (!mesh) continue
        this._interiorIds.add(item.partId)
        mesh.visible = true
        const base = this.systemMaterials[mesh.userData.system] || this.systemMaterials.skeletal
        const hl = base.clone()
        hl.emissive = new THREE.Color(0x5ec4ff)
        hl.emissiveIntensity = 0.35
        hl.transparent = true
        hl.opacity = 0.92
        mesh.userData._interiorMat = hl
        mesh.material = hl
      }
      // Make seed organ slightly translucent to peek inside
      const seed = this.partMeshes[focusId]
      if (seed && seed.material && !seed.userData._interiorMat) {
        const base = this.systemMaterials[seed.userData.system] || seed.material
        const soft = base.clone()
        soft.transparent = true
        soft.opacity = 0.35
        soft.depthWrite = false
        soft.emissive = new THREE.Color(0x224466)
        soft.emissiveIntensity = 0.08
        seed.userData._interiorShellMat = soft
        seed.material = soft
        this._interiorIds.add(focusId)
      }
    } else {
      // HRA: translucent shell + floating educational layer markers
      const root = this.organMeshes[focusId]
      if (root) {
        root.traverse((c) => {
          if (!c.isMesh) return
          const mats = Array.isArray(c.material) ? c.material : [c.material]
          for (const mat of mats) {
            if (!mat) continue
            if (!mat.userData._savedForInterior) {
              mat.userData._savedForInterior = {
                opacity: mat.opacity,
                transparent: mat.transparent,
                depthWrite: mat.depthWrite,
              }
            }
            mat.transparent = true
            mat.opacity = Math.min(mat.userData._savedForInterior.opacity ?? 1, 0.45)
            mat.depthWrite = false
            mat.needsUpdate = true
          }
        })
      }
      this._spawnSchematicMarkers(focusId, items.filter((i) => i.schematic))
    }

    return items
  }

  _spawnSchematicMarkers(focusId, items) {
    this._clearSchematic()
    const pos = this.getOrganWorldPosition(focusId)
    if (!pos || !items.length) return

    const group = new THREE.Group()
    group.name = 'schematicLayers'
    this.scene.add(group)
    this._schematicGroup = group

    const colors = [0x7ec8e3, 0xe6c07b, 0x6ecf8e, 0xe07a7a, 0xb0a0e0, 0xd4b85a]
    items.forEach((item, i) => {
      const geo = new THREE.SphereGeometry(0.012, 10, 8)
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
      const ball = new THREE.Mesh(geo, mat)
      const angle = (i / items.length) * Math.PI * 2
      const r = 0.08 + (i % 3) * 0.02
      ball.position.set(
        pos.x + Math.cos(angle) * r,
        pos.y + 0.02 * (i % 2) + i * 0.012,
        pos.z + Math.sin(angle) * r
      )
      ball.userData.schematicLabel = item.label
      group.add(ball)

      // Tiny sprite label
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'rgba(18,26,43,0.85)'
      ctx.roundRect?.(8, 8, 240, 48, 8)
      if (!ctx.roundRect) {
        ctx.fillRect(8, 8, 240, 48)
      } else {
        ctx.fill()
      }
      ctx.fillStyle = '#e8eefc'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(item.label.slice(0, 28), 128, 40)
      const tex = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
      )
      sprite.scale.set(0.18, 0.045, 1)
      sprite.position.copy(ball.position).add(new THREE.Vector3(0, 0.03, 0))
      group.add(sprite)
    })
  }

  _clearSchematic() {
    if (!this._schematicGroup) return
    this._schematicGroup.traverse((o) => {
      o.geometry?.dispose?.()
      if (o.material) {
        o.material.map?.dispose?.()
        o.material.dispose?.()
      }
    })
    this.scene.remove(this._schematicGroup)
    this._schematicGroup = null
  }

  clearInteriorView() {
    this._clearSchematic()
    if (this.mode === 'bp3d') {
      for (const id of this._interiorIds) {
        const mesh = this.partMeshes[id]
        if (!mesh) continue
        if (mesh.userData._interiorMat) {
          mesh.userData._interiorMat.dispose()
          delete mesh.userData._interiorMat
        }
        if (mesh.userData._interiorShellMat) {
          mesh.userData._interiorShellMat.dispose()
          delete mesh.userData._interiorShellMat
        }
        const sys = mesh.userData.system
        mesh.material = this.systemMaterials[sys] || this.systemMaterials.skeletal
      }
    } else {
      for (const obj of Object.values(this.organMeshes)) {
        obj.traverse((c) => {
          if (!c.isMesh) return
          const mats = Array.isArray(c.material) ? c.material : [c.material]
          for (const mat of mats) {
            const saved = mat?.userData?._savedForInterior
            if (!saved) continue
            mat.opacity = saved.opacity
            mat.transparent = saved.transparent
            mat.depthWrite = saved.depthWrite
            delete mat.userData._savedForInterior
            mat.needsUpdate = true
          }
        })
      }
    }
    this._interiorIds.clear()
    this._interiorGroupKey = null
    this.applyVisibleSystems(state.visibleSystems)
  }

  focusInnerPart(item) {
    if (!item) return
    if (item.partId && this.partMeshes[item.partId]) {
      this.highlightOrgan(item.partId)
      return this.getOrganFocusTarget(item.partId)
    }
    return null
  }

  highlightOrgan(id) {
    if (this._highlightedId && this.partMeshes[this._highlightedId]) {
      const prev = this.partMeshes[this._highlightedId]
      if (prev.userData._hlMat) {
        prev.userData._hlMat.dispose()
        delete prev.userData._hlMat
      }
      if (this.mode === 'bp3d' && !prev.userData._interiorMat && !prev.userData._interiorShellMat) {
        const sys = prev.userData.system
        prev.material = this.systemMaterials[sys] || this.systemMaterials.skeletal
      }
    }

    this._highlightedId = id
    if (!id || !this.partMeshes[id]) return

    const mesh = this.partMeshes[id]
    if (this.mode === 'hra') {
      // Emissive nudge on HRA materials
      mesh.traverse?.((c) => {
        if (!c.isMesh) return
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        for (const mat of mats) {
          if (mat?.emissive) {
            mat.emissive.setHex(0x3ecf8e)
            mat.emissiveIntensity = 0.35
          }
        }
      })
      const sys = HRA_ORGAN_SYSTEM[id] || mesh.userData.system
      if (sys && !state.visibleSystems.includes(sys)) this.setSystemVisible(sys, true)
      return
    }

    if (mesh.userData._interiorMat || mesh.userData._interiorShellMat) return

    const base = this.systemMaterials[mesh.userData.system] || this.systemMaterials.skeletal
    const hl = base.clone()
    hl.emissive = new THREE.Color(0x3ecf8e)
    hl.emissiveIntensity = 0.45
    hl.color = base.color.clone().lerp(new THREE.Color(0xffffff), 0.25)
    mesh.userData._hlMat = hl
    mesh.material = hl

    if (!state.visibleSystems.includes(mesh.userData.system)) {
      this.setSystemVisible(mesh.userData.system, true)
    }
  }

  clearHighlight() {
    if (this.mode === 'hra' && this._highlightedId) {
      const mesh = this.partMeshes[this._highlightedId]
      mesh?.traverse?.((c) => {
        if (!c.isMesh) return
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        for (const mat of mats) {
          if (mat?.emissive) {
            mat.emissive.setHex(0x000000)
            mat.emissiveIntensity = 0
          }
        }
      })
    }
    this.highlightOrgan(null)
  }
}
