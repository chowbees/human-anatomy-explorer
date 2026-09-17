import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { state, bodyScaleFromAnthropometrics } from './state.js'
import {
  ORGAN_META,
  SYSTEM_LABELS,
  coreLabelsForSex,
  OPTIONAL_LABELS,
  resolveEntries,
} from './hraCatalog.js'

export { ORGAN_META, SYSTEM_LABELS }

const MANIFEST_URL = `${import.meta.env.BASE_URL}models/hra-manifest.json`
/** HRA Visible Human organs are already in meters; fit assembled body to ~1.7 scene units. */
const TARGET_BODY_HEIGHT = 1.7

/**
 * Anatomy body assembled from HuBMAP HRA reference organ GLBs (CDN).
 * CC BY 4.0 — https://humanatlas.io/3d-reference-library
 */
export class AnatomyBody {
  constructor(scene, options = {}) {
    this.scene = scene
    this.onProgress = options.onProgress || (() => {})
    this.onReady = options.onReady || (() => {})

    this.root = new THREE.Group()
    this.root.name = 'bodyRoot'
    this.organRoot = new THREE.Group()
    this.organRoot.name = 'hraOrgans'
    this.root.add(this.organRoot)
    scene.add(this.root)

    this.loader = new GLTFLoader()
    this.manifest = null
    this.skinMeshes = []
    this.skinMaterials = []
    this.organMeshes = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []
    this._loading = false
    this._loadToken = 0
    this._optionalLoaded = { vasculature: false, eyes: false }
    this._baseScale = 1
    this._placementOffset = new THREE.Vector3()

    this.ready = this.reload()
  }

  async _ensureManifest() {
    if (this.manifest) return this.manifest
    const res = await fetch(MANIFEST_URL)
    if (!res.ok) throw new Error(`Failed to load HRA manifest (${res.status})`)
    this.manifest = await res.json()
    return this.manifest
  }

