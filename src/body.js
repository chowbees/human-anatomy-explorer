import * as THREE from 'three'
import { state, bodyScaleFromAnthropometrics } from './state.js'
import {
  makeOrganMaterial,
  makeSkinMaterial,
  makeScleraMaterial,
  makeIrisMaterial,
  makePupilMaterial,
} from './materials.js'
import {
  beanGeometry,
  pearGeometry,
  stomachLathe,
  brainHemisphere,
  tubeAlongPoints,
  smallIntestinePoints,
  colonPoints,
  torsoProfile,
  skullGeometry,
  heartLathe,
  lungMainGeometry,
  addHaustrumHint,
  latheFromProfile,
  deformVertices,
} from './geometry/organic.js'

/**
 * Major organs — educational anatomy-mannequin realism (age-appropriate).
 */
const ORGAN_META = {
  brain: { name: 'Brain', color: 0xe8a0b8, system: 'head', roughness: 0.65 },
  eyes: { name: 'Eyes', color: 0xf0ebe3, system: 'head', roughness: 0.35 },
  pituitary: { name: 'Pituitary', color: 0xd890a8, system: 'head', roughness: 0.55 },
  spinalCord: { name: 'Spinal cord', color: 0xf0c8d8, system: 'head', roughness: 0.5 },
  thyroid: { name: 'Thyroid', color: 0xc49a3c, system: 'head', roughness: 0.55 },
  heart: { name: 'Heart', color: 0xc23b45, system: 'chest', roughness: 0.45 },
  trachea: { name: 'Trachea', color: 0xd8d0c0, system: 'chest', roughness: 0.6 },
  leftLung: { name: 'Left lung', color: 0xe8a090, system: 'chest', roughness: 0.7 },
  rightLung: { name: 'Right lung', color: 0xe89888, system: 'chest', roughness: 0.7 },
  esophagus: { name: 'Esophagus', color: 0xc08070, system: 'chest', roughness: 0.55 },
  stomach: { name: 'Stomach', color: 0xd4a070, system: 'abdomen', roughness: 0.5 },
  liver: { name: 'Liver', color: 0x8b4a32, system: 'abdomen', roughness: 0.55 },
  gallbladder: { name: 'Gallbladder', color: 0x5aaf5a, system: 'abdomen', roughness: 0.4 },
  pancreas: { name: 'Pancreas', color: 0xe0c098, system: 'abdomen', roughness: 0.6 },
  spleen: { name: 'Spleen', color: 0x8a2a42, system: 'abdomen', roughness: 0.55 },
  smallIntestine: { name: 'Small intestine', color: 0xe0a868, system: 'abdomen', roughness: 0.55 },
  largeIntestine: { name: 'Large intestine', color: 0xc88850, system: 'abdomen', roughness: 0.55 },
  rectum: { name: 'Rectum', color: 0xb87048, system: 'pelvis', roughness: 0.55 },
  leftKidney: { name: 'Left kidney', color: 0xb85060, system: 'abdomen', roughness: 0.5 },
  rightKidney: { name: 'Right kidney', color: 0xb85060, system: 'abdomen', roughness: 0.5 },
  leftAdrenal: { name: 'Left adrenal', color: 0xc89858, system: 'abdomen', roughness: 0.55 },
  rightAdrenal: { name: 'Right adrenal', color: 0xc89858, system: 'abdomen', roughness: 0.55 },
  bladder: { name: 'Bladder', color: 0xe8d878, system: 'pelvis', roughness: 0.45 },
  leftUreter: { name: 'Left ureter', color: 0xdcc868, system: 'pelvis', roughness: 0.5 },
  rightUreter: { name: 'Right ureter', color: 0xdcc868, system: 'pelvis', roughness: 0.5 },
  uterus: { name: 'Uterus', color: 0xd06080, system: 'pelvis', sex: 'female', roughness: 0.5 },
  leftOvary: { name: 'Left ovary', color: 0xc07090, system: 'pelvis', sex: 'female', roughness: 0.5 },
  rightOvary: { name: 'Right ovary', color: 0xc07090, system: 'pelvis', sex: 'female', roughness: 0.5 },
  prostate: { name: 'Prostate', color: 0xb88898, system: 'pelvis', sex: 'male', roughness: 0.55 },
  leftTestis: { name: 'Left testis', color: 0xd0a878, system: 'pelvis', sex: 'male', roughness: 0.5 },
  rightTestis: { name: 'Right testis', color: 0xd0a878, system: 'pelvis', sex: 'male', roughness: 0.5 },
}

