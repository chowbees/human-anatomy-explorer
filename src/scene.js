import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { AnatomyBody } from './body.js'
import { BloodFlow } from './bloodFlow.js'
import { DigestionSystem } from './digestion.js'
import { state } from './state.js'

export class AnatomyScene {
  constructor(canvas, ui) {
    this.canvas = canvas
    this.ui = ui
    this.clock = new THREE.Clock()
    this.focusTween = null
    this._hoverId = null
    this._bodyReady = false

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xc8d2de)
    this.scene.fog = new THREE.Fog(0xc8d2de, 6, 16)

    this.camera = new THREE.PerspectiveCamera(
      42,
      canvas.clientWidth / Math.max(canvas.clientHeight, 1),
      0.05,
      100
    )
    this.defaultCamPos = new THREE.Vector3(1.15, 1.05, 2.6)
    this.defaultTarget = new THREE.Vector3(0, 0.85, 0)
    this.camera.position.copy(this.defaultCamPos)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.copy(this.defaultTarget)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.25
    this.controls.maxDistance = 8
    this.controls.maxPolarAngle = Math.PI * 0.95

    this._lights()
    this._floor()

    this.body = new AnatomyBody(this.scene, {
      onProgress: (p) => this.ui.setLoadProgress?.(p),
      onReady: (info) => this._onBodyReady(info),
    })
    this.blood = new BloodFlow(this.scene, this.body)
    this.digestion = new DigestionSystem(this.scene, this.body, (msg, active) => {
      ui.setDigestionStatus(msg, active)
    })
    this.digestion.onNutrients = (nutrients, stage, profile) => {
      ui.setNutrientPanel?.(nutrients, stage, profile)
    }

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this._proj = new THREE.Vector3()

    canvas.addEventListener('pointerdown', (e) => this._onPointer(e))
    canvas.addEventListener('pointermove', (e) => this._onHover(e))
    canvas.addEventListener('pointerleave', () => {
      this._hoverId = null
      if (!state.focusedOrgan) this.ui.setFloatLabel(null)
    })
    window.addEventListener('resize', () => this.resize())

