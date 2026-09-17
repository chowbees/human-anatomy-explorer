import * as THREE from 'three'
import { state, bodyScaleFromAnthropometrics } from './state.js'

const ORGAN_META = {
  brain: { name: 'Brain', color: 0xf2a7c0 },
  heart: { name: 'Heart', color: 0xe63946 },
  lungs: { name: 'Lungs', color: 0xf4a7a0 },
  liver: { name: 'Liver', color: 0xa05a3c },
  stomach: { name: 'Stomach', color: 0xd4a574 },
  intestines: { name: 'Intestines', color: 0xe8b070 },
}

/**
 * Procedural stylized human body + clickable organs.
 * Coordinates: Y up, body standing on origin, head ~1.75 units (before scale).
 */
export class AnatomyBody {
  constructor(scene) {
    this.scene = scene
    this.root = new THREE.Group()
    this.root.name = 'bodyRoot'
    this.skinMeshes = []
    this.organMeshes = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []
    this._skinMat = null
    this._build()
    scene.add(this.root)
  }

  _build() {
    while (this.root.children.length) {
      this.root.remove(this.root.children[0])
    }
    this.skinMeshes = []
    this.organMeshes = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []

    const isFemale = state.sex === 'female'
    const shoulderW = isFemale ? 0.38 : 0.48
    const hipW = isFemale ? 0.42 : 0.34
    const chestD = isFemale ? 0.22 : 0.26
    const waistW = isFemale ? 0.28 : 0.32

    this._skinMat = new THREE.MeshStandardMaterial({
      color: state.skinTone,
      roughness: 0.65,
      metalness: 0.05,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const solidSkin = new THREE.MeshStandardMaterial({
      color: state.skinTone,
      roughness: 0.7,
      metalness: 0.02,
      transparent: true,
      opacity: 0.18,
    })

    // Torso (tapered capsule-like using scaled spheres / boxes)
    const torso = new THREE.Group()
    torso.name = 'torso'

    const chestGeo = new THREE.SphereGeometry(1, 24, 16)
    const chest = new THREE.Mesh(chestGeo, this._skinMat)
    chest.scale.set(shoulderW, 0.35, chestD)
    chest.position.y = 1.15
    torso.add(chest)
    this.skinMeshes.push(chest)

    const mid = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this._skinMat)
    mid.scale.set(waistW, 0.28, 0.2)
    mid.position.y = 0.85
    torso.add(mid)
    this.skinMeshes.push(mid)

    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this._skinMat)
    pelvis.scale.set(hipW, 0.22, 0.2)
    pelvis.position.y = 0.58
    torso.add(pelvis)
    this.skinMeshes.push(pelvis)

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), solidSkin)
    head.position.y = 1.62
    torso.add(head)
    this.skinMeshes.push(head)

    // Neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12),
      solidSkin
    )
    neck.position.y = 1.48
    torso.add(neck)
    this.skinMeshes.push(neck)

    // Arms
    this._addLimb(torso, -shoulderW - 0.05, 1.2, -1, solidSkin)
    this._addLimb(torso, shoulderW + 0.05, 1.2, 1, solidSkin)

    // Legs
    this._addLeg(torso, -hipW * 0.45, solidSkin)
    this._addLeg(torso, hipW * 0.45, solidSkin)

    this.root.add(torso)

    // --- Organs (slightly opaque, inside translucent body) ---
    this._addOrgan(
      'brain',
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.Vector3(0, 1.64, 0.02),
      new THREE.Vector3(1.15, 0.9, 1.0)
    )

    this._addOrgan(
      'heart',
      this._heartGeo(),
      new THREE.Vector3(-0.06, 1.18, 0.05),
      new THREE.Vector3(0.9, 0.9, 0.9)
    )

    const lungs = new THREE.Group()
    const lungMat = new THREE.MeshStandardMaterial({
      color: ORGAN_META.lungs.color,
      roughness: 0.55,
      emissive: ORGAN_META.lungs.color,
      emissiveIntensity: 0.08,
    })
    const leftLung = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), lungMat)
    leftLung.scale.set(0.85, 1.35, 0.7)
    leftLung.position.set(-0.16, 1.15, 0.02)
    const rightLung = leftLung.clone()
    rightLung.position.x = 0.14
    lungs.add(leftLung, rightLung)
    lungs.name = 'lungs'
    lungs.userData.organId = 'lungs'
    this.root.add(lungs)
    this.organMeshes.lungs = lungs
    this.organHitTargets.push(leftLung, rightLung)
    leftLung.userData.organId = 'lungs'
    rightLung.userData.organId = 'lungs'

    this._addOrgan(
      'liver',
      new THREE.SphereGeometry(0.14, 14, 10),
      new THREE.Vector3(0.12, 0.92, 0.04),
      new THREE.Vector3(1.3, 0.7, 0.85)
    )

    this._addOrgan(
      'stomach',
      new THREE.SphereGeometry(0.1, 14, 10),
      new THREE.Vector3(-0.08, 0.9, 0.06),
      new THREE.Vector3(1.1, 0.85, 0.9)
    )

    // Intestines: coiled tube approximation
    const intestines = new THREE.Group()
    const intMat = new THREE.MeshStandardMaterial({
      color: ORGAN_META.intestines.color,
      roughness: 0.6,
      emissive: ORGAN_META.intestines.color,
      emissiveIntensity: 0.06,
    })
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.08 + (i % 3) * 0.02, 0.025, 8, 16),
        intMat
      )
      ring.position.set(
        ((i % 2) - 0.5) * 0.08,
        0.62 - Math.floor(i / 2) * 0.06,
        0.04 + (i % 3) * 0.01
      )
      ring.rotation.x = Math.PI / 2 + (i * 0.2)
      ring.rotation.z = i * 0.4
      ring.userData.organId = 'intestines'
      intestines.add(ring)
      this.organHitTargets.push(ring)
    }
    intestines.name = 'intestines'
    intestines.userData.organId = 'intestines'
    this.root.add(intestines)
    this.organMeshes.intestines = intestines

    // Vessel centerline paths (local body space, before anthropometric scale)
    this.vesselPaths = this._buildVesselPaths()
    this.digestPath = this._buildDigestPath()

    this.applyAnthropometrics()
    this.applySkinTone()
  }

  _addLimb(parent, x, y, side, mat) {
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.32, 4, 8),
      mat
    )
    upper.position.set(x, y - 0.2, 0)
    upper.rotation.z = side * 0.12
    parent.add(upper)
    this.skinMeshes.push(upper)

    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.3, 4, 8),
      mat
    )
    lower.position.set(x + side * 0.04, y - 0.55, 0)
    lower.rotation.z = side * 0.05
    parent.add(lower)
    this.skinMeshes.push(lower)
  }

  _addLeg(parent, x, mat) {
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.08, 0.38, 4, 8),
      mat
    )
    thigh.position.set(x, 0.28, 0)
    parent.add(thigh)
    this.skinMeshes.push(thigh)

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, 0.36, 4, 8),
      mat
    )
    shin.position.set(x, -0.15, 0)
    parent.add(shin)
    this.skinMeshes.push(shin)
  }

  _heartGeo() {
    // Simple heart-ish: two spheres + cone approximation via sphere squash
    const g = new THREE.SphereGeometry(0.08, 14, 12)
    return g
  }

  _addOrgan(id, geometry, position, scale) {
    const meta = ORGAN_META[id]
    const mat = new THREE.MeshStandardMaterial({
      color: meta.color,
      roughness: 0.45,
      metalness: 0.05,
      emissive: meta.color,
      emissiveIntensity: 0.12,
    })
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.copy(position)
    mesh.scale.copy(scale)
    mesh.name = id
    mesh.userData.organId = id
    this.root.add(mesh)
    this.organMeshes[id] = mesh
    this.organHitTargets.push(mesh)
  }

  _buildVesselPaths() {
    // Closed-ish loop through heart → body → back (polyline points)
    const pts = [
      new THREE.Vector3(-0.06, 1.18, 0.05),
      new THREE.Vector3(0, 1.35, 0.08),
      new THREE.Vector3(0, 1.5, 0.05),
      new THREE.Vector3(0.05, 1.25, 0.1),
      new THREE.Vector3(0.2, 1.15, 0.05),
      new THREE.Vector3(0.35, 0.9, 0),
      new THREE.Vector3(0.15, 0.7, 0.05),
      new THREE.Vector3(0, 0.55, 0.08),
      new THREE.Vector3(-0.15, 0.7, 0.05),
      new THREE.Vector3(-0.25, 0.95, 0),
      new THREE.Vector3(-0.15, 1.1, 0.08),
      new THREE.Vector3(-0.06, 1.18, 0.05),
    ]
    return [pts]
  }

  _buildDigestPath() {
    // mouth → esophagus → stomach → intestines
    return [
      new THREE.Vector3(0, 1.55, 0.12), // mouth
      new THREE.Vector3(0, 1.4, 0.06), // esophagus upper
      new THREE.Vector3(0, 1.15, 0.04),
      new THREE.Vector3(-0.05, 0.95, 0.08), // stomach
      new THREE.Vector3(-0.02, 0.82, 0.06),
      new THREE.Vector3(0.05, 0.7, 0.05), // intestines
      new THREE.Vector3(-0.04, 0.62, 0.04),
      new THREE.Vector3(0.02, 0.55, 0.03),
    ]
  }

  getOrganWorldPosition(id) {
    const obj = this.organMeshes[id]
    if (!obj) return null
    const v = new THREE.Vector3()
    obj.getWorldPosition(v)
    return v
  }

  getOrganFocusTarget(id) {
    const pos = this.getOrganWorldPosition(id)
    if (!pos) return null
    return {
      target: pos.clone(),
      // Camera offset looking at organ
      camera: pos.clone().add(new THREE.Vector3(0.35, 0.15, 0.55)),
      label: ORGAN_META[id]?.name || id,
    }
  }

  applyAnthropometrics() {
    const { height, girth } = bodyScaleFromAnthropometrics()
    this.root.scale.set(girth, height, girth)
  }

  applySkinTone() {
    const c = new THREE.Color(state.skinTone)
    for (const m of this.skinMeshes) {
      if (m.material) {
        m.material.color.copy(c)
      }
    }
  }

  setSex(sex) {
    if (state.sex === sex) return
    state.sex = sex
    this._build()
  }

  setHealthVisual() {
    this.applySkinTone()
    // Pulse emissive on heart based on health
    const heart = this.organMeshes.heart
    if (heart?.material) {
      heart.material.emissiveIntensity = state.health === 'healthy' ? 0.18 : 0.08
    }
  }

  /** Heart beat scale animation */
  update(dt, time) {
    const heart = this.organMeshes.heart
    if (heart) {
      const bpm = state.heartRate
      const freq = (bpm / 60) * state.simSpeed
      const beat = 1 + 0.12 * Math.max(0, Math.sin(time * freq * Math.PI * 2)) ** 2
      heart.scale.setScalar(0.9 * beat)
    }

    // Subtle lung breathe
    const lungs = this.organMeshes.lungs
    if (lungs) {
      const breathe = 1 + 0.04 * Math.sin(time * 1.2 * state.simSpeed)
      lungs.scale.set(breathe, 1 + (breathe - 1) * 1.5, breathe)
    }

    // Gut wriggle when active
    const gut = this.organMeshes.intestines
    if (gut && state.digestion.gutActivity > 0.05) {
      gut.rotation.y = Math.sin(time * 2 * state.simSpeed) * 0.08 * state.digestion.gutActivity
    }
  }

  highlightOrgan(id) {
    for (const [oid, mesh] of Object.entries(this.organMeshes)) {
      const mats = []
      mesh.traverse((c) => {
        if (c.isMesh && c.material) mats.push(c.material)
      })
      for (const mat of mats) {
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = oid === id ? 0.45 : oid === 'heart' ? 0.15 : 0.08
        }
      }
    }
  }

  clearHighlight() {
    this.highlightOrgan(null)
  }
}

export { ORGAN_META }
