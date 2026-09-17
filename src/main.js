import './style.css'
import { AnatomyScene } from './scene.js'
import { state, applyHealth } from './state.js'
import { ORGAN_META, SYSTEM_LABELS } from './body.js'

const DISCLAIMER_KEY = 'anatomy-explorer-disclaimer-ack-v2'

const SYSTEM_ORDER = ['head', 'chest', 'abdomen', 'pelvis']

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
      b.classList.toggle('active', b.dataset.organ === id)
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
    } else if (pinned) {
      // Keep previous position until next hover/frame update
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
  refreshOrganButtons(presentIds) {
    buildOrganButtons(presentIds, window.__anatomy?.scene)
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
    const phaseLabel =
      p.phase === 'core'
        ? 'Loading HRA organs'
        : p.phase?.startsWith('optional')
          ? `Loading ${p.phase.split(':')[1] || 'optional'}`
          : 'Loading'
    label.textContent = p.label ? `${phaseLabel}: ${p.label}` : phaseLabel
  },
}

function buildOrganButtons(presentIds, scene) {
  const container = document.getElementById('organButtons')
  container.innerHTML = ''
  const present = new Set(
    presentIds ||
      Object.keys(ORGAN_META).filter((id) => {
        const meta = ORGAN_META[id]
        return !meta.sex || meta.sex === state.sex
      })
  )

  for (const sys of SYSTEM_ORDER) {
    const groupIds = Object.entries(ORGAN_META)
      .filter(([id, meta]) => meta.system === sys && present.has(id))
      .map(([id]) => id)
    if (!groupIds.length) continue

    const group = document.createElement('div')
    group.className = 'organ-group'
    const title = document.createElement('h3')
    title.textContent = SYSTEM_LABELS[sys] || sys
    group.appendChild(title)

    const row = document.createElement('div')
    row.className = 'btn-row wrap'
    for (const id of groupIds) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'organ-btn'
      btn.dataset.organ = id
      btn.textContent = ORGAN_META[id].name
      btn.addEventListener('click', () => scene?.focusOrgan(id))
      row.appendChild(btn)
    }
    group.appendChild(row)
    container.appendChild(group)
  }

  if (state.focusedOrgan) {
    ui.setActiveOrgan(state.focusedOrgan)
  }
}

function setupDisclaimer() {
  const modal = document.getElementById('disclaimerModal')
  const ackCheck = document.getElementById('ackCheck')
  const ackBtn = document.getElementById('ackBtn')
  const showBtn = document.getElementById('showDisclaimer')

  const acknowledged = localStorage.getItem(DISCLAIMER_KEY) === '1'
  if (acknowledged) {
    modal.classList.add('hidden')
  }

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
  const sex = document.getElementById('sex')
  const health = document.getElementById('health')
  const height = document.getElementById('height')
  const weight = document.getElementById('weight')
  const simSpeed = document.getElementById('simSpeed')
  const heightVal = document.getElementById('heightVal')
  const weightVal = document.getElementById('weightVal')

  sex.value = state.sex
  health.value = state.health
  height.value = String(state.heightCm)
  weight.value = String(state.weightKg)
  heightVal.textContent = `${state.heightCm} cm`
  weightVal.textContent = `${state.weightKg} kg`

  sex.addEventListener('change', () => {
    // Optional assets are sex-specific; clear toggles on reload
    const optV = document.getElementById('optVasculature')
    const optE = document.getElementById('optEyes')
    if (optV) optV.checked = false
    if (optE) optE.checked = false
    scene.setSex(sex.value)
  })

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
    skinMode.value = state.skinMode || 'translucent'
    skinMode.addEventListener('change', () => {
      scene.body.setSkinMode(skinMode.value)
    })
  }

  const optVessels = document.getElementById('optVasculature')
  if (optVessels) {
    optVessels.addEventListener('change', () => {
      scene.setOptional('vasculature', optVessels.checked)
    })
  }
  const optEyes = document.getElementById('optEyes')
  if (optEyes) {
    optEyes.addEventListener('change', () => {
      scene.setOptional('eyes', optEyes.checked)
    })
  }

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

  // Organ buttons filled when HRA core load completes
  buildOrganButtons([], scene)
}

// Boot
applyHealth('healthy')
setupDisclaimer()

const canvas = document.getElementById('c')
const scene = new AnatomyScene(canvas, ui)
window.__anatomy = { scene, state }
setupControls(scene)
scene.resize()
ui.updateReadouts()
ui.setLoadProgress({
  phase: 'core',
  loaded: 0,
  total: 1,
  fraction: 0,
  label: 'Fetching HuBMAP HRA models…',
})
