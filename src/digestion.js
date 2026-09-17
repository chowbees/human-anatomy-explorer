import * as THREE from 'three'
import { state, FOOD_PROFILES } from './state.js'

/**
 * Eating simulation: food bolus travels mouth → esophagus → stomach → intestines.
 * Reactions are stylized / educational only.
 */
export class DigestionSystem {
  constructor(scene, body, onStatus) {
    this.scene = scene
    this.body = body
    this.onStatus = onStatus
    this.bolus = null
    this.pathTube = null
  }

  canEat() {
    return !state.digestion.active
  }

  start(foodKey) {
    const profile = FOOD_PROFILES[foodKey]
    if (!profile || state.digestion.active) return false

    state.digestion = {
      active: true,
      food: foodKey,
      progress: 0,
      stage: 'mouth',
      energyBoost: 0,
      gutActivity: 0,
      duration: profile.duration / (state.digestionSpeed * profile.digestionMul),
      elapsed: 0,
    }

    this._spawnBolus(profile.color)
    this._showPath(profile.color)
    this._setStatus(`${profile.label}: entering mouth… (${profile.note})`)
    return true
  }

  _spawnBolus(color) {
    this._clearBolus()
    const geo = new THREE.SphereGeometry(0.045, 12, 10)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    })
    this.bolus = new THREE.Mesh(geo, mat)
    this.scene.add(this.bolus)
  }

  _showPath(color) {
    this._clearPath()
    const path = this.body.digestPath
    if (path.length < 2) return
    const curve = new THREE.CatmullRomCurve3(path)
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.014, 6, false),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    )
    tube.userData.isDigestPath = true
    this.body.root.add(tube)
    this.pathTube = tube
  }

  _clearBolus() {
    if (this.bolus) {
      this.scene.remove(this.bolus)
      this.bolus.geometry?.dispose()
      this.bolus.material?.dispose()
      this.bolus = null
    }
  }

  _clearPath() {
    if (this.pathTube) {
      this.pathTube.parent?.remove(this.pathTube)
      this.pathTube.geometry?.dispose()
      this.pathTube.material?.dispose()
      this.pathTube = null
    }
  }

  _stageFromProgress(p) {
    if (p < 0.1) return 'mouth'
    if (p < 0.28) return 'esophagus'
    if (p < 0.48) return 'stomach'
    if (p < 0.75) return 'smallIntestine'
    if (p < 0.95) return 'largeIntestine'
    return 'complete'
  }

  _setStatus(msg) {
    if (this.onStatus) this.onStatus(msg, true)
  }

  update(dt) {
    const d = state.digestion
    if (!d.active) {
      state.digestion.energyBoost = Math.max(0, state.digestion.energyBoost - dt * 0.05)
      state.digestion.gutActivity = Math.max(0, state.digestion.gutActivity - dt * 0.08)
      state.energy = 0.5 + state.digestion.energyBoost * 0.4
      return
    }

    const profile = FOOD_PROFILES[d.food]
    d.elapsed += dt * state.simSpeed
    d.progress = Math.min(1, d.elapsed / Math.max(d.duration, 0.01))
    const stage = this._stageFromProgress(d.progress)
    if (stage !== d.stage) {
      d.stage = stage
      const labels = {
        mouth: 'in mouth',
        esophagus: 'descending esophagus',
        stomach: 'in stomach',
        smallIntestine: 'in small intestine',
        largeIntestine: 'in large intestine',
        complete: 'digestion complete',
      }
      this._setStatus(`${profile.label}: ${labels[stage]}… (${profile.note})`)
    }

    const ease = Math.sin(d.progress * Math.PI)
    d.energyBoost = profile.energy * ease
    d.gutActivity = profile.gutActivity * (0.3 + 0.7 * Math.min(1, d.progress * 1.4))
    state.energy = 0.5 + d.energyBoost * 0.45

    if (this.pathTube?.material) {
      this.pathTube.material.opacity = 0.25 + 0.35 * (1 - d.progress)
    }

    const path = this.body.digestPath
    if (this.bolus && path.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(path)
      const local = curve.getPointAt(Math.min(0.999, d.progress))
      const world = local.clone()
      this.body.root.localToWorld(world)
      this.bolus.position.copy(world)
      const pulse = 1 + 0.15 * Math.sin(d.elapsed * 6)
      this.bolus.scale.setScalar(pulse * (1.15 - d.progress * 0.45))
    }

    if (stage === 'stomach') this.body.highlightOrgan('stomach')
    else if (stage === 'smallIntestine') this.body.highlightOrgan('smallIntestine')
    else if (stage === 'largeIntestine') this.body.highlightOrgan('largeIntestine')
    else if (stage === 'esophagus') this.body.highlightOrgan('esophagus')

    if (d.progress >= 1) {
      d.active = false
      d.stage = 'idle'
      d.energyBoost = profile.energy * 0.35
      d.gutActivity = profile.gutActivity * 0.25
      this._clearBolus()
      this._clearPath()
      this.body.clearHighlight()
      this._setStatus(`${profile.label}: digested (stylized). Residual energy lingering.`)
      setTimeout(() => {
        if (!state.digestion.active && this.onStatus) {
          this.onStatus('No active digestion', false)
        }
      }, 3500)
    }
  }
}