const SYSTEM_LABELS = {
  head: 'Head & neck',
  chest: 'Chest',
  abdomen: 'Abdomen',
  pelvis: 'Pelvis',
}

/**
 * Classroom anatomy mannequin: realistic proportions + recognizable organ shapes.
 * Coordinates: Y up, feet near y≈-0.5, head ~1.72 (before anthropometric scale).
 */
export class AnatomyBody {
  constructor(scene) {
    this.scene = scene
    this.root = new THREE.Group()
    this.root.name = 'bodyRoot'
    this.skinMeshes = []
    this.skinGroup = null
    this.organMeshes = {}
    this.organHitTargets = []
    this.vesselPaths = []
    this.digestPath = []
    this._skinMat = null
    this._skinOpacity = 0.34
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
    const shoulderW = isFemale ? 0.34 : 0.44
    const hipW = isFemale ? 0.38 : 0.32
    const chestD = isFemale ? 0.18 : 0.22
    const waistW = isFemale ? 0.24 : 0.28
    const chestY = 1.22
    const hipY = 0.55

    this._skinMat = makeSkinMaterial(state.skinTone, this._skinOpacity)
    this.skinGroup = new THREE.Group()
    this.skinGroup.name = 'skinShell'

    const torso = new THREE.Group()
    torso.name = 'torso'

    this._addHead(torso)
    this._addNeck(torso)
    this._addTorsoShell(torso, isFemale, shoulderW, waistW, hipW, chestD)
    this._addArm(torso, -shoulderW - 0.04, chestY + 0.1, -1)
    this._addArm(torso, shoulderW + 0.04, chestY + 0.1, 1)
    this._addLeg(torso, -hipW * 0.4)
    this._addLeg(torso, hipW * 0.4)

    this.root.add(torso)

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
    this.setSkinMode(state.skinMode || 'translucent')
  }

