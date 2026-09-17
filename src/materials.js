import * as THREE from 'three'

/** Soft PBR organ materials — textbook colors, low emissive (not toy glow). */
export function makeOrganMaterial(hex, opts = {}) {
  const {
    roughness = 0.55,
    metalness = 0.02,
    opacity = 1,
    emissiveIntensity = 0.04,
    clearcoat = 0.15,
  } = opts
  const color = new THREE.Color(hex)
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    emissive: color.clone().multiplyScalar(0.35),
    emissiveIntensity,
    clearcoat,
    clearcoatRoughness: 0.55,
    sheen: 0.25,
    sheenRoughness: 0.7,
    sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.2),
    transparent: opacity < 0.99,
    opacity,
    depthWrite: opacity >= 0.95,
  })
  return mat
}

export function makeSkinMaterial(hex, opacity = 0.28) {
  const color = new THREE.Color(hex)
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.72,
    metalness: 0.0,
    transmission: 0.08,
    thickness: 0.35,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    clearcoat: 0.08,
    clearcoatRoughness: 0.8,
    sheen: 0.4,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(0xffc9a8),
  })
}

export function makeScleraMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf4f1ea,
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
  })
}

export function makeIrisMaterial(hex = 0x3a5a7a) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.55,
    metalness: 0.05,
    emissive: hex,
    emissiveIntensity: 0.05,
  })
}

export function makePupilMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.4,
    metalness: 0.1,
  })
}
