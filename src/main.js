import './style.css'
import { AnatomyScene } from './scene.js'
import { state, applyHealth } from './state.js'
import { SYSTEMS, PRESETS, FOCUS_SHORTCUTS, DEFAULT_VISIBLE } from './bp3dAtlas.js'

const DISCLAIMER_KEY = 'anatomy-explorer-disclaimer-ack-v3'

const ui = {
  setDigestionStatus(msg, active) {
    const el = document.getElementById('digestionStatus')
    el.textContent = msg
    el.classList.toggle('active', !!active)
  },
  setFocusLabel(text) {
    document.getElementById('focusLabel').textContent = text
  },
  setActiveOrgan(id) {
    document.querySelectorAll('.organ-btn').forEach((b) => {
      // shortcut buttons: mark active if resolved part matches later — simple: clear all
      b.classList.toggle('active', b.dataset.part === id)
    })
  },
  setFloatLabel(text, x, y, pinned) {
    const el = document.getElementById('organFloatLabel')
    if (!text) {
      el.classList.add('hidden')
      el.textContent = ''
      return
    }
    el.textContent = text
    el.classList.remove('hidden')
    if (x != null && y != null) {
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -120%)`
    }
  },
  updateReadouts() {
    const hr = Math.round(state.heartRate * (0.95 + state.digestion.energyBoost * 0.15))
    document.getElementById('hrVal').textContent = `${hr} bpm`
    const flow =
      state.bloodFlowIntensity > 0.85
        ? 'Strong'
        : state.bloodFlowIntensity > 0.6
          ? 'Normal'
          : 'Reduced'
    document.getElementById('flowVal').textContent = flow
    const gut = state.digestion.gutActivity
    document.getElementById('gutVal').textContent =
      gut > 0.6 ? 'Elevated' : gut > 0.2 ? 'Active' : 'Resting'
    const e = state.energy
    document.getElementById('energyVal').textContent =
      e > 0.85 ? 'High' : e > 0.6 ? 'Raised' : 'Baseline'
  },
  setFoodButtonsEnabled(enabled) {
    document.querySelectorAll('.food-btn').forEach((b) => {
      b.disabled = !enabled
    })
  },
  refreshOrganButtons() {
    buildFocusButtons(window.__anatomy?.scene)
  },
  syncSystemToggles(visible) {
    const set = new Set(visible || state.visibleSystems)
    document.querySelectorAll('[data-system]').forEach((el) => {
      if (el.type === 'checkbox') el.checked = set.has(el.dataset.system)
    })
  },
  setLoadProgress(p) {
    const overlay = document.getElementById('loadOverlay')
    const bar = document.getElementById('loadBar')
    const label = document.getElementById('loadLabel')
    const pct = document.getElementById('loadPct')
    if (!overlay) return

    if (p.phase === 'done') {
      overlay.classList.add('hidden')
      return
    }
    if (p.phase === 'error') {
      overlay.classList.remove('hidden')
      label.textContent = `Load error: ${p.label}`
      pct.textContent = ''
      bar.style.width = '0%'
      return
    }

    overlay.classList.remove('hidden')
    const frac = Math.max(0, Math.min(1, p.fraction || 0))
    bar.style.width = `${(frac * 100).toFixed(1)}%`
    pct.textContent = `${Math.round(frac * 100)}%`
    label.textContent = p.label
      ? `Loading BodyParts3D: ${p.label}`
      : 'Loading BodyParts3D atlas…'
  },
}

function buildFocusButtons(scene) {
  const container = document.getElementById('organButtons')
  if (!container) return
  container.innerHTML = ''

  const title = document.createElement('h3')
  title.className = 'focus-heading'
  title.textContent = 'Quick focus'
  container.appendChild(title)

  const row = document.createElement('div')
  row.className = 'btn-row wrap'
  for (const sc of FOCUS_SHORTCUTS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'organ-btn'
    btn.dataset.shortcut = sc.id
    btn.textContent = sc.label
    btn.addEventListener('click', () => scene?.focusShortcut(sc.id))
    row.appendChild(btn)
  }
  container.appendChild(row)
}

function buildSystemToggles() {
  const defaultsEl = document.getElementById('systemDefaults')
  const optionalEl = document.getElementById('systemOptional')
  if (!defaultsEl || !optionalEl) return
  defaultsEl.innerHTML = ''
  optionalEl.innerHTML = ''

  for (const s of SYSTEMS) {
    const label = document.createElement('label')
    label.className = 'check-field'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.system = s.id
    input.checked = state.visibleSystems.includes(s.id)
    const swatch = document.createElement('span')
    swatch.className = 'sys-swatch'
    swatch.style.background = s.color
    const text = document.createElement('span')
    text.textContent = s.name
    label.append(input, swatch, text)
    label.title = s.description
    ;(s.kidsDefault ? defaultsEl : optionalEl).appendChild(label)
  }
}

function setupDisclaimer() {
  const modal = document.getElementById('disclaimerModal')
  const ackCheck = document.getElementById('ackCheck')
  const ackBtn = document.getElementById('ackBtn')
  const showBtn = document.getElementById('showDisclaimer')

  const acknowledged = localStorage.getItem(DISCLAIMER_KEY) === '1'
  if (acknowledged) modal.classList.add('hidden')

  ackCheck.addEventListener('change', () => {
    ackBtn.disabled = !ackCheck.checked
  })

  ackBtn.addEventListener('click', () => {
    if (!ackCheck.checked) return
    localStorage.setItem(DISCLAIMER_KEY, '1')
    modal.classList.add('hidden')
  })

  showBtn.addEventListener('click', () => {
    ackCheck.checked = false
    ackBtn.disabled = true
    modal.classList.remove('hidden')
  })
}

function setupControls(scene) {
  const health = document.getElementById('health')
  const height = document.getElementById('height')
  const weight = document.getElementById('weight')
  const simSpeed = document.getElementById('simSpeed')
  const heightVal = document.getElementById('heightVal')
  const weightVal = document.getElementById('weightVal')

  health.value = state.health
  height.value = String(state.heightCm)
  weight.value = String(state.weightKg)
  heightVal.textContent = `${state.heightCm} cm`
  weightVal.textContent = `${state.weightKg} kg`

  health.addEventListener('change', () => {
    applyHealth(health.value)
    scene.body.setHealthVisual()
    ui.updateReadouts()
  })

  height.addEventListener('input', () => {
    state.heightCm = Number(height.value)
    heightVal.textContent = `${state.heightCm} cm`
    scene.body.applyAnthropometrics()
    scene.blood.rebuild()
  })

  weight.addEventListener('input', () => {
    state.weightKg = Number(weight.value)
    weightVal.textContent = `${state.weightKg} kg`
    scene.body.applyAnthropometrics()
    scene.blood.rebuild()
  })

  simSpeed.addEventListener('change', () => {
    state.simSpeed = Number(simSpeed.value)
  })

  const skinMode = document.getElementById('skinMode')
  if (skinMode) {
    skinMode.value = state.skinMode || 'hidden'
    skinMode.addEventListener('change', () => {
      scene.body.setSkinMode(skinMode.value)
      ui.syncSystemToggles(state.visibleSystems)
    })
  }

  // Presets
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset
      const preset = PRESETS[key]
      if (!preset) return
      document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      scene.setSystems(preset.systems.slice())
    })
  })

  // System checkboxes (delegated)
  const onSystemChange = (e) => {
    const t = e.target
    if (t?.dataset?.system) {
      scene.setSystem(t.dataset.system, t.checked)
      document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active'))
    }
  }
  document.getElementById('systemDefaults')?.addEventListener('change', onSystemChange)
  document.getElementById('systemOptional')?.addEventListener('change', onSystemChange)

  document.querySelectorAll('.food-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ok = scene.feed(btn.dataset.food)
      if (ok) {
        ui.setFoodButtonsEnabled(false)
        const check = setInterval(() => {
          if (!state.digestion.active) {
            ui.setFoodButtonsEnabled(true)
            clearInterval(check)
          }
        }, 200)
      }
    })
  })

  document.getElementById('zoomOut').addEventListener('click', () => scene.zoomOut())

  const panel = document.getElementById('controls')
  document.getElementById('togglePanel').addEventListener('click', () => {
    panel.classList.toggle('open')
  })

  buildSystemToggles()
  buildFocusButtons(scene)
}

// Boot
applyHealth('healthy')
state.visibleSystems = DEFAULT_VISIBLE.slice()
setupDisclaimer()

const canvas = document.getElementById('c')
const scene = new AnatomyScene(canvas, ui)
window.__anatomy = { scene, state }
setupControls(scene)
scene.resize()
ui.updateReadouts()
ui.setLoadProgress({
  phase: 'chunks',
  loaded: 0,
  total: 15,
  fraction: 0,
  label: 'Fetching atlas.json…',
})
