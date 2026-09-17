import * as THREE from 'three'
import { state } from './state.js'

/**
 * Subtle blood-flow particles along a path derived from heart → body landmarks.
 * When HRA vasculature is loaded, it is shown as the vessel mesh; particles still run.
 */
export class BloodFlow {
  constructor(scene, body) {
    this.scene = scene
    this.body = body
    this.group = new THREE.Group()
    this.group.name = 'bloodFlow'
    scene.add(this.group)

    this.count = 22
    this.progress = new Float32Array(this.count)
    this.speeds = new Float32Array(this.count)

    const geo = new THREE.SphereGeometry(0.005, 8, 8)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb8323c,
      emissive: 0x6a1520,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })

    this.meshes = []
    for (let i = 0; i < this.count; i++) {
      const m = new THREE.Mesh(geo, mat.clone())
      this.progress[i] = i / this.count
      this.speeds[i] = 0.12 + Math.random() * 0.16
      this.group.add(m)
      this.meshes.push(m)
    }

    this._guideTubes = []
    this._buildVesselTubes()
  }

  _clearGuideTubes() {
    for (const t of this._guideTubes) {
      t.parent?.remove(t)
      t.geometry?.dispose()
      t.material?.dispose()
    }
    this._guideTubes = []
  }

  _buildVesselTubes() {
    this._clearGuideTubes()

    // If HRA vasculature GLB is present, skip synthetic tubes (mesh is the vessel)
    if (this.body.organMeshes.vasculature) {
      const vas = this.body.organMeshes.vasculature
      vas.traverse((c) => {
        if (!c.isMesh || !c.material) return
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        for (const mat of mats) {
          mat.transparent = true
          mat.opacity = Math.min(mat.opacity ?? 1, 0.55)
          mat.depthWrite = false
          if (mat.color) mat.color.lerp(new THREE.Color(0x8a3038), 0.35)
        }
      })
      return
    }

    const paths = this.body.vesselPaths
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x7a2832,
      transparent: true,
      opacity: 0.14,
      roughness: 0.55,
      depthWrite: false,
    })

    for (const pts of paths) {
      if (pts.length < 2) continue
      const curve = new THREE.CatmullRomCurve3(pts)
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.004, 6, false),
        tubeMat
      )
      tube.userData.isVessel = true
      this.body.root.add(tube)
      this._guideTubes.push(tube)
    }
  }

  rebuild() {
    this.body.vesselPaths = this.body._buildVesselPaths?.() || this.body.vesselPaths
    this._buildVesselTubes()
  }

  update(dt) {
    const paths = this.body.vesselPaths
    if (!paths.length) {
      for (const m of this.meshes) m.visible = false
      return
    }
    const pts = paths[0]
    if (pts.length < 2) return
    const curve = new THREE.CatmullRomCurve3(pts)
    const intensity = state.bloodFlowIntensity * (0.7 + state.digestion.energyBoost * 0.3)
    const speedMul = state.simSpeed * intensity

    const baseColor = state.health === 'healthy' ? 0xb8323c : 0x8a5555
    const emissive = state.health === 'healthy' ? 0x6a1520 : 0x3a2020

    for (let i = 0; i < this.count; i++) {
      this.progress[i] = (this.progress[i] + dt * this.speeds[i] * speedMul) % 1
      const local = curve.getPointAt(this.progress[i])
      const world = local.clone()
      this.body.root.localToWorld(world)
      this.meshes[i].position.copy(world)
      const s = 0.55 + intensity * 0.35
      this.meshes[i].scale.setScalar(s)
      this.meshes[i].material.color.setHex(baseColor)
      this.meshes[i].material.emissive.setHex(emissive)
      this.meshes[i].material.emissiveIntensity = 0.15 + intensity * 0.2
      this.meshes[i].material.opacity = 0.45 + intensity * 0.3
      this.meshes[i].visible = intensity > 0.15
    }
  }
}