  /**
   * Load (or reload) the core organ set for the current sex.
   */
  async reload() {
    const token = ++this._loadToken
    this._loading = true
    this._optionalLoaded = { vasculature: false, eyes: false }
    this._clearContent()

    try {
      const manifest = await this._ensureManifest()
      if (token !== this._loadToken) return

      const labels = coreLabelsForSex(state.sex)
      const entries = resolveEntries(manifest, state.sex, labels)
      await this._loadEntries(entries, token, { phase: 'core' })
      if (token !== this._loadToken) return

      this._finalizePlacement()
      this.applyAnthropometrics()
      this.setSkinMode(state.skinMode || 'translucent')
      this.setHealthVisual()
      this.vesselPaths = this._buildVesselPaths()
      this.digestPath = this._buildDigestPath()
      this._loading = false
      this.onReady({ organs: this.listOrganIds() })
    } catch (err) {
      console.error('[HRA] load failed', err)
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

  async loadOptional(kind) {
    if (this._optionalLoaded[kind]) return
    const labels = OPTIONAL_LABELS[kind]
    if (!labels) return

    const token = this._loadToken
    const manifest = await this._ensureManifest()
    const entries = resolveEntries(manifest, state.sex, labels)
    if (!entries.length) return

    await this._loadEntries(entries, token, { phase: `optional:${kind}` })
    if (token !== this._loadToken) return

    this._optionalLoaded[kind] = true
    // Re-fit so late-loaded eyes/vasculature stay aligned with core placement
    this._finalizePlacement()
    this.applyAnthropometrics()
    this.setSkinMode(state.skinMode || 'translucent')
    this.setHealthVisual()
    this.vesselPaths = this._buildVesselPaths()
    this.digestPath = this._buildDigestPath()
    this.onReady({ organs: this.listOrganIds() })
  }

  async unloadOptional(kind) {
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
    }
    this.organHitTargets = this.organHitTargets.filter(
      (m) => m.userData.organId && this.organMeshes[m.userData.organId]
    )
    this._optionalLoaded[kind] = false
    this.vesselPaths = this._buildVesselPaths()
    this.onReady({ organs: this.listOrganIds() })
  }

  async setOptional(kind, enabled) {
    if (enabled) await this.loadOptional(kind)
    else await this.unloadOptional(kind)
  }

  _clearContent() {
    while (this.organRoot.children.length) {
      const c = this.organRoot.children[0]
      this.organRoot.remove(c)
      this._disposeObject(c)
    }
    this.skinMeshes = []
    this.skinMaterials = []
    this.organMeshes = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []
  }

  _disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          m.map?.dispose?.()
          m.dispose?.()
        }
      }
    })
  }

  async _loadEntries(entries, token, { phase }) {
    const total = entries.length
    let loaded = 0
    this.onProgress({
      phase,
      loaded: 0,
      total,
      fraction: 0,
      label: 'Starting…',
    })

    // Load in small parallel batches so progress is visible and CDN isn't slammed
    const BATCH = 3
    for (let i = 0; i < entries.length; i += BATCH) {
      if (token !== this._loadToken) return
      const batch = entries.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (entry) => {
          await this._loadOne(entry, (fileFrac, label) => {
            const overall = (loaded + fileFrac) / total
            this.onProgress({
              phase,
              loaded,
              total,
              fraction: Math.min(0.999, overall),
              label,
            })
          })
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

  _loadOne(entry, onFileProgress) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        entry.file,
        (gltf) => {
          try {
            this._integrateGltf(entry, gltf)
            resolve()
          } catch (e) {
            reject(e)
          }
        },
        (evt) => {
          if (evt.total > 0) {
            onFileProgress(evt.loaded / evt.total, entry.label)
          } else {
            onFileProgress(0.15, entry.label)
          }
        },
        (err) => reject(err)
      )
    })
  }

  _integrateGltf(entry, gltf) {
    const { id } = entry
    const model = gltf.scene
    model.name = id
    model.userData.organId = id
    model.userData.hraLabel = entry.label

    model.traverse((c) => {
      if (!c.isMesh) return
      c.castShadow = false
      c.receiveShadow = false
      c.userData.organId = id

      // Soften materials for classroom viewing (keep realistic, not cartoon)
      const mats = Array.isArray(c.material) ? c.material : [c.material]
      for (const mat of mats) {
        if (!mat) continue
        mat.side = THREE.DoubleSide
        if (mat.roughness !== undefined) mat.roughness = Math.min(0.85, Math.max(0.35, mat.roughness ?? 0.55))
        if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness ?? 0, 0.08)
        if (mat.emissive && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = Math.min(mat.emissiveIntensity || 0.02, 0.06)
        }
        // Store original opacity for skin mode
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

    // Replace prior instance of same id if any
    if (this.organMeshes[id]) {
      this._disposeObject(this.organMeshes[id])
      this.organRoot.remove(this.organMeshes[id])
    }

    this.organRoot.add(model)
    this.organMeshes[id] = model
  }

  /**
   * Uniform scale + ground the assembled HRA set (shared VH meter space).
   */
  _finalizePlacement() {
    // Reset before measuring
    this.organRoot.position.set(0, 0, 0)
    this.organRoot.scale.set(1, 1, 1)
    this.organRoot.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(this.organRoot)
    if (box.isEmpty()) return

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const height = Math.max(size.y, 0.01)
    this._baseScale = TARGET_BODY_HEIGHT / height

    // Center XZ on origin, put feet on y=0, then uniform scale about that pivot
    this.organRoot.position.set(
      -center.x * this._baseScale,
      -box.min.y * this._baseScale,
      -center.z * this._baseScale
    )
    this.organRoot.scale.setScalar(this._baseScale)
    this.organRoot.updateMatrixWorld(true)

    this._placementOffset.set(
      -center.x * this._baseScale,
      -box.min.y * this._baseScale,
      -center.z * this._baseScale
    )
  }

  _buildVesselPaths() {
    // Prefer a simple path derived from heart → body landmarks when vasculature GLB is present or not
    const heart = this.getOrganWorldPosition('heart')
    const brain = this.getOrganWorldPosition('brain')
    const liver = this.getOrganWorldPosition('liver')
    const bladder = this.getOrganWorldPosition('bladder')
    const leftK = this.getOrganWorldPosition('leftKidney')
    const rightK = this.getOrganWorldPosition('rightKidney')

    if (!heart) return []

    const toLocal = (w) => {
      const v = w.clone()
      this.root.worldToLocal(v)
      return v
    }

    const h = toLocal(heart)
    const pts = [h.clone()]
    if (brain) {
      const b = toLocal(brain)
      pts.push(new THREE.Vector3().lerpVectors(h, b, 0.55))
      pts.push(b)
    }
    if (rightK) pts.push(toLocal(rightK))
    if (liver) pts.push(toLocal(liver))
    if (bladder) pts.push(toLocal(bladder))
    if (leftK) pts.push(toLocal(leftK))
    pts.push(h.clone())

    // Convert world-derived locals that already include root scale; rebuild after anthropometrics uses root
    // Paths are stored in body-root local space (pre-anthropometric? actually after placement in organRoot).
    // BloodFlow converts via body.root.localToWorld — store in root local.
    return [pts]
  }

  _buildDigestPath() {
    const brain = this.getOrganWorldPosition('brain')
    const larynx = this.getOrganWorldPosition('larynx')
    const heart = this.getOrganWorldPosition('heart')
    const small = this.getOrganWorldPosition('smallIntestine')
    const large = this.getOrganWorldPosition('largeIntestine')
    const bladder = this.getOrganWorldPosition('bladder')

    const toLocal = (w) => {
      const v = w.clone()
      this.root.worldToLocal(v)
      return v
    }

    const pts = []
    // Approximate mouth above larynx / front of head
    if (brain && larynx) {
      const b = toLocal(brain)
      const l = toLocal(larynx)
      pts.push(new THREE.Vector3(b.x, b.y - 0.05, b.z + 0.08))
      pts.push(new THREE.Vector3(l.x, l.y, l.z + 0.04))
    } else if (larynx) {
      const l = toLocal(larynx)
      pts.push(l.clone().add(new THREE.Vector3(0, 0.08, 0.05)))
      pts.push(l)
    }
    if (heart) {
      const h = toLocal(heart)
      pts.push(h.clone().add(new THREE.Vector3(0.02, -0.05, 0.04)))
    }
    if (small) pts.push(toLocal(small))
    if (large) pts.push(toLocal(large))
    if (bladder) pts.push(toLocal(bladder))

    if (pts.length < 2) {
      // Fallback vertical path
      return [
        new THREE.Vector3(0, 1.5, 0.1),
        new THREE.Vector3(0, 1.0, 0.05),
        new THREE.Vector3(0, 0.5, 0.05),
        new THREE.Vector3(0, 0.2, 0.04),
      ]
    }
    return pts
  }

  getOrganWorldPosition(id) {
    const obj = this.organMeshes[id]
    if (!obj) return null
    const box = new THREE.Box3().setFromObject(obj)
    if (box.isEmpty()) {
      const v = new THREE.Vector3()
      obj.getWorldPosition(v)
      return v
    }
    return box.getCenter(new THREE.Vector3())
  }

  getOrganFocusTarget(id) {
    const pos = this.getOrganWorldPosition(id)
    if (!pos) return null
    const box = new THREE.Box3().setFromObject(this.organMeshes[id])
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.y, size.z, 0.08)
    const dist = Math.max(0.45, radius * 2.8)
    return {
      target: pos.clone(),
      camera: pos.clone().add(new THREE.Vector3(dist * 0.55, dist * 0.25, dist * 0.9)),
      label: ORGAN_META[id]?.name || id,
    }
  }

  listOrganIds() {
    return Object.keys(this.organMeshes).filter((id) => id !== 'skin')
  }

  applyAnthropometrics() {
    const { height, girth } = bodyScaleFromAnthropometrics()
    this.root.scale.set(girth, height, girth)
  }

  applySkinTone() {
    // HRA skin keeps atlas materials; health only nudges emissive slightly on skin
    const unhealthy = state.health !== 'healthy'
    for (const mat of this.skinMaterials) {
      if (mat.emissive) {
        mat.emissive.setHex(unhealthy ? 0x3a2a28 : 0x000000)
        mat.emissiveIntensity = unhealthy ? 0.04 : 0.0
      }
    }
  }

  /** translucent | solid | hidden — drives HRA skin GLB materials */
  setSkinMode(mode) {
    state.skinMode = mode
    const map = { translucent: 0.28, solid: 0.72, hidden: 0 }
    const opacity = map[mode] ?? 0.28

    for (const mesh of this.skinMeshes) {
      mesh.visible = opacity > 0.01
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (!mat) continue
        mat.transparent = opacity < 0.95
        mat.opacity = opacity
        mat.depthWrite = opacity >= 0.65
        if (mat.transmission !== undefined) {
          mat.transmission = mode === 'solid' ? 0.02 : mode === 'translucent' ? 0.12 : 0
        }
        mat.needsUpdate = true
      }
    }
  }

  async setSex(sex) {
    if (state.sex === sex && !this._loading) return
    state.sex = sex
    await this.reload()
  }

  setHealthVisual() {
    this.applySkinTone()
    const tintHealthy = 1
    const tintUnhealthy = 0.82
    const mul = state.health === 'healthy' ? tintHealthy : tintUnhealthy

    for (const [id, obj] of Object.entries(this.organMeshes)) {
      if (id === 'skin') continue
      obj.traverse((c) => {
        if (!c.isMesh || !c.material) return
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        for (const mat of mats) {
          if (!mat?.color) continue
          if (!mat.userData.baseColor) {
            mat.userData.baseColor = mat.color.clone()
          }
          mat.color.copy(mat.userData.baseColor).multiplyScalar(mul)
          if (mat.emissiveIntensity !== undefined) {
            const baseE =
              id === 'heart'
                ? state.health === 'healthy'
                  ? 0.08
                  : 0.02
                : 0.03
            mat.userData.baseEmissive = baseE
            mat.emissiveIntensity = baseE
          }
        }
      })
    }
  }

  update(dt, time) {
    const heart = this.organMeshes.heart
    if (heart) {
      const bpm = state.heartRate
      const freq = (bpm / 60) * state.simSpeed
      const beat = 1 + 0.045 * Math.max(0, Math.sin(time * freq * Math.PI * 2)) ** 2
      // Pulse about local center without fighting placement scale
      heart.scale.setScalar(beat)
    }

    const lung = this.organMeshes.lung
    if (lung) {
      const breathe = 1 + 0.025 * Math.sin(time * 1.2 * state.simSpeed)
      lung.scale.set(breathe, 1 + (breathe - 1) * 1.2, breathe)
    }

    const gutActivity = state.digestion.gutActivity
    if (gutActivity > 0.05) {
      const small = this.organMeshes.smallIntestine
      const large = this.organMeshes.largeIntestine
      if (small) {
        small.rotation.y = Math.sin(time * 2 * state.simSpeed) * 0.02 * gutActivity
      }
      if (large) {
        large.rotation.y = Math.sin(time * 1.5 * state.simSpeed + 1) * 0.015 * gutActivity
      }
    }
  }

  highlightOrgan(id) {
    for (const [oid, mesh] of Object.entries(this.organMeshes)) {
      if (oid === 'skin') continue
      mesh.traverse((c) => {
        if (!c.isMesh || !c.material) return
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        for (const mat of mats) {
          if (mat.emissiveIntensity === undefined) continue
          const base = mat.userData.baseEmissive ?? 0.03
          if (oid === id) {
            mat.emissiveIntensity = 0.28
            if (mat.emissive && mat.color) {
              if (!mat.userData.savedEmissive) mat.userData.savedEmissive = mat.emissive.clone()
              mat.emissive.copy(mat.color).lerp(new THREE.Color(0xffffff), 0.35)
            }
          } else {
            mat.emissiveIntensity = base
            if (mat.userData.savedEmissive && mat.emissive) {
              mat.emissive.copy(mat.userData.savedEmissive)
            }
          }
        }
      })
    }
  }

  clearHighlight() {
    this.highlightOrgan(null)
  }
}
