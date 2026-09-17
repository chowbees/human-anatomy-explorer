import * as THREE from 'three'

/** Smooth lathe from [x,y] profile pairs (x = radius). */
export function latheFromProfile(profile, segments = 28) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(pts, segments)
}

/** Bean / kidney outline extruded. */
export function beanGeometry(scale = 1, depth = 0.035) {
  const shape = new THREE.Shape()
  // Classic kidney bean silhouette in XY (will be rotated)
  shape.moveTo(0.0, 0.55)
  shape.bezierCurveTo(0.45, 0.55, 0.55, 0.2, 0.45, -0.15)
  shape.bezierCurveTo(0.35, -0.45, 0.1, -0.55, 0.0, -0.55)
  shape.bezierCurveTo(-0.1, -0.55, -0.35, -0.45, -0.45, -0.15)
  shape.bezierCurveTo(-0.55, 0.2, -0.35, 0.45, -0.15, 0.35)
  // Hilum notch
  shape.bezierCurveTo(-0.05, 0.25, 0.05, 0.25, 0.0, 0.55)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 20,
  })
  geo.center()
  geo.scale(scale * 0.1, scale * 0.1, scale)
  return geo
}

/** Pear / gallbladder / bladder-ish lathe. */
export function pearGeometry(height = 0.08, belly = 0.035) {
  const pts = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const y = -height * 0.5 + t * height
    // Wider at bottom third, taper at top (neck)
    const bellyWave = Math.sin(t * Math.PI)
    const neck = t > 0.65 ? (1 - (t - 0.65) / 0.35) * 0.55 + 0.45 : 1
    const r = belly * (0.35 + 0.65 * bellyWave) * neck
    pts.push(new THREE.Vector2(Math.max(0.004, r), y))
  }
  return new THREE.LatheGeometry(pts, 24)
}

/** J-shaped stomach lathe with fundus bulge. */
export function stomachLathe() {
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const y = -0.08 + t * 0.16
    let r
    if (t < 0.25) {
      // Cardia / fundus
      r = 0.03 + 0.04 * Math.sin((t / 0.25) * Math.PI * 0.5)
    } else if (t < 0.7) {
      // Body
      r = 0.055 + 0.02 * Math.sin(((t - 0.25) / 0.45) * Math.PI)
    } else {
      // Pyloric antrum — taper
      const u = (t - 0.7) / 0.3
      r = 0.045 * (1 - u * 0.7) + 0.012
    }
    pts.push(new THREE.Vector2(r, y))
  }
  return new THREE.LatheGeometry(pts, 28)
}

/** Lobed liver wedge via merged spheres — returns Group factory args as geometries for caller. */
export function deformVertices(geometry, fn) {
  const pos = geometry.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    fn(v, i)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** Brain hemisphere with shallow sulcus ridges (vertex displace). */
export function brainHemisphere(radius = 0.1, isLeft = true) {
  const geo = new THREE.SphereGeometry(radius, 36, 28, 0, Math.PI)
  deformVertices(geo, (v) => {
    // Flatten medial face slightly
    if (isLeft ? v.x > -0.01 : v.x < 0.01) {
      /* keep */
    }
    // Sulci: radial grooves
    const theta = Math.atan2(v.z, v.x)
    const phi = Math.acos(THREE.MathUtils.clamp(v.y / radius, -1, 1))
    const groove =
      0.006 * Math.sin(theta * 8) * Math.sin(phi * 6) +
      0.004 * Math.sin(theta * 14 + phi * 3)
    const n = v.clone().normalize()
    v.addScaledVector(n, groove)
  })
  return geo
}

/** Coiled tube along CatmullRom path. */
export function tubeAlongPoints(points, radius = 0.02, tubular = 64, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points)
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false)
}

/** Spiral / coiled small-intestine centerline. */
export function smallIntestinePoints() {
  const pts = []
  const turns = 5.5
  const steps = 72
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const ang = t * turns * Math.PI * 2
    const r = 0.07 + 0.025 * Math.sin(t * Math.PI * 3)
    const y = 0.78 - t * 0.28
    const x = Math.cos(ang) * r * (0.85 + 0.15 * Math.sin(t * 9))
    const z = 0.04 + Math.sin(ang) * r * 0.55
    pts.push(new THREE.Vector3(x, y, z))
  }
  return pts
}

