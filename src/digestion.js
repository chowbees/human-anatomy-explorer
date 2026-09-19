import * as THREE from 'three'
import { state, FOOD_PROFILES, NUTRIENT_KEYS, NUTRIENT_META } from './state.js'

/**
 * Eating simulation with distinct nutrient breakdowns per food.
 * Reactions are stylized / educational only — not clinical digestion kinetics.
 */
export class DigestionSystem {
  constructor(scene, body, onStatus) {
    this.scene = scene
    this.body = body
    this.onStatus = onStatus
    this.bolus = null
    this.pathTube = null
    this.particles = []
    this._energyPulse = null
    this.onNutrients = null // (nutrients, stage, profile) => void
  }

  canEat() {
    return !state.digestion.active
  }

  start(foodKey) {
    const profile = FOOD_PROFILES[foodKey]
    if (!profile || state.digestion.active) return false

    this.body.digestPath = this.body._buildDigestPath()

    state.digestion = {
      active: true,
      food: foodKey,
      progress: 0,
      stage: 'mouth',
      energyBoost: 0,
      gutActivity: 0,
      duration: profile.duration / (state.digestionSpeed * profile.digestionMul),
      elapsed: 0,
      nutrients: {
        energy: 0,
        vitamins: 0,
        protein: 0,
        carbs: 0,
        fiber: 0,
        minerals: 0,
      },
    }

    this._spawnBolus(profile.color)
    this._showPath(profile.color)
    this._setStatus(`${profile.label}: entering mouth… (${profile.note})`)
    this._emitNutrients()
    return true
  }