    this._anim = this._anim.bind(this)
    requestAnimationFrame(this._anim)
  }

  _onBodyReady(info) {
    this._bodyReady = true
    this.blood.rebuild()
    this.ui.setLoadProgress?.({
      phase: 'done',
      loaded: 1,
      total: 1,
      fraction: 1,
      label: 'Ready',
    })
    this.ui.refreshOrganButtons?.(info)
    this.ui.syncSystemToggles?.(state.visibleSystems)
    this.ui.syncSexUI?.(state.sex, this.body.mode)
    this.ui.setInnerParts?.([])
    this._frameBody()
  }

  _frameBody() {
    const box = new THREE.Box3().setFromObject(this.body.root)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    this.defaultTarget.copy(center)
    const dist = Math.max(size.y * 1.35, size.x * 1.8, 2.2)
    this.defaultCamPos.set(center.x + dist * 0.35, center.y + size.y * 0.05, center.z + dist * 0.95)
    if (!state.focusedOrgan) {
      this.camera.position.copy(this.defaultCamPos)
      this.controls.target.copy(this.defaultTarget)
    }
    if (this._floorMesh) {
      this._floorMesh.position.y = box.min.y - 0.002
      this._floorRing.position.y = box.min.y - 0.001
    }
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0xf0f4fa, 0xb0a090, 0.55)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xfff6ea, 1.05)
    key.position.set(2.8, 5.2, 3.5)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xd8e4f8, 0.45)
    fill.position.set(-3.2, 2.2, -1.5)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0xe8f0ff, 0.35)
    rim.position.set(0.5, 3.5, -3.5)
    this.scene.add(rim)

    const soft = new THREE.PointLight(0xffe8d8, 0.25, 10)
    soft.position.set(-0.5, 1.8, 2.2)
    this.scene.add(soft)
  }

  _floor() {
    this._floorMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 64),
      new THREE.MeshStandardMaterial({
        color: 0xa8b4c4,
        roughness: 0.92,
        metalness: 0.04,
      })
    )
    this._floorMesh.rotation.x = -Math.PI / 2
    this._floorMesh.position.y = 0
    this.scene.add(this._floorMesh)

    this._floorRing = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.65, 64),
      new THREE.MeshStandardMaterial({
        color: 0x96a4b6,
        roughness: 0.95,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    )
    this._floorRing.rotation.x = -Math.PI / 2
    this._floorRing.position.y = 0.001
    this.scene.add(this._floorRing)
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  _setPointer(e) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    return rect
  }

  _pickVisible() {
    const hits = this.raycaster.intersectObjects(this.body.organHitTargets, false)
    for (const h of hits) {
      const mesh = h.object
      if (!mesh.visible) continue
      if (mesh.userData.system === 'integumentary') continue
      return mesh.userData.organId
    }
    for (const h of hits) {
      if (h.object.visible) return h.object.userData.organId
    }
    return null
  }

  _onPointer(e) {
    if (!this._bodyReady) return
    this._setPointer(e)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const id = this._pickVisible()
    if (id) this.focusOrgan(id)
  }

  _onHover(e) {
    if (!this._bodyReady) return
    const rect = this._setPointer(e)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const id = this._pickVisible()
    if (id) {
      this._hoverId = id
      const focus = this.body.getOrganFocusTarget(id)
      if (focus) {
        this._proj.copy(focus.target)
        this._proj.project(this.camera)
        const x = (this._proj.x * 0.5 + 0.5) * rect.width
        const y = (-this._proj.y * 0.5 + 0.5) * rect.height
        this.ui.setFloatLabel(focus.label, x, y)
      }
      this.canvas.style.cursor = 'pointer'
    } else {
      this._hoverId = null
      this.canvas.style.cursor = 'default'
      if (state.focusedOrgan) {
        const focus = this.body.getOrganFocusTarget(state.focusedOrgan)
        if (focus) {
          this._proj.copy(focus.target)
          this._proj.project(this.camera)
          const x = (this._proj.x * 0.5 + 0.5) * rect.width
          const y = (-this._proj.y * 0.5 + 0.5) * rect.height
          this.ui.setFloatLabel(focus.label, x, y)
        }
      } else {
        this.ui.setFloatLabel(null)
      }
    }
  }

  focusOrgan(id) {
    const focus = this.body.getOrganFocusTarget(id)
    if (!focus) return
    state.focusedOrgan = id
    this.body.highlightOrgan(id)
    const detail = focus.explanation
      ? `${focus.label} — ${focus.explanation}`
      : focus.label
    this.ui.setFocusLabel(detail)
    this.ui.setActiveOrgan(id)
    this.ui.setFloatLabel(focus.label, null, null, true)
    this._tweenCamera(focus.camera, focus.target, 0.85)

    // Interior / cutaway + inner-parts panel
    const items = this.body.enterInteriorView(id)
    this.ui.setInnerParts?.(items || [], (item) => this.focusInnerPart(item))
  }

  focusInnerPart(item) {
    if (!item) return
    if (item.schematic) {
      this.ui.setFocusLabel(`${item.label} — ${item.tip || 'Educational layer (schematic)'}`)
      return
    }
    const focus = this.body.focusInnerPart(item)
    if (focus) {
      state.focusedOrgan = item.partId
      this.ui.setFocusLabel(
        focus.explanation ? `${focus.label} — ${focus.explanation}` : focus.label
      )
      this.ui.setActiveOrgan(item.partId)
      this._tweenCamera(focus.camera, focus.target, 0.7)
    } else if (item.tip) {
      this.ui.setFocusLabel(`${item.label} — ${item.tip}`)
    }
  }

  focusShortcut(shortcutId) {
    const id = this.body.resolveShortcut(shortcutId)
    if (id) this.focusOrgan(id)
  }

  zoomOut() {
    state.focusedOrgan = null
    this.body.clearHighlight()
    this.body.clearInteriorView()
    this.ui.setFocusLabel('Full body view')
    this.ui.setActiveOrgan(null)
    this.ui.setFloatLabel(null)
    this.ui.setInnerParts?.([])
    this._tweenCamera(this.defaultCamPos.clone(), this.defaultTarget.clone(), 0.9)
  }

  async setSex(sex) {
    this._bodyReady = false
    this.zoomOut()
    // Stop any in-flight digestion when swapping datasets
    if (state.digestion.active) {
      state.digestion.active = false
      state.digestion.stage = 'idle'
      this.digestion._clearBolus?.()
      this.digestion._clearPath?.()
      this.digestion._clearParticles?.()
      this.ui.setDigestionStatus('No active digestion', false)
      this.ui.setNutrientPanel?.({}, 'idle', null)
    }
    this.ui.setLoadProgress?.({
      phase: 'chunks',
      loaded: 0,
      total: 1,
      fraction: 0,
      label: sex === 'female' ? 'Loading HuBMAP HRA female organs…' : 'Loading BodyParts3D atlas…',
    })
    await this.body.setSex(sex)
  }

  setSystems(systemIds) {
    this.body.applyVisibleSystems(systemIds)
    this.ui.syncSystemToggles?.(state.visibleSystems)
    this.blood.rebuild()
  }

  setSystem(systemId, enabled) {
    this.body.setSystemVisible(systemId, enabled)
    this.ui.syncSystemToggles?.(state.visibleSystems)
  }

  feed(food) {
    return this.digestion.start(food)
  }

  _tweenCamera(toPos, toTarget, duration) {
    this.focusTween = {
      t: 0,
      duration,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
    }
  }

  _anim() {
    requestAnimationFrame(this._anim)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime

    if (this.focusTween) {
      const tw = this.focusTween
      tw.t += dt
      const u = Math.min(1, tw.t / tw.duration)
      const e = 1 - (1 - u) ** 3
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
      if (u >= 1) this.focusTween = null
    }

    if (state.focusedOrgan && !this._hoverId) {
      const focus = this.body.getOrganFocusTarget(state.focusedOrgan)
      if (focus) {
        const rect = this.canvas.getBoundingClientRect()
        this._proj.copy(focus.target)
        this._proj.project(this.camera)
        if (this._proj.z < 1) {
          const x = (this._proj.x * 0.5 + 0.5) * rect.width
          const y = (-this._proj.y * 0.5 + 0.5) * rect.height
          this.ui.setFloatLabel(focus.label, x, y)
        }
      }
    }

    if (this._bodyReady) {
      this.body.update(dt, t)
      this.blood.update(dt)
      this.digestion.update(dt)
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    this.ui.updateReadouts()
  }
}