/** Large intestine / colon frame points. */
export function colonPoints() {
  return [
    new THREE.Vector3(-0.13, 0.58, 0.05), // cecum / ascending start
    new THREE.Vector3(-0.13, 0.68, 0.05),
    new THREE.Vector3(-0.13, 0.8, 0.04),
    new THREE.Vector3(-0.06, 0.84, 0.05), // hepatic flexure
    new THREE.Vector3(0.0, 0.85, 0.06), // transverse
    new THREE.Vector3(0.08, 0.84, 0.05),
    new THREE.Vector3(0.13, 0.8, 0.04), // splenic flexure
    new THREE.Vector3(0.13, 0.68, 0.05),
    new THREE.Vector3(0.12, 0.56, 0.05), // descending
    new THREE.Vector3(0.06, 0.5, 0.05), // sigmoid
    new THREE.Vector3(0.02, 0.46, 0.04),
    new THREE.Vector3(0.0, 0.43, 0.03),
  ]
}

/** Torso silhouette profile for lathe (radius, y). Humanoid hourglass, not capsule. */
export function torsoProfile(isFemale, shoulderW, waistW, hipW) {
  const s = shoulderW
  const w = waistW
  const h = hipW
  if (isFemale) {
    return [
      [h * 0.42, 0.46],
      [h * 0.88, 0.52],
      [h * 1.02, 0.58],
      [h * 0.98, 0.66],
      [w * 0.92, 0.78],
      [w * 0.88, 0.9],
      [s * 0.62, 1.02],
      [s * 0.92, 1.14],
      [s * 1.02, 1.24],
      [s * 0.95, 1.32],
      [s * 0.55, 1.38],
      [0.07, 1.43],
    ]
  }
  return [
    [h * 0.4, 0.46],
    [h * 0.85, 0.52],
    [h * 0.95, 0.58],
    [h * 0.9, 0.66],
    [w * 0.95, 0.78],
    [w * 1.0, 0.9],
    [s * 0.7, 1.04],
    [s * 0.98, 1.16],
    [s * 1.08, 1.26],
    [s * 1.0, 1.34],
    [s * 0.58, 1.4],
    [0.075, 1.45],
  ]
}

/** Head cranial lathe — egg / oval skull. */
export function skullGeometry() {
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const ang = t * Math.PI
    // Slightly elongated vertically, flatter face
    const rx = 0.135 * (0.92 + 0.08 * Math.sin(ang))
    const y = -0.12 + Math.cos(Math.PI - ang) * 0.155
    // Narrow chin
    const chin = t < 0.25 ? 0.7 + 0.3 * (t / 0.25) : 1
    pts.push(new THREE.Vector2(rx * chin, y))
  }
  return new THREE.LatheGeometry(pts, 32)
}

/** Heart classic shape via lathe of cardioid-ish profile + slight squash. */
export function heartLathe() {
  const pts = []
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    const y = 0.09 - t * 0.18
    let r
    if (t < 0.35) {
      // Upper lobes
      r = 0.02 + 0.055 * Math.sin((t / 0.35) * Math.PI)
    } else {
      // Pointed apex
      const u = (t - 0.35) / 0.65
      r = 0.06 * (1 - u) * (1 - u * 0.3) + 0.004
    }
    pts.push(new THREE.Vector2(Math.max(0.003, r), y))
  }
  return new THREE.LatheGeometry(pts, 28)
}

/** Lung lobe ellipsoid with apex. */
export function lungMainGeometry(isLeft) {
  const geo = new THREE.SphereGeometry(0.11, 36, 28)
  deformVertices(geo, (v) => {
    // Elongate into conical lung (wide base, pointed apex)
    const ny = (v.y + 0.11) / 0.22 // 0 at base → 1 at apex
    const taper = 1 - ny * 0.45
    v.x *= (isLeft ? 0.7 : 0.76) * taper
    v.y *= 1.65
    v.z *= 0.78 * taper
    // Concavity on medial face (toward heart)
    const medial = isLeft ? v.x > 0 : v.x < 0
    if (medial) {
      v.x *= 0.82
    }
    // Cardiac notch on left
    if (isLeft && v.x > 0.015 && v.y < 0.06 && v.y > -0.1) {
      v.x *= 0.62
      v.z *= 0.9
    }
    // Gentle costal curve
    const bulge = 1 + 0.08 * Math.sin(Math.max(0, 1 - Math.abs(v.y / 0.15)) * Math.PI)
    v.z *= bulge
  })
  return geo
}

/** Add haustra bulges along a colon tube by scaling radial verts — optional post. */
export function addHaustrumHint(tubeGeo, strength = 0.012) {
  const pos = tubeGeo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    // Approximate along-path index via y + x
    const wave = Math.sin((v.y * 40 + v.x * 20) * 1.2)
    const n = new THREE.Vector3(v.x, 0, v.z).normalize()
    if (n.lengthSq() > 0.01) {
      v.addScaledVector(n, wave * strength)
    }
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  tubeGeo.computeVertexNormals()
  return tubeGeo
}