  _spawnBolus(color) {
    this._clearBolus()
    const geo = new THREE.SphereGeometry(0.022, 12, 10)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.22,
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
      new THREE.TubeGeometry(curve, 64, 0.01, 6, false),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.12,
        transparent: true,
        opacity: 0.28,
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

  _clearParticles() {
    for (const p of this.particles) {
      p.mesh.parent?.remove(p.mesh)
      p.mesh.geometry?.dispose()
      p.mesh.material?.dispose()
      if (p.sprite) {
        p.sprite.parent?.remove(p.sprite)
        p.sprite.material.map?.dispose?.()
        p.sprite.material.dispose?.()
      }
    }
    this.particles = []
    if (this._energyPulse) {
      this._energyPulse.parent?.remove(this._energyPulse)
      this._energyPulse.geometry?.dispose()
      this._energyPulse.material?.dispose()
      this._energyPulse = null
    }
  }

  _stageFromProgress(p) {
    if (p < 0.1) return 'mouth'
    if (p < 0.22) return 'esophagus'
    if (p < 0.42) return 'stomach'
    if (p < 0.72) return 'smallIntestine'
    if (p < 0.95) return 'largeIntestine'
    return 'complete'
  }

  /**
   * Stylized release curve: different nutrients peak at different stages.
   */
  _releaseFactors(stage, progress) {
    // stage windows
    const inStomach = progress >= 0.22 && progress < 0.5
    const inSmall = progress >= 0.42 && progress < 0.78
    const inLarge = progress >= 0.72
    return {
      energy: inStomach || inSmall ? Math.min(1, (progress - 0.25) * 2.2) : progress > 0.5 ? 0.85 : 0.1,
      vitamins: inSmall ? Math.min(1, (progress - 0.42) * 3) : inStomach ? 0.25 : 0,
      protein: inStomach ? Math.min(1, (progress - 0.22) * 2.5) : inSmall ? 0.9 : 0,
      carbs: inStomach || inSmall ? Math.min(1, (progress - 0.2) * 2.4) : 0,
      fiber: inLarge ? Math.min(1, (progress - 0.7) * 4) : inSmall ? 0.35 : 0,
      minerals: inSmall ? Math.min(1, (progress - 0.4) * 3.2) : inStomach ? 0.2 : 0,
    }
  }

  _emitNutrients() {
    const d = state.digestion
    const profile = FOOD_PROFILES[d.food]
    if (!profile || !this.onNutrients) return
    this.onNutrients({ ...d.nutrients }, d.stage, profile)
  }

  _setStatus(msg) {
    if (this.onStatus) this.onStatus(msg, true)
  }

  _highlightDigestStage(stage) {
    if (this.body.mode === 'hra') {
      const map = {
        esophagus: 'larynx',
        stomach: 'smallIntestine',
        smallIntestine: 'smallIntestine',
        largeIntestine: 'largeIntestine',
      }
      const id = map[stage]
      if (!id) {
        this.body.clearHighlight()
        return
      }
      this.body.highlightOrgan(id)
      return
    }
    const map = {
      esophagus: 'Esophagus',
      stomach: 'Stomach',
      smallIntestine: 'Duodenum',
      largeIntestine: 'Transverse colon',
    }
    const name = map[stage]
    if (!name) {
      this.body.clearHighlight()
      return
    }
    const id = this.body.findPartByExactName(name)
    if (id) this.body.highlightOrgan(id)
  }

  _spawnNutrientParticle(kind, worldPos) {
    const meta = NUTRIENT_META[kind]
    if (!meta) return
    const color = new THREE.Color(meta.color)
    const geo = new THREE.SphereGeometry(0.008, 8, 6)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(worldPos)
    this.scene.add(mesh)

    // Label sprite
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 48
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(18,26,43,0.8)'
    ctx.fillRect(4, 8, 120, 32)
    ctx.fillStyle = meta.color
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(meta.label.slice(0, 10), 64, 30)
    const tex = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    )
    sprite.scale.set(0.1, 0.038, 1)
    sprite.position.copy(worldPos).add(new THREE.Vector3(0, 0.025, 0))
    this.scene.add(sprite)

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.08,
      0.04 + Math.random() * 0.06,
      (Math.random() - 0.5) * 0.08
    )
    // Energy particles drift toward heart / body center
    if (kind === 'energy') {
      const heart =
        this.body.getOrganWorldPosition(
          this.body.mode === 'hra' ? 'heart' : this.body.findPartByExactName('Wall of ventricle')
        ) || new THREE.Vector3(0, 1.1, 0)
      vel.copy(heart).sub(worldPos).normalize().multiplyScalar(0.12)
    }
    // Vitamins/minerals linger near small intestine (absorption highlight)
    if (kind === 'vitamins' || kind === 'minerals') {
      vel.y *= 0.3
      vel.multiplyScalar(0.4)
    }

