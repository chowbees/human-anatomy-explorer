import './style.css'
import { AnatomyScene } from './scene.js'
import { state, applyHealth } from './state.js'

const DISCLAIMER_KEY = 'anatomy-explorer-disclaimer-ack-v1'

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

  document.querySelectorAll('.organ-btn').forEach((btn) => {
    btn.addEventListener('click', () => scene.focusOrgan(btn.dataset.organ))
  })

  document.getElementById('zoomOut').addEventListener('click', () => scene.zoomOut())

  const panel = document.getElementById('controls')
  document.getElementById('togglePanel').addEventListener('click', () => {
    panel.classList.toggle('open')
  })
}

// Boot
applyHealth('healthy')
setupDisclaimer()

const canvas = document.getElementById('c')
const scene = new AnatomyScene(canvas, ui)
setupControls(scene)
scene.resize()
ui.updateReadouts()

// Expose for debugging in console
window.__anatomy = { scene, state }
