import * as THREE from 'three'
import { state, bodyScaleFromAnthropometrics } from './state.js'

/**
 * Major organs of primary systems (educational / stylized atlas level).
 * Not every minor gland or lymph node.
 */
const ORGAN_META = {
  brain: { name: 'Brain', color: 0xf2a7c0, system: 'head' },
  eyes: { name: 'Eyes', color: 0x7ec8e3, system: 'head' },
  pituitary: { name: 'Pituitary', color: 0xe8a0bf, system: 'head' },
  spinalCord: { name: 'Spinal cord', color: 0xf5d0e0, system: 'head' },
  thyroid: { name: 'Thyroid', color: 0xd4a017, system: 'head' },
  heart: { name: 'Heart', color: 0xe63946, system: 'chest' },
  trachea: { name: 'Trachea', color: 0xd0c8b8, system: 'chest' },
  leftLung: { name: 'Left lung', color: 0xf4a7a0, system: 'chest' },
  rightLung: { name: 'Right lung', color: 0xf4a090, system: 'chest' },
  esophagus: { name: 'Esophagus', color: 0xc9897b, system: 'chest' },
  stomach: { name: 'Stomach', color: 0xd4a574, system: 'abdomen' },
  liver: { name: 'Liver', color: 0xa05a3c, system: 'abdomen' },
  gallbladder: { name: 'Gallbladder', color: 0x3ecf6e, system: 'abdomen' },
  pancreas: { name: 'Pancreas', color: 0xe8c4a0, system: 'abdomen' },
  spleen: { name: 'Spleen', color: 0x9b2d4a, system: 'abdomen' },
  smallIntestine: { name: 'Small intestine', color: 0xe8b070, system: 'abdomen' },
  largeIntestine: { name: 'Large intestine', color: 0xd4925a, system: 'abdomen' },
  rectum: { name: 'Rectum', color: 0xc47a50, system: 'pelvis' },
  leftKidney: { name: 'Left kidney', color: 0xc45c6a, system: 'abdomen' },
  rightKidney: { name: 'Right kidney', color: 0xc45c6a, system: 'abdomen' },
  leftAdrenal: { name: 'Left adrenal', color: 0xd4a060, system: 'abdomen' },
  rightAdrenal: { name: 'Right adrenal', color: 0xd4a060, system: 'abdomen' },
  bladder: { name: 'Bladder', color: 0xf0e6a0, system: 'pelvis' },
  leftUreter: { name: 'Left ureter', color: 0xe8d888, system: 'pelvis' },
  rightUreter: { name: 'Right ureter', color: 0xe8d888, system: 'pelvis' },
  // Female
  uterus: { name: 'Uterus', color: 0xe07090, system: 'pelvis', sex: 'female' },
  leftOvary: { name: 'Left ovary', color: 0xd080a0, system: 'pelvis', sex: 'female' },
  rightOvary: { name: 'Right ovary', color: 0xd080a0, system: 'pelvis', sex: 'female' },
  // Male
  prostate: { name: 'Prostate', color: 0xc090a8, system: 'pelvis', sex: 'male' },
  leftTestis: { name: 'Left testis', color: 0xd4b090, system: 'pelvis', sex: 'male' },
  rightTestis: { name: 'Right testis', color: 0xd4b090, system: 'pelvis', sex: 'male' },
}

const SYSTEM_LABELS = {
  head: 'Head & neck',
  chest: 'Chest',
  abdomen: 'Abdomen',
  pelvis: 'Pelvis',
}