    this.particles.push({
      mesh,
      sprite,
      vel,
      life: 1.4 + Math.random() * 0.6,
      age: 0,
      kind,
    })
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.age += dt
      p.mesh.position.addScaledVector(p.vel, dt)
      if (p.sprite) p.sprite.position.copy(p.mesh.position).add(new THREE.Vector3(0, 0.025, 0))
      const fade = 1 - p.age / p.life
      p.mesh.material.opacity = Math.max(0, fade)
      if (p.sprite) p.sprite.material.opacity = Math.max(0, fade)
      p.mesh.scale.setScalar(0.7 + fade * 0.5)
      if (p.age >= p.life) {
        p.mesh.parent?.remove(p.mesh)
        p.mesh.geometry.dispose()
        p.mesh.material.dispose()
        if (p.sprite) {
          p.sprite.parent?.remove(p.sprite)
          p.sprite.material.map?.dispose?.()
          p.sprite.material.dispose()
        }
        this.particles.splice(i, 1)
      }
    }
  }

  _maybeSpawnFromRelease(profile, factors, worldPos, dt) {
    // Spawn rate proportional to newly rising nutrients
    for (const key of NUTRIENT_KEYS) {
      const target = (profile.nutrients[key] || 0) * (factors[key] || 0)
      const prev = state.digestion.nutrients[key] || 0
      if (target > prev + 0.04 && Math.random() < dt * 8 * target) {
        this._spawnNutrientParticle(key, worldPos.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.03, Math.random() * 0.02, (Math.random() - 0.5) * 0.03)
        ))
      }
      state.digestion.nutrients[key] = Math.max(prev, target)
    }
  }

  update(dt) {
    const d = state.digestion
    this._updateParticles(dt)

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
        stomach: 'in stomach — breaking down',
        smallIntestine: 'in small intestine — absorbing',
        largeIntestine: 'in large intestine — fiber & water',
        complete: 'digestion complete',
      }
      this._setStatus(`${profile.label}: ${labels[stage]}… (${profile.note})`)
      this._highlightDigestStage(stage)
    }

    const factors = this._releaseFactors(stage, d.progress)
    const ease = Math.sin(d.progress * Math.PI)
    d.energyBoost = profile.energy * ease * (0.4 + 0.6 * (factors.energy || 0))
    d.gutActivity = profile.gutActivity * (0.3 + 0.7 * Math.min(1, d.progress * 1.4))
    state.energy = 0.5 + d.energyBoost * 0.45

    // Bolus color shift by stage
    if (this.bolus && profile.bolusStages) {
      const hex = profile.bolusStages[stage] || profile.color
      this.bolus.material.color.setHex(hex)
      this.bolus.material.emissive.setHex(hex)
    }

    if (this.pathTube?.material) {
      this.pathTube.material.opacity = 0.25 + 0.35 * (1 - d.progress)
    }

    const path = this.body.digestPath
    let world = null
    if (this.bolus && path.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(path)
      const local = curve.getPointAt(Math.min(0.999, d.progress))
      world = local.clone()
      this.body.root.localToWorld(world)
      this.bolus.position.copy(world)
      const pulse = 1 + 0.15 * Math.sin(d.elapsed * 6)
      this.bolus.scale.setScalar(pulse * (1.15 - d.progress * 0.45))
    }

    if (world && (stage === 'stomach' || stage === 'smallIntestine' || stage === 'largeIntestine')) {
      this._maybeSpawnFromRelease(profile, factors, world, dt)
    }

    // Absorption highlight pulse on small intestine
    if (stage === 'smallIntestine' && (factors.vitamins > 0.3 || factors.minerals > 0.3)) {
      const id =
        this.body.mode === 'hra'
          ? 'smallIntestine'
          : this.body.findPartByExactName('Duodenum')
      if (id) this.body.highlightOrgan(id)
    }

    // Energy pulse toward body
    if (factors.energy > 0.5 && world && !this._energyPulse) {
      const geo = new THREE.SphereGeometry(0.03, 12, 10)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe6c07b,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
      this._energyPulse = new THREE.Mesh(geo, mat)
      this._energyPulse.position.copy(world)
      this.scene.add(this._energyPulse)
    }
    if (this._energyPulse) {
      this._energyPulse.scale.multiplyScalar(1 + dt * 1.5)
      this._energyPulse.material.opacity *= 1 - dt * 1.2
      if (this._energyPulse.material.opacity < 0.05) {
        this._energyPulse.parent?.remove(this._energyPulse)
        this._energyPulse.geometry.dispose()
        this._energyPulse.material.dispose()
        this._energyPulse = null
      }
    }

    this._emitNutrients()

    if (d.progress >= 1) {
      d.active = false
      d.stage = 'idle'
      d.energyBoost = profile.energy * 0.35
      d.gutActivity = profile.gutActivity * 0.25
      // Leave nutrient bars at final released values briefly
      for (const k of NUTRIENT_KEYS) {
        d.nutrients[k] = profile.nutrients[k] || 0
      }
      this._clearBolus()
      this._clearPath()
      this.body.clearHighlight()
      this._setStatus(`${profile.label}: digested (stylized). Nutrients absorbed — educational model only.`)
      this._emitNutrients()
      setTimeout(() => {
        if (!state.digestion.active) {
          this._clearParticles()
          for (const k of NUTRIENT_KEYS) state.digestion.nutrients[k] = 0
          this._emitNutrients()
          if (this.onStatus) this.onStatus('No active digestion', false)
        }
      }, 4000)
    }
  }
}
