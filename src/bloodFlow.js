import * as THREE from 'three'
import { state } from './state.js'

/**
 * Stylized blood-flow particles traveling along vessel polylines.
 */
export class BloodFlow {
  constructor(scene, body) {
    this.scene = scene
    this.body = body
    this.group = new THREE.Group()
    this.group.name = 'bloodFlow'
    scene.add(this.group)

    this.count = 48
    this.progress = new Float32Array(this.count)
    this.speeds = new Float32Array(this.count)

    const geo = new THREE.SphereGeometry(0.018, 6, 6)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      emissive: 0xaa1a28,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    })

    this.meshes = []
    for (let i = 0; i < this.count; i++) {
      const m = new THREE.Mesh(geo, mat.clone())
      this.progress[i] = i / this.count
      this.speeds[i] = 0.15 + Math.random() * 0.2
      this.group.add(m)
      this.meshes.push(m)
    }

    // Soft vessel tubes (visual guide)
    this._buildVesselTubes()
  }

  _buildVesselTubes() {
    const paths = this.body.vesselPaths
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x8b1e2d,
      transparent: true,
      opacity: 0.35,
      roughness: 0.5,
      depthWrite: false,
    })

    for (const pts of paths) {
      if (pts.length < 2) continue
      const curve = new THREE.CatmullRomCurve3(pts)
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.012, 6, false),
        tubeMat
      )
      
      // Tubes live in body local space via parenting
      this.body.root.add(tube)
      tube.userData.isVessel = true
    }
  }

  rebuild() {
    // Remove old vessel tubes from body
    const toRemove = []
    this.body.root.traverse((c) => {
      if (c.userData?.isVessel) toRemove.push(c)
    })
    for (const c of toRemove) {
      c.parent?.remove(c)
      c.geometry?.dispose()
    }
    this._buildVesselTubes()
  }

  update(dt) {
    const paths = this.body.vesselPaths
    if (!paths.length) return
    const pts = paths[0]
    const curve = new THREE.CatmullRomCurve3(pts)
    const intensity = state.bloodFlowIntensity * (0.7 + state.digestion.energyBoost * 0.3)
    const speedMul = state.simSpeed * intensity

    // Color: healthy bright red vs unhealthy dull
    const baseColor = state.health === 'healthy' ? 0xe63946 : 0x9a4a4a
    const emissive = state.health === 'healthy' ? 0xaa1a28 : 0x4a2020

    for (let i = 0; i < this.count; i++) {
      this.progress[i] = (this.progress[i] + dt * this.speeds[i] * speedMul) % 1
      const local = curve.getPointAt(this.progress[i])
      // Transform by body root world matrix
      const world = local.clone()
      this.body.root.localToWorld(world)
      this.meshes[i].position.copy(world)
      const s = 0.7 + intensity * 0.5
      this.meshes[i].scale.setScalar(s)
      this.meshes[i].material.color.setHex(baseColor)
      this.meshes[i].material.emissive.setHex(emissive)
      this.meshes[i].material.emissiveIntensity = 0.4 + intensity * 0.4
      this.meshes[i].visible = intensity > 0.15
    }
  }
}