/**
 * Procedural stylized full human figure + clickable major organs.
 * Coordinates: Y up, feet near y≈-0.5, head ~1.72 (before anthropometric scale).
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
    this._solidSkin = null
    this._build()
    scene.add(this.root)
  }

  _build() {
    while (this.root.children.length) {
      const c = this.root.children[0]
      this.root.remove(c)
      c.traverse?.((o) => {
        o.geometry?.dispose?.()
      })
    }
    this.skinMeshes = []
    this.organMeshes = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []

    const isFemale = state.sex === 'female'
    const shoulderW = isFemale ? 0.36 : 0.46
    const hipW = isFemale ? 0.4 : 0.33
    const chestD = isFemale ? 0.2 : 0.24
    const waistW = isFemale ? 0.26 : 0.3
    const chestY = 1.22
    const hipY = 0.55

    this._skinMat = new THREE.MeshStandardMaterial({
      color: state.skinTone,
      roughness: 0.62,
      metalness: 0.04,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this._solidSkin = new THREE.MeshStandardMaterial({
      color: state.skinTone,
      roughness: 0.68,
      metalness: 0.02,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })

    const torso = new THREE.Group()
    torso.name = 'torso'

    // --- Silhouette: readable standing human ---
    this._addHead(torso)
    this._addNeck(torso)

    // Shoulders / upper chest
    const shoulders = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, shoulderW * 1.55, 8, 16),
      this._skinMat
    )
    shoulders.rotation.z = Math.PI / 2
    shoulders.position.set(0, chestY + 0.12, 0)
    shoulders.scale.set(1, 1, chestD / 0.12 * 0.55)
    torso.add(shoulders)
    this.skinMeshes.push(shoulders)

    // Chest (broader capsule)
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 8, 20), this._skinMat)
    chest.scale.set(shoulderW / 0.22, 1, chestD / 0.22)
    chest.position.y = chestY - 0.02
    torso.add(chest)
    this.skinMeshes.push(chest)

    if (isFemale) {
      const bust = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), this._skinMat)
      bust.scale.set(1.35, 0.85, 0.9)
      bust.position.set(0, chestY - 0.05, chestD * 0.55)
      torso.add(bust)
      this.skinMeshes.push(bust)
    }

    // Waist
    const waist = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, 6, 16), this._skinMat)
    waist.scale.set(waistW / 0.16, 1, 0.18 / 0.16)
    waist.position.y = 0.88
    torso.add(waist)
    this.skinMeshes.push(waist)

    // Hips / pelvis shell
    const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.14, 6, 16), this._skinMat)
    pelvis.scale.set(hipW / 0.18, 1, 0.2 / 0.18)
    pelvis.position.y = hipY
    torso.add(pelvis)
    this.skinMeshes.push(pelvis)

    // Arms + hands
    this._addArm(torso, -shoulderW - 0.02, chestY + 0.08, -1)
    this._addArm(torso, shoulderW + 0.02, chestY + 0.08, 1)

    // Legs + feet
    this._addLeg(torso, -hipW * 0.42)
    this._addLeg(torso, hipW * 0.42)

    this.root.add(torso)

    // --- Organs ---
    this._buildNervous()
    this._buildEndocrine()
    this._buildCardiovascular()
    this._buildRespiratory()
    this._buildDigestive()
    this._buildLymphatic()
    this._buildUrinary()
    this._buildReproductive(isFemale)

    this.vesselPaths = this._buildVesselPaths()
    this.digestPath = this._buildDigestPath()

    this.applyAnthropometrics()
    this.applySkinTone()
  }

  _addHead(parent) {
    const headGroup = new THREE.Group()
    headGroup.position.y = 1.62

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 28, 22), this._solidSkin)
    skull.scale.set(1.05, 1.12, 1.0)
    headGroup.add(skull)
    this.skinMeshes.push(skull)

    // Jaw / chin cue
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), this._solidSkin)
    jaw.scale.set(0.95, 0.7, 0.85)
    jaw.position.set(0, -0.1, 0.02)
    headGroup.add(jaw)
    this.skinMeshes.push(jaw)

    // Eye socket cues (dark recesses) — visual only, not organs
    const socketMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a28,
      roughness: 0.9,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), socketMat)
      socket.scale.set(1.1, 0.75, 0.55)
      socket.position.set(sx * 0.055, 0.02, 0.13)
      headGroup.add(socket)
    }

    // Nose cue
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.04, 8),
      this._solidSkin
    )
    nose.rotation.x = Math.PI / 2
    nose.position.set(0, -0.02, 0.15)
    headGroup.add(nose)
    this.skinMeshes.push(nose)

    parent.add(headGroup)
  }

  _addNeck(parent) {
    const neck = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.1, 6, 12),
      this._solidSkin
    )
    neck.position.y = 1.48
    parent.add(neck)
    this.skinMeshes.push(neck)
  }

  _addArm(parent, x, y, side) {
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.3, 6, 12),
      this._solidSkin
    )
    upper.position.set(x, y - 0.18, 0)
    upper.rotation.z = side * 0.15
    parent.add(upper)
    this.skinMeshes.push(upper)

    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.04, 0.28, 6, 12),
      this._solidSkin
    )
    lower.position.set(x + side * 0.05, y - 0.5, 0.02)
    lower.rotation.z = side * 0.06
    parent.add(lower)
    this.skinMeshes.push(lower)

    // Simple hand (palm + stub fingers)
    const hand = new THREE.Group()
    hand.position.set(x + side * 0.07, y - 0.72, 0.02)
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.07, 0.025, 1, 1, 1),
      this._solidSkin
    )
    hand.add(palm)
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.008, 0.035, 3, 6),
        this._solidSkin
      )
      finger.position.set((i - 1.5) * 0.014, -0.055, 0)
      hand.add(finger)
    }
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.009, 0.028, 3, 6),
      this._solidSkin
    )
    thumb.position.set(side * -0.03, -0.02, 0.01)
    thumb.rotation.z = side * -0.6
    hand.add(thumb)
    parent.add(hand)
    hand.traverse((c) => {
      if (c.isMesh) this.skinMeshes.push(c)
    })
  }

  _addLeg(parent, x) {
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.36, 6, 12),
      this._solidSkin
    )
    thigh.position.set(x, 0.28, 0)
    parent.add(thigh)
    this.skinMeshes.push(thigh)

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.34, 6, 12),
      this._solidSkin
    )
    shin.position.set(x, -0.14, 0)
    parent.add(shin)
    this.skinMeshes.push(shin)

    // Foot
    const foot = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.12, 4, 10),
      this._solidSkin
    )
    foot.rotation.x = Math.PI / 2
    foot.position.set(x, -0.4, 0.05)
    foot.scale.set(1.1, 1, 0.85)
    parent.add(foot)
    this.skinMeshes.push(foot)
  }

  _organMat(id) {
    const meta = ORGAN_META[id]
    return new THREE.MeshStandardMaterial({
      color: meta.color,
      roughness: 0.42,
      metalness: 0.06,
      emissive: meta.color,
      emissiveIntensity: 0.14,
      transparent: true,
      opacity: 0.92,
    })
  }

  _registerOrgan(id, object) {
    object.name = id
    object.userData.organId = id
    this.root.add(object)
    this.organMeshes[id] = object
    object.traverse((c) => {
      if (c.isMesh) {
        c.userData.organId = id
        this.organHitTargets.push(c)
      }
    })
  }

  _addSimpleOrgan(id, geometry, position, scale = new THREE.Vector3(1, 1, 1), rotation = null) {
    const mesh = new THREE.Mesh(geometry, this._organMat(id))
    mesh.position.copy(position)
    mesh.scale.copy(scale)
    if (rotation) mesh.rotation.copy(rotation)
    this._registerOrgan(id, mesh)
    return mesh
  }

  _heartGeometry() {
    // Heart-like: two lobes + pointed bottom (merged via group, or single compound)
    const group = new THREE.Group()
    const mat = this._organMat('heart')
    const lobeGeo = new THREE.SphereGeometry(0.055, 14, 12)
    const left = new THREE.Mesh(lobeGeo, mat)
    left.position.set(-0.032, 0.02, 0)
    left.scale.set(1, 1.05, 0.95)
    const right = new THREE.Mesh(lobeGeo, mat)
    right.position.set(0.028, 0.025, 0)
    right.scale.set(0.95, 1.1, 0.9)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 12), mat)
    tip.position.set(-0.005, -0.055, 0)
    tip.rotation.z = 0.15
    group.add(left, right, tip)
    // Vessel stubs
    const aorta = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.014, 0.06, 8),
      mat
    )
    aorta.position.set(0.01, 0.08, 0)
    group.add(aorta)
    return group
  }

  _stomachGeometry() {
    // J-shaped stomach via lathe profile
    const pts = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const r = 0.045 + 0.035 * Math.sin(t * Math.PI) * (t < 0.7 ? 1 : 0.55)
      const y = -0.07 + t * 0.14
      pts.push(new THREE.Vector2(r, y))
    }
    return new THREE.LatheGeometry(pts, 20)
  }

  _liverGeometry() {
    // Wedge / lobed: flattened sphere + side lobe
    const group = new THREE.Group()
    const mat = this._organMat('liver')
    const main = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat)
    main.scale.set(1.45, 0.65, 0.95)
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mat)
    lobe.position.set(-0.1, -0.02, 0.02)
    lobe.scale.set(1.1, 0.7, 0.85)
    group.add(main, lobe)
    return group
  }

  _buildNervous() {
    // Brain: two hemispheres
    const brain = new THREE.Group()
    const mat = this._organMat('brain')
    const hemiGeo = new THREE.SphereGeometry(0.1, 18, 14, 0, Math.PI)
    const left = new THREE.Mesh(hemiGeo, mat)
    left.rotation.y = Math.PI / 2
    left.position.set(-0.01, 0, 0)
    left.scale.set(1.05, 1.0, 1.15)
    const right = new THREE.Mesh(hemiGeo, mat)
    right.rotation.y = -Math.PI / 2
    right.position.set(0.01, 0, 0)
    right.scale.set(1.05, 1.0, 1.15)
    // Cerebellum cue
    const cereb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat)
    cereb.position.set(0, -0.06, -0.06)
    cereb.scale.set(1.3, 0.7, 0.9)
    brain.add(left, right, cereb)
    brain.position.set(0, 1.64, 0.01)
    this._registerOrgan('brain', brain)

    // Eyes (paired, one focus id)
    const eyes = new THREE.Group()
    const eyeMat = this._organMat('eyes')
    for (const sx of [-1, 1]) {
      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), eyeMat)
      eyeball.position.set(sx * 0.055, 1.64, 0.13)
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x2a4a6a,
          emissive: 0x1a3050,
          emissiveIntensity: 0.2,
        })
      )
      iris.position.set(sx * 0.055, 1.64, 0.148)
      iris.userData.organId = 'eyes'
      eyes.add(eyeball, iris)
    }
    this._registerOrgan('eyes', eyes)

    // Pituitary (tiny at brain base)
    this._addSimpleOrgan(
      'pituitary',
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.Vector3(0, 1.55, 0.02)
    )

    // Spinal cord
    this._addSimpleOrgan(
      'spinalCord',
      new THREE.CylinderGeometry(0.018, 0.016, 0.95, 10),
      new THREE.Vector3(0, 1.05, -0.06)
    )
  }

  _buildEndocrine() {
    // Thyroid (butterfly / two lobes at neck)
    const thyroid = new THREE.Group()
    const mat = this._organMat('thyroid')
    for (const sx of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), mat)
      lobe.scale.set(0.7, 1.1, 0.55)
      lobe.position.set(sx * 0.035, 0, 0)
      thyroid.add(lobe)
    }
    const isthmus = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.015, 0.02),
      mat
    )
    thyroid.add(isthmus)
    thyroid.position.set(0, 1.45, 0.05)
    this._registerOrgan('thyroid', thyroid)

    // Adrenals sit on kidneys — created in urinary with kidneys
  }

  _buildCardiovascular() {
    const heart = this._heartGeometry()
    heart.position.set(-0.05, 1.2, 0.06)
    heart.scale.set(1.05, 1.05, 1.05)
    this._registerOrgan('heart', heart)
  }

  _buildRespiratory() {
    // Trachea
    this._addSimpleOrgan(
      'trachea',
      new THREE.CylinderGeometry(0.022, 0.024, 0.22, 12),
      new THREE.Vector3(0, 1.36, 0.04)
    )

    // Lungs — distinct left / right
    const lungGeo = (isLeft) => {
      const g = new THREE.Group()
      const mat = this._organMat(isLeft ? 'leftLung' : 'rightLung')
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), mat)
      main.scale.set(0.75, 1.45, 0.7)
      // Cardiac notch cue on left
      if (isLeft) {
        main.scale.set(0.7, 1.4, 0.65)
      }
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat)
      tip.position.set(0, 0.14, 0)
      tip.scale.set(0.8, 0.6, 0.7)
      g.add(main, tip)
      return g
    }

    const leftLung = lungGeo(true)
    leftLung.position.set(-0.15, 1.18, 0.0)
    this._registerOrgan('leftLung', leftLung)

    const rightLung = lungGeo(false)
    rightLung.position.set(0.14, 1.18, 0.0)
    this._registerOrgan('rightLung', rightLung)
  }

  _buildDigestive() {
    // Esophagus
    this._addSimpleOrgan(
      'esophagus',
      new THREE.CylinderGeometry(0.016, 0.018, 0.38, 10),
      new THREE.Vector3(0.01, 1.28, 0.02)
    )

    // Stomach J-shape
    const stomach = new THREE.Mesh(this._stomachGeometry(), this._organMat('stomach'))
    stomach.position.set(-0.09, 0.95, 0.07)
    stomach.rotation.z = 0.35
    stomach.rotation.y = -0.2
    stomach.scale.set(1.35, 1.2, 1.15)
    this._registerOrgan('stomach', stomach)

    // Liver
    const liver = this._liverGeometry()
    liver.position.set(0.12, 0.98, 0.04)
    this._registerOrgan('liver', liver)

    // Gallbladder
    this._addSimpleOrgan(
      'gallbladder',
      new THREE.SphereGeometry(0.028, 10, 8),
      new THREE.Vector3(0.08, 0.9, 0.08),
      new THREE.Vector3(0.7, 1.3, 0.7)
    )

    // Pancreas (elongated)
    this._addSimpleOrgan(
      'pancreas',
      new THREE.CapsuleGeometry(0.025, 0.14, 4, 10),
      new THREE.Vector3(0.02, 0.88, 0.0),
      new THREE.Vector3(1, 1, 0.7),
      new THREE.Euler(0, 0, -0.25)
    )

    // Small intestine — coiled rings
    const small = new THREE.Group()
    const sMat = this._organMat('smallIntestine')
    for (let i = 0; i < 10; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.055 + (i % 3) * 0.012, 0.018, 8, 18),
        sMat
      )
      const row = Math.floor(i / 3)
      const col = i % 3
      ring.position.set(
        (col - 1) * 0.07,
        0.72 - row * 0.055,
        0.05 + (i % 2) * 0.02
      )
      ring.rotation.x = Math.PI / 2 + i * 0.15
      ring.rotation.z = i * 0.35
      small.add(ring)
    }
    this._registerOrgan('smallIntestine', small)

    // Large intestine — frame / colon loop
    const large = new THREE.Group()
    const lMat = this._organMat('largeIntestine')
    const colonPts = [
      new THREE.Vector3(-0.12, 0.62, 0.04),
      new THREE.Vector3(-0.12, 0.78, 0.04),
      new THREE.Vector3(0, 0.82, 0.05),
      new THREE.Vector3(0.12, 0.78, 0.04),
      new THREE.Vector3(0.12, 0.58, 0.04),
      new THREE.Vector3(0.04, 0.52, 0.05),
      new THREE.Vector3(0, 0.48, 0.04),
    ]
    const curve = new THREE.CatmullRomCurve3(colonPts)
    const colon = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, 0.028, 8, false),
      lMat
    )
    large.add(colon)
    this._registerOrgan('largeIntestine', large)

    // Rectum marker
    this._addSimpleOrgan(
      'rectum',
      new THREE.CapsuleGeometry(0.025, 0.06, 4, 8),
      new THREE.Vector3(0, 0.42, 0.02)
    )
  }

  _buildLymphatic() {
    this._addSimpleOrgan(
      'spleen',
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.Vector3(-0.16, 0.95, 0.0),
      new THREE.Vector3(0.7, 1.2, 0.65)
    )
  }

  _buildUrinary() {
    const kidneyGeo = () => {
      const g = new THREE.SphereGeometry(0.055, 14, 12)
      return g
    }

    const leftK = new THREE.Mesh(kidneyGeo(), this._organMat('leftKidney'))
    leftK.position.set(-0.12, 0.82, -0.05)
    leftK.scale.set(0.75, 1.25, 0.7)
    leftK.rotation.z = 0.2
    this._registerOrgan('leftKidney', leftK)

    const rightK = new THREE.Mesh(kidneyGeo(), this._organMat('rightKidney'))
    rightK.position.set(0.12, 0.82, -0.05)
    rightK.scale.set(0.75, 1.25, 0.7)
    rightK.rotation.z = -0.2
    this._registerOrgan('rightKidney', rightK)

    // Adrenals on top of kidneys
    this._addSimpleOrgan(
      'leftAdrenal',
      new THREE.SphereGeometry(0.02, 8, 8),
      new THREE.Vector3(-0.12, 0.92, -0.05),
      new THREE.Vector3(1.2, 0.7, 0.8)
    )
    this._addSimpleOrgan(
      'rightAdrenal',
      new THREE.SphereGeometry(0.02, 8, 8),
      new THREE.Vector3(0.12, 0.92, -0.05),
      new THREE.Vector3(1.2, 0.7, 0.8)
    )

    // Ureters
    const mkUreter = (id, x) => {
      const pts = [
        new THREE.Vector3(x, 0.78, -0.04),
        new THREE.Vector3(x * 0.5, 0.65, -0.02),
        new THREE.Vector3(x * 0.15, 0.52, 0.02),
      ]
      const curve = new THREE.CatmullRomCurve3(pts)
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 16, 0.008, 6, false),
        this._organMat(id)
      )
      this._registerOrgan(id, tube)
    }
    mkUreter('leftUreter', -0.12)
    mkUreter('rightUreter', 0.12)

    // Bladder
    this._addSimpleOrgan(
      'bladder',
      new THREE.SphereGeometry(0.06, 14, 12),
      new THREE.Vector3(0, 0.48, 0.06),
      new THREE.Vector3(1.15, 0.85, 0.9)
    )
  }

  _buildReproductive(isFemale) {
    if (isFemale) {
      // Uterus (pear / inverted triangle-ish)
      const uterus = new THREE.Group()
      const mat = this._organMat('uterus')
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat)
      body.scale.set(1.15, 1.0, 0.75)
      const cervix = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.04, 8), mat)
      cervix.position.y = -0.045
      uterus.add(body, cervix)
      uterus.position.set(0, 0.5, 0.02)
      this._registerOrgan('uterus', uterus)

      this._addSimpleOrgan(
        'leftOvary',
        new THREE.SphereGeometry(0.022, 10, 8),
        new THREE.Vector3(-0.08, 0.52, 0.02),
        new THREE.Vector3(1, 0.75, 0.7)
      )
      this._addSimpleOrgan(
        'rightOvary',
        new THREE.SphereGeometry(0.022, 10, 8),
        new THREE.Vector3(0.08, 0.52, 0.02),
        new THREE.Vector3(1, 0.75, 0.7)
      )
    } else {
      this._addSimpleOrgan(
        'prostate',
        new THREE.SphereGeometry(0.03, 10, 8),
        new THREE.Vector3(0, 0.44, 0.0),
        new THREE.Vector3(1.2, 0.7, 0.9)
      )
      this._addSimpleOrgan(
        'leftTestis',
        new THREE.SphereGeometry(0.028, 10, 8),
        new THREE.Vector3(-0.04, 0.32, 0.05),
        new THREE.Vector3(0.85, 1.15, 0.8)
      )
      this._addSimpleOrgan(
        'rightTestis',
        new THREE.SphereGeometry(0.028, 10, 8),
        new THREE.Vector3(0.04, 0.32, 0.05),
        new THREE.Vector3(0.85, 1.15, 0.8)
      )
    }
  }

  _buildVesselPaths() {
    const pts = [
      new THREE.Vector3(-0.05, 1.2, 0.06),
      new THREE.Vector3(0, 1.38, 0.05),
      new THREE.Vector3(0, 1.55, 0.04),
      new THREE.Vector3(0.08, 1.3, 0.1),
      new THREE.Vector3(0.22, 1.15, 0.04),
      new THREE.Vector3(0.32, 0.9, 0),
      new THREE.Vector3(0.12, 0.7, 0.05),
      new THREE.Vector3(0, 0.5, 0.08),
      new THREE.Vector3(-0.12, 0.7, 0.05),
      new THREE.Vector3(-0.28, 0.95, 0),
      new THREE.Vector3(-0.15, 1.12, 0.08),
      new THREE.Vector3(-0.05, 1.2, 0.06),
    ]
    return [pts]
  }

  _buildDigestPath() {
    // mouth → esophagus → stomach → small intestine → large intestine
    return [
      new THREE.Vector3(0, 1.55, 0.14),
      new THREE.Vector3(0.01, 1.4, 0.05),
      new THREE.Vector3(0.01, 1.2, 0.03),
      new THREE.Vector3(-0.05, 1.0, 0.08),
      new THREE.Vector3(-0.09, 0.95, 0.08),
      new THREE.Vector3(-0.02, 0.82, 0.06),
      new THREE.Vector3(0.04, 0.72, 0.06),
      new THREE.Vector3(-0.04, 0.65, 0.05),
      new THREE.Vector3(0.1, 0.7, 0.05),
      new THREE.Vector3(0.1, 0.55, 0.04),
      new THREE.Vector3(0, 0.48, 0.04),
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
      camera: pos.clone().add(new THREE.Vector3(0.35, 0.15, 0.55)),
      label: ORGAN_META[id]?.name || id,
    }
  }

  /** Organ ids currently present for this sex */
  listOrganIds() {
    return Object.keys(this.organMeshes)
  }

  applyAnthropometrics() {
    const { height, girth } = bodyScaleFromAnthropometrics()
    this.root.scale.set(girth, height, girth)
  }

  applySkinTone() {
    const c = new THREE.Color(state.skinTone)
    for (const m of this.skinMeshes) {
      if (m.material && m.material.color) {
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
    const heart = this.organMeshes.heart
    if (heart) {
      heart.traverse((c) => {
        if (c.isMesh && c.material?.emissiveIntensity !== undefined) {
          c.material.emissiveIntensity = state.health === 'healthy' ? 0.2 : 0.08
        }
      })
    }
  }

  update(dt, time) {
    const heart = this.organMeshes.heart
    if (heart) {
      const bpm = state.heartRate
      const freq = (bpm / 60) * state.simSpeed
      const beat = 1 + 0.12 * Math.max(0, Math.sin(time * freq * Math.PI * 2)) ** 2
      heart.scale.setScalar(1.05 * beat)
    }

    const breathe = 1 + 0.045 * Math.sin(time * 1.2 * state.simSpeed)
    for (const id of ['leftLung', 'rightLung']) {
      const lung = this.organMeshes[id]
      if (lung) {
        lung.scale.set(breathe, 1 + (breathe - 1) * 1.6, breathe)
      }
    }

    const gutActivity = state.digestion.gutActivity
    if (gutActivity > 0.05) {
      const small = this.organMeshes.smallIntestine
      const large = this.organMeshes.largeIntestine
      if (small) {
        small.rotation.y =
          Math.sin(time * 2 * state.simSpeed) * 0.08 * gutActivity
      }
      if (large) {
        large.rotation.y =
          Math.sin(time * 1.5 * state.simSpeed + 1) * 0.04 * gutActivity
      }
    }
  }

  highlightOrgan(id) {
    for (const [oid, mesh] of Object.entries(this.organMeshes)) {
      mesh.traverse((c) => {
        if (!c.isMesh || !c.material || c.material.emissiveIntensity === undefined) return
        if (oid === id) {
          c.material.emissiveIntensity = 0.5
        } else if (oid === 'heart') {
          c.material.emissiveIntensity = 0.16
        } else {
          c.material.emissiveIntensity = 0.1
        }
      })
    }
  }

  clearHighlight() {
    this.highlightOrgan(null)
  }
}

export { ORGAN_META, SYSTEM_LABELS }
