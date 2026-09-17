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

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x0a101c, 0.045)

    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / Math.max(canvas.clientHeight, 1),
      0.1,
      100
    )
    this.defaultCamPos = new THREE.Vector3(0.9, 1.2, 2.8)
    this.defaultTarget = new THREE.Vector3(0, 0.85, 0)
    this.camera.position.copy(this.defaultCamPos)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.copy(this.defaultTarget)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.35
    this.controls.maxDistance = 8
    this.controls.maxPolarAngle = Math.PI * 0.95

    this._lights()
    this._floor()

    this.body = new AnatomyBody(this.scene)
    this.blood = new BloodFlow(this.scene, this.body)
    this.digestion = new DigestionSystem(this.scene, this.body, (msg, active) => {
      ui.setDigestionStatus(msg, active)
    })

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    canvas.addEventListener('pointerdown', (e) => this._onPointer(e))
    window.addEventListener('resize', () => this.resize())

    this._anim = this._anim.bind(this)
    requestAnimationFrame(this._anim)
  }

  _lights() {
    const amb = new THREE.AmbientLight(0x8aa0c8, 0.55)
    this.scene.add(amb)

    const key = new THREE.DirectionalLight(0xfff5e8, 1.15)
    key.position.set(3, 5, 4)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0x6a8cff, 0.4)
    fill.position.set(-3, 2, -2)
    this.scene.add(fill)

    const rim = new THREE.PointLight(0x3ecf8e, 0.5, 8)
    rim.position.set(0, 2, -2)
    this.scene.add(rim)
  }

  _floor() {
    const grid = new THREE.GridHelper(6, 24, 0x1e3a5f, 0x152238)
    grid.position.y = -0.55
    this.scene.add(grid)

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 48),
      new THREE.MeshStandardMaterial({
        color: 0x101828,
        roughness: 0.9,
        metalness: 0.1,
      })
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = -0.549
    this.scene.add(disc)
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  _onPointer(e) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.body.organHitTargets, true)
    if (hits.length) {
      const id = hits[0].object.userData.organId
      if (id) this.focusOrgan(id)
    }
  }

  focusOrgan(id) {
    const focus = this.body.getOrganFocusTarget(id)
    if (!focus) return
    state.focusedOrgan = id
    this.body.highlightOrgan(id)
    this.ui.setFocusLabel(focus.label)
    this.ui.setActiveOrgan(id)
    this._tweenCamera(focus.camera, focus.target, 0.85)
  }

  zoomOut() {
    state.focusedOrgan = null
    this.body.clearHighlight()
    this.ui.setFocusLabel('Full body view')
    this.ui.setActiveOrgan(null)
    this._tweenCamera(this.defaultCamPos.clone(), this.defaultTarget.clone(), 0.9)
  }

  _tweenCamera(toPos, toTarget, duration) {
    const fromPos = this.camera.position.clone()
    const fromTarget = this.controls.target.clone()
    this.focusTween = {
      t: 0,
      duration,
      fromPos,
      toPos,
      fromTarget,
      toTarget,
    }
  }

  rebuildBody() {
    this.body._build()
    this.blood.rebuild()
  }

  setSex(sex) {
    this.body.setSex(sex)
    this.blood.rebuild()
    if (state.focusedOrgan) this.focusOrgan(state.focusedOrgan)
  }

  feed(food) {
    return this.digestion.start(food)
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

    this.body.update(dt, t)
    this.blood.update(dt)
    this.digestion.update(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    this.ui.updateReadouts()
  }
}
