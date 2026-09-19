import * as THREE from 'three'
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
} from './bp3dAtlas.js'

export { SYSTEMS, SYSTEM_BY_ID, DEFAULT_VISIBLE, FOCUS_SHORTCUTS }
export const ORGAN_META = {} // legacy alias — focus shortcuts fill UI instead
export const SYSTEM_LABELS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.name]))

const TARGET_BODY_HEIGHT = 1.7
const PARALLEL_CHUNKS = 3

/**
 * Anatomy body from BodyParts3D 4.0 (adult male reference).
 * Geometry packaged by ashemag/human-atlas — CC BY 4.0 (DBCLS).
 */
export class AnatomyBody {
  constructor(scene, options = {}) {
    this.scene = scene
    this.onProgress = options.onProgress || (() => {})
    this.onReady = options.onReady || (() => {})

    this.root = new THREE.Group()
    this.root.name = 'bodyRoot'
    this.organRoot = new THREE.Group()
    this.organRoot.name = 'bp3dParts'
    this.root.add(this.organRoot)
    scene.add(this.root)

    this.atlas = null
    this.partMeshes = {} // id -> Mesh
    this.partById = {}
    this.organMeshes = {} // alias for digestion/blood compat (id -> Mesh)
    this.organHitTargets = []
    this.systemMaterials = {}
    this.vesselPaths = []
    this.digestPath = []
    this._loadToken = 0
    this._loading = false
    this._baseScale = 1
    this._highlightedId = null
    this._conceptByElement = new Map()
    this._cachedHeartId = null
    this._cachedStomachId = null

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

  async reload() {
    const token = ++this._loadToken
    this._loading = true
    this._clearContent()

    try {
      const atlas = await this._loadAtlas()
      if (token !== this._loadToken) return
      this.atlas = atlas
      this._indexConcepts(atlas)

      await this._loadAllChunks(atlas, token)
      if (token !== this._loadToken) return

      this._finalizePlacement()
      this.applyAnthropometrics()
      this.applyVisibleSystems(state.visibleSystems)
      this.setHealthVisual()
      this.vesselPaths = this._buildVesselPaths()
      this.digestPath = this._buildDigestPath()
      this._cachedHeartId = this.findPartByExactName('Wall of ventricle')
      this._cachedStomachId = this.findPartByExactName('Stomach')
      this._loading = false
      this.onReady({
        organs: this.listOrganIds(),
        parts: atlas.parts.length,
        systems: SYSTEMS.map((s) => s.id),
      })
    } catch (err) {
      console.error('[BP3D] load failed', err)
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

  _clearContent() {
    while (this.organRoot.children.length) {
      const c = this.organRoot.children[0]
      this.organRoot.remove(c)
      this._disposeObject(c)
    }
    this.partMeshes = {}
    this.organMeshes = {}
    this.partById = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []
    this._highlightedId = null
  }

  _disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.()
      // System materials are shared — do not dispose here
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
    for (const mesh of Object.values(this.partMeshes)) {
      const sys = mesh.userData.system
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
    const sc = FOCUS_SHORTCUTS.find((s) => s.id === shortcutId)
    if (!sc) return null
    return this.findPartId((n) => sc.match(n))
  }

  _partLocalCenter(part) {
    const [x, y, z] = partCenter(part)
    // Part bounds are in atlas space (pre organRoot transform). Convert via organRoot.
    const v = new THREE.Vector3(x, y, z)
    this.organRoot.localToWorld(v)
    this.root.worldToLocal(v)
    return v
  }

  _buildVesselPaths() {
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
    const mesh = this.partMeshes[id]
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
    const mesh = this.partMeshes[id]
    const part = this.partById[id]
    if (!mesh || !part) return null
    const pos = this.getOrganWorldPosition(id)
    if (!pos) return null
    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.y, size.z, 0.05)
    const dist = Math.max(0.35, radius * 3.2)
    const concept = this._conceptByElement.get(id)
    const label = concept && concept.name !== part.name
      ? `${part.name} · ${concept.name}`
      : part.name
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
  }

  /** Skin / integumentary opacity helper (keeps system toggle as source of truth). */
  setSkinMode(mode) {
    state.skinMode = mode
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

  update(dt, time) {
    const heart = this._cachedHeartId && this.partMeshes[this._cachedHeartId]
    if (heart) {
      const bpm = state.heartRate
      const freq = (bpm / 60) * state.simSpeed
      const beat = 1 + 0.04 * Math.max(0, Math.sin(time * freq * Math.PI * 2)) ** 2
      heart.scale.setScalar(beat)
    }

    const gutActivity = state.digestion.gutActivity
    if (gutActivity > 0.05) {
      const stomach = this._cachedStomachId && this.partMeshes[this._cachedStomachId]
      if (stomach) {
        stomach.rotation.z = Math.sin(time * 1.8 * state.simSpeed) * 0.015 * gutActivity
      }
    }
  }

  highlightOrgan(id) {
    // Restore previous
    if (this._highlightedId && this.partMeshes[this._highlightedId]) {
      const prev = this.partMeshes[this._highlightedId]
      const sys = prev.userData.system
      if (prev.userData._hlMat) {
        prev.userData._hlMat.dispose()
        delete prev.userData._hlMat
      }
      prev.material = this.systemMaterials[sys] || this.systemMaterials.skeletal
    }

    this._highlightedId = id
    if (!id || !this.partMeshes[id]) return

    const mesh = this.partMeshes[id]
    const base = this.systemMaterials[mesh.userData.system] || this.systemMaterials.skeletal
    const hl = base.clone()
    hl.emissive = new THREE.Color(0x3ecf8e)
    hl.emissiveIntensity = 0.45
    hl.color = base.color.clone().lerp(new THREE.Color(0xffffff), 0.25)
    mesh.userData._hlMat = hl
    mesh.material = hl

    // Ensure highlighted system is visible
    if (!state.visibleSystems.includes(mesh.userData.system)) {
      this.setSystemVisible(mesh.userData.system, true)
    }
  }

  clearHighlight() {
    this.highlightOrgan(null)
  }
}