  _addTorsoShell(parent, isFemale, shoulderW, waistW, hipW, chestD) {
    const profile = torsoProfile(isFemale, shoulderW, waistW, hipW)
    const torsoGeo = latheFromProfile(profile, 48)
    // Flatten anteroposterior slightly for human depth
    deformVertices(torsoGeo, (v) => {
      v.z *= (chestD / Math.max(shoulderW, 0.01)) * 0.95
    })
    const torsoMesh = new THREE.Mesh(torsoGeo, this._skinMat)
    parent.add(torsoMesh)
    this.skinMeshes.push(torsoMesh)

    if (isFemale) {
      for (const sx of [-1, 1]) {
        const bust = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 20, 16),
          this._skinMat
        )
        bust.scale.set(1.15, 0.9, 0.95)
        bust.position.set(sx * 0.09, 1.18, chestD * 0.55)
        parent.add(bust)
        this.skinMeshes.push(bust)
      }
    }
  }

  _addHead(parent) {
    const headGroup = new THREE.Group()
    headGroup.position.y = 1.62

    const skull = new THREE.Mesh(skullGeometry(), this._skinMat)
    skull.scale.set(1.02, 1.05, 0.95)
    headGroup.add(skull)
    this.skinMeshes.push(skull)

    // Jaw
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), this._skinMat)
    jaw.scale.set(0.95, 0.55, 0.8)
    jaw.position.set(0, -0.12, 0.02)
    headGroup.add(jaw)
    this.skinMeshes.push(jaw)

    // Orbital sockets (recessed)
    const socketMat = new THREE.MeshStandardMaterial({
      color: 0x2a1e1c,
      roughness: 0.9,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), socketMat)
      socket.scale.set(1.2, 0.9, 0.55)
      socket.position.set(sx * 0.048, 0.012, 0.112)
      headGroup.add(socket)
    }

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.038, 10), this._skinMat)
    nose.rotation.x = Math.PI / 2
    nose.position.set(0, -0.015, 0.145)
    headGroup.add(nose)
    this.skinMeshes.push(nose)

    // Ears
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), this._skinMat)
      ear.scale.set(0.35, 0.85, 0.55)
      ear.position.set(sx * 0.135, 0.0, 0.0)
      headGroup.add(ear)
      this.skinMeshes.push(ear)
    }

    parent.add(headGroup)
  }

  _addNeck(parent) {
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.055, 0.12, 16),
      this._skinMat
    )
    neck.position.y = 1.48
    parent.add(neck)
    this.skinMeshes.push(neck)
  }

  _addArm(parent, x, y, side) {
    // Upper arm — taper
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.28, 8, 14),
      this._skinMat
    )
    upper.position.set(x, y - 0.16, 0)
    upper.rotation.z = side * 0.12
    upper.scale.set(1, 1, 0.92)
    parent.add(upper)
    this.skinMeshes.push(upper)

    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.036, 0.26, 8, 14),
      this._skinMat
    )
    lower.position.set(x + side * 0.045, y - 0.48, 0.015)
    lower.rotation.z = side * 0.05
    parent.add(lower)
    this.skinMeshes.push(lower)

    const hand = new THREE.Group()
    hand.position.set(x + side * 0.06, y - 0.68, 0.015)
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.065, 0.022),
      this._skinMat
    )
    hand.add(palm)
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.007, 0.032, 4, 8),
        this._skinMat
      )
      finger.position.set((i - 1.5) * 0.013, -0.052, 0)
      hand.add(finger)
    }
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.026, 4, 8),
      this._skinMat
    )
    thumb.position.set(side * -0.028, -0.018, 0.008)
    thumb.rotation.z = side * -0.55
    hand.add(thumb)
    parent.add(hand)
    hand.traverse((c) => {
      if (c.isMesh) this.skinMeshes.push(c)
    })
  }

  _addLeg(parent, x) {
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.07, 0.34, 8, 14),
      this._skinMat
    )
    thigh.position.set(x, 0.28, 0)
    thigh.scale.set(1.05, 1, 0.95)
    parent.add(thigh)
    this.skinMeshes.push(thigh)

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.32, 8, 14),
      this._skinMat
    )
    shin.position.set(x, -0.14, 0)
    parent.add(shin)
    this.skinMeshes.push(shin)

    const foot = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.032, 0.11, 6, 12),
      this._skinMat
    )
    foot.rotation.x = Math.PI / 2
    foot.position.set(x, -0.4, 0.048)
    foot.scale.set(1.15, 1, 0.88)
    parent.add(foot)
    this.skinMeshes.push(foot)
  }

  _organMat(id) {
    const meta = ORGAN_META[id]
    return makeOrganMaterial(meta.color, {
      roughness: meta.roughness ?? 0.55,
      emissiveIntensity: 0.035,
      opacity: 1,
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
        c.castShadow = false
        c.receiveShadow = false
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

  _buildNervous() {
    // Brain — hemispheres + cerebellum + brainstem (NO cartoon eyes)
    const brain = new THREE.Group()
    const mat = this._organMat('brain')

    const left = new THREE.Mesh(brainHemisphere(0.105, true), mat)
    left.rotation.y = Math.PI / 2
    left.position.set(-0.008, 0.01, 0)
    left.scale.set(1.02, 1.0, 1.12)

    const right = new THREE.Mesh(brainHemisphere(0.105, false), mat)
    right.rotation.y = -Math.PI / 2
    right.position.set(0.008, 0.01, 0)
    right.scale.set(1.02, 1.0, 1.12)

    const cereb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 20, 16), mat)
    cereb.position.set(0, -0.07, -0.055)
    cereb.scale.set(1.35, 0.65, 0.95)
    deformVertices(cereb.geometry, (v) => {
      const g = 0.004 * Math.sin(v.x * 60) * Math.sin(v.z * 50)
      v.addScaledVector(v.clone().normalize(), g)
    })

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.06, 12),
      mat
    )
    stem.position.set(0, -0.1, -0.02)
    stem.rotation.x = 0.25

    brain.add(left, right, cereb, stem)
    brain.position.set(0, 1.65, 0.0)
    this._registerOrgan('brain', brain)

    // Eyes — anatomically sized in orbital sockets (not on brain)
    const eyes = new THREE.Group()
    const scleraMat = makeScleraMaterial()
    const irisMat = makeIrisMaterial(0x4a5a48) // muted hazel — textbook, not toy blue
    const pupilMat = makePupilMaterial()
    for (const sx of [-1, 1]) {
      const ball = new THREE.Group()
      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 20, 16), scleraMat)
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 16, 12), irisMat)
      iris.position.z = 0.011
      iris.scale.set(1, 1, 0.4)
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 12, 10), pupilMat)
      pupil.position.z = 0.0135
      pupil.scale.set(1, 1, 0.35)
      ball.add(eyeball, iris, pupil)
      // Deep in socket, under brow
      ball.position.set(sx * 0.048, 1.632, 0.118)
      eyes.add(ball)

      // Soft eyelid flaps (skin) partially cover globe — kills googly look
      const lidMat = this._skinMat
      const upper = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 8), lidMat)
      upper.scale.set(1.1, 0.35, 0.55)
      upper.position.set(sx * 0.048, 1.642, 0.122)
      this.skinMeshes.push(upper)
      // parent via root later — add to eyes group visually but mark as skin
      eyes.add(upper)
      const lower = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), lidMat)
      lower.scale.set(1.05, 0.28, 0.5)
      lower.position.set(sx * 0.048, 1.622, 0.12)
      eyes.add(lower)
      this.skinMeshes.push(lower)
    }
    this._registerOrgan('eyes', eyes)

    this._addSimpleOrgan(
      'pituitary',
      new THREE.SphereGeometry(0.01, 10, 8),
      new THREE.Vector3(0, 1.545, 0.015)
    )

    // Spinal cord — slightly tapered
    const cordGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.98, 12)
    this._addSimpleOrgan('spinalCord', cordGeo, new THREE.Vector3(0, 1.04, -0.055))
  }

  _buildEndocrine() {
    const thyroid = new THREE.Group()
    const mat = this._organMat('thyroid')
    for (const sx of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), mat)
      lobe.scale.set(0.65, 1.25, 0.5)
      lobe.position.set(sx * 0.032, 0, 0)
      thyroid.add(lobe)
    }
    const isthmus = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.012, 0.016), mat)
    thyroid.add(isthmus)
    thyroid.position.set(0, 1.445, 0.048)
    this._registerOrgan('thyroid', thyroid)
  }

  _buildCardiovascular() {
    const heart = new THREE.Group()
    const mat = this._organMat('heart')

    // Classic pointed heart body
    const body = new THREE.Mesh(heartLathe(), mat)
    body.scale.set(1.15, 1.1, 0.95)
    body.rotation.z = 0.12

    // Second lobe hint (left ventricle bulk)
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), mat)
    lobe.position.set(-0.025, 0.02, 0.005)
    lobe.scale.set(1.1, 1.15, 0.9)

    // Chamber groove hint (shallow torus)
    const groove = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.004, 8, 24),
      mat
    )
    groove.rotation.x = Math.PI / 2
    groove.position.set(0, 0.01, 0.01)
    groove.scale.set(1, 0.7, 1)

    // Great vessels
    const aorta = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.013, 0.055, 10),
      mat
    )
    aorta.position.set(0.012, 0.085, 0)
    const pa = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.011, 0.04, 10),
      mat
    )
    pa.position.set(-0.01, 0.075, 0.01)
    pa.rotation.z = -0.4

    heart.add(body, lobe, groove, aorta, pa)
    heart.position.set(-0.045, 1.2, 0.055)
    heart.scale.set(1.08, 1.08, 1.08)
    this._registerOrgan('heart', heart)
  }

  _buildRespiratory() {
    // Trachea with ring hint
    const trachea = new THREE.Group()
    const tMat = this._organMat('trachea')
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.022, 0.2, 14),
      tMat
    )
    trachea.add(tube)
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.021, 0.003, 6, 16),
        tMat
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = -0.08 + i * 0.032
      trachea.add(ring)
    }
    // Bronchial bifurcation stubs
    for (const sx of [-1, 1]) {
      const br = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.012, 0.05, 8),
        tMat
      )
      br.position.set(sx * 0.025, -0.12, 0)
      br.rotation.z = sx * 0.55
      trachea.add(br)
    }
    trachea.position.set(0, 1.36, 0.035)
    this._registerOrgan('trachea', trachea)

    const mkLung = (isLeft) => {
      const g = new THREE.Group()
      const mat = this._organMat(isLeft ? 'leftLung' : 'rightLung')
      const main = new THREE.Mesh(lungMainGeometry(isLeft), mat)
      g.add(main)
      // Lobe fissure cue
      const fissure = new THREE.Mesh(
        new THREE.TorusGeometry(0.07, 0.003, 6, 20, Math.PI),
        mat
      )
      fissure.rotation.z = isLeft ? 0.3 : -0.3
      fissure.rotation.y = Math.PI / 2
      fissure.position.set(isLeft ? 0.02 : -0.02, 0.02, 0)
      g.add(fissure)
      if (!isLeft) {
        // Middle lobe hint on right
        const mid = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), mat)
        mid.position.set(0.02, -0.02, 0.02)
        mid.scale.set(0.9, 0.7, 0.8)
        g.add(mid)
      }
      return g
    }

    const leftLung = mkLung(true)
    leftLung.position.set(-0.145, 1.17, 0.0)
    this._registerOrgan('leftLung', leftLung)

    const rightLung = mkLung(false)
    rightLung.position.set(0.135, 1.17, 0.0)
    this._registerOrgan('rightLung', rightLung)
  }

  _buildDigestive() {
    this._addSimpleOrgan(
      'esophagus',
      new THREE.CylinderGeometry(0.014, 0.016, 0.4, 12),
      new THREE.Vector3(0.012, 1.26, 0.015)
    )

    const stomach = new THREE.Mesh(stomachLathe(), this._organMat('stomach'))
    stomach.position.set(-0.085, 0.94, 0.065)
    stomach.rotation.z = 0.4
    stomach.rotation.y = -0.25
    stomach.scale.set(1.4, 1.25, 1.2)
    this._registerOrgan('stomach', stomach)

    // Liver — large right lobe + smaller left
    const liver = new THREE.Group()
    const lMat = this._organMat('liver')
    const rightLobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 18), lMat)
    rightLobe.scale.set(1.35, 0.55, 0.9)
    rightLobe.position.set(0.04, 0, 0)
    deformVertices(rightLobe.geometry, (v) => {
      if (v.y > 0.05) v.y *= 0.7
      if (v.x < -0.05) v.x *= 0.85
    })
    const leftLobe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), lMat)
    leftLobe.position.set(-0.1, -0.015, 0.015)
    leftLobe.scale.set(1.0, 0.55, 0.8)
    liver.add(rightLobe, leftLobe)
    liver.position.set(0.11, 0.98, 0.035)
    this._registerOrgan('liver', liver)

    // Gallbladder — pear under liver
    const gb = new THREE.Mesh(pearGeometry(0.055, 0.022), this._organMat('gallbladder'))
    gb.position.set(0.07, 0.9, 0.075)
    gb.rotation.z = 0.3
    this._registerOrgan('gallbladder', gb)

    // Pancreas — head / body / tail
    const pancreas = new THREE.Group()
    const pMat = this._organMat('pancreas')
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), pMat)
    head.scale.set(1.1, 0.9, 0.85)
    head.position.set(0.06, 0, 0.01)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.1, 6, 12), pMat)
    body.rotation.z = -0.2
    body.position.set(-0.02, 0.01, 0)
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), pMat)
    tail.scale.set(1.4, 0.7, 0.7)
    tail.position.set(-0.1, 0.02, -0.01)
    pancreas.add(head, body, tail)
    pancreas.position.set(0.0, 0.88, 0.0)
    this._registerOrgan('pancreas', pancreas)

    // Small intestine — continuous tapered coils
    const smallPts = smallIntestinePoints()
    const smallGeo = tubeAlongPoints(smallPts, 0.016, 96, 8)
    // Slight radius variation via vertex displace
    deformVertices(smallGeo, (v, i) => {
      const n = new THREE.Vector3(v.x, 0, v.z - 0.04)
      if (n.lengthSq() > 1e-6) {
        n.normalize()
        v.addScaledVector(n, 0.003 * Math.sin(i * 0.4))
      }
    })
    const small = new THREE.Mesh(smallGeo, this._organMat('smallIntestine'))
    this._registerOrgan('smallIntestine', small)

    // Large intestine with haustrum hint
    const colonGeo = addHaustrumHint(
      tubeAlongPoints(colonPoints(), 0.026, 64, 10),
      0.01
    )
    const large = new THREE.Mesh(colonGeo, this._organMat('largeIntestine'))
    this._registerOrgan('largeIntestine', large)

    this._addSimpleOrgan(
      'rectum',
      new THREE.CapsuleGeometry(0.022, 0.055, 6, 10),
      new THREE.Vector3(0, 0.4, 0.02)
    )
  }

  _buildLymphatic() {
    // Spleen — fist-like wedge
    const spleen = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14), this._organMat('spleen'))
    deformVertices(spleen.geometry, (v) => {
      v.x *= 0.65
      v.y *= 1.25
      v.z *= 0.7
      if (v.x > 0.02) v.x *= 0.7
    })
    spleen.position.set(-0.165, 0.94, -0.01)
    spleen.rotation.z = 0.35
    this._registerOrgan('spleen', spleen)
  }

  _buildUrinary() {
    const leftK = new THREE.Mesh(beanGeometry(1.0, 0.04), this._organMat('leftKidney'))
    leftK.position.set(-0.125, 0.82, -0.05)
    leftK.rotation.set(0.15, 0.4, 0.35)
    leftK.scale.set(1.05, 1.1, 1)
    this._registerOrgan('leftKidney', leftK)

    const rightK = new THREE.Mesh(beanGeometry(1.0, 0.04), this._organMat('rightKidney'))
    rightK.position.set(0.125, 0.82, -0.05)
    rightK.rotation.set(0.15, -0.4, -0.35)
    rightK.scale.set(1.05, 1.1, 1)
    this._registerOrgan('rightKidney', rightK)

    // Adrenals — triangular caps
    for (const [id, x] of [['leftAdrenal', -0.125], ['rightAdrenal', 0.125]]) {
      const ad = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.028, 5), this._organMat(id))
      ad.position.set(x, 0.915, -0.05)
      ad.rotation.z = x < 0 ? 0.2 : -0.2
      this._registerOrgan(id, ad)
    }

    const mkUreter = (id, x) => {
      const pts = [
        new THREE.Vector3(x, 0.78, -0.04),
        new THREE.Vector3(x * 0.55, 0.65, -0.02),
        new THREE.Vector3(x * 0.18, 0.52, 0.02),
      ]
      const tube = new THREE.Mesh(
        tubeAlongPoints(pts, 0.007, 20, 6),
        this._organMat(id)
      )
      this._registerOrgan(id, tube)
    }
    mkUreter('leftUreter', -0.12)
    mkUreter('rightUreter', 0.12)

    const bladder = new THREE.Mesh(pearGeometry(0.09, 0.048), this._organMat('bladder'))
    bladder.position.set(0, 0.48, 0.055)
    bladder.rotation.x = Math.PI
    bladder.scale.set(1.1, 0.95, 0.95)
    this._registerOrgan('bladder', bladder)
  }

  _buildReproductive(isFemale) {
    if (isFemale) {
      const uterus = new THREE.Group()
      const mat = this._organMat('uterus')
      const body = new THREE.Mesh(pearGeometry(0.07, 0.038), mat)
      body.scale.set(1.2, 1, 0.75)
      const cervix = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.018, 0.035, 10),
        mat
      )
      cervix.position.y = -0.05
      // Fundus tubes stubs
      for (const sx of [-1, 1]) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.006, 0.05, 6),
          mat
        )
        tube.position.set(sx * 0.04, 0.02, 0)
        tube.rotation.z = sx * -0.9
        uterus.add(tube)
      }
      uterus.add(body, cervix)
      uterus.position.set(0, 0.5, 0.02)
      this._registerOrgan('uterus', uterus)

      for (const [id, x] of [['leftOvary', -0.08], ['rightOvary', 0.08]]) {
        const ov = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 14, 12),
          this._organMat(id)
        )
        ov.scale.set(1, 0.75, 0.7)
        ov.position.set(x, 0.52, 0.02)
        this._registerOrgan(id, ov)
      }
    } else {
      this._addSimpleOrgan(
        'prostate',
        new THREE.SphereGeometry(0.028, 14, 12),
        new THREE.Vector3(0, 0.435, 0.0),
        new THREE.Vector3(1.25, 0.7, 0.95)
      )
      for (const [id, x] of [['leftTestis', -0.038], ['rightTestis', 0.038]]) {
        const t = new THREE.Mesh(
          new THREE.SphereGeometry(0.026, 14, 12),
          this._organMat(id)
        )
        t.scale.set(0.85, 1.2, 0.8)
        t.position.set(x, 0.32, 0.05)
        this._registerOrgan(id, t)
      }
    }
  }

  _buildVesselPaths() {
    return [[
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
    ]]
  }

  _buildDigestPath() {
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
      if (m.material?.color) m.material.color.copy(c)
    }
  }

  /** translucent | solid | hidden */
  setSkinMode(mode) {
    state.skinMode = mode
    const map = { translucent: 0.34, solid: 0.78, hidden: 0 }
    const opacity = map[mode] ?? 0.28
    this._skinOpacity = opacity
    for (const m of this.skinMeshes) {
      if (!m.material) continue
      m.visible = opacity > 0.01
      m.material.opacity = opacity
      m.material.transparent = opacity < 0.95
      m.material.depthWrite = opacity >= 0.7
      if (m.material.transmission !== undefined) {
        m.material.transmission = mode === 'solid' ? 0.02 : 0.1
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
          c.material.emissiveIntensity = state.health === 'healthy' ? 0.06 : 0.02
        }
      })
    }
  }

  update(dt, time) {
    const heart = this.organMeshes.heart
    if (heart) {
      const bpm = state.heartRate
      const freq = (bpm / 60) * state.simSpeed
      const beat = 1 + 0.1 * Math.max(0, Math.sin(time * freq * Math.PI * 2)) ** 2
      heart.scale.setScalar(1.08 * beat)
    }

    const breathe = 1 + 0.04 * Math.sin(time * 1.2 * state.simSpeed)
    for (const id of ['leftLung', 'rightLung']) {
      const lung = this.organMeshes[id]
      if (lung) lung.scale.set(breathe, 1 + (breathe - 1) * 1.5, breathe)
    }

    const gutActivity = state.digestion.gutActivity
    if (gutActivity > 0.05) {
      const small = this.organMeshes.smallIntestine
      const large = this.organMeshes.largeIntestine
      if (small) {
        small.rotation.y = Math.sin(time * 2 * state.simSpeed) * 0.06 * gutActivity
      }
      if (large) {
        large.rotation.y = Math.sin(time * 1.5 * state.simSpeed + 1) * 0.03 * gutActivity
      }
    }
  }

  highlightOrgan(id) {
    for (const [oid, mesh] of Object.entries(this.organMeshes)) {
      mesh.traverse((c) => {
        if (!c.isMesh || !c.material || c.material.emissiveIntensity === undefined) return
        if (oid === id) {
          c.material.emissiveIntensity = 0.35
        } else if (oid === 'heart') {
          c.material.emissiveIntensity = 0.06
        } else {
          c.material.emissiveIntensity = 0.03
        }
      })
    }
  }

  clearHighlight() {
    this.highlightOrgan(null)
  }
}

export { ORGAN_META, SYSTEM_LABELS }
