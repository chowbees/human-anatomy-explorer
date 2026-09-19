import './style.css'
import { AnatomyScene } from './scene.js'
import { state, applyHealth, NUTRIENT_KEYS, NUTRIENT_META } from './state.js'
import { SYSTEMS, PRESETS, DEFAULT_VISIBLE } from './bp3dAtlas.js'

const DISCLAIMER_KEY = 'anatomy-explorer-disclaimer-ack-v4'

const ui = {
  setDigestionStatus(msg, active) {
    const el = document.getElementById('digestionStatus')
    el.textContent = msg
    el.classList.toggle('active', !!active)
  },
  setNutrientPanel(nutrients, stage, profile) {
    const panel = document.getElementById('nutrientPanel')
    if (!panel) return
    const active = state.digestion.active || (nutrients && NUTRIENT_KEYS.some((k) => (nutrients[k] || 0) > 0.02))
    panel.classList.toggle('hidden', !active)
    if (!active) return

    const stageEl = document.getElementById('nutrientStage')
    if (stageEl) {
      const stageLabel = {
        mouth: 'Mouth',
        esophagus: 'Esophagus',
        stomach: 'Stomach',
        smallIntestine: 'Small intestine',
        largeIntestine: 'Large intestine',
        complete: 'Complete',
        idle: 'Resting',
      }
      stageEl.textContent = profile
        ? `${profile.label} · ${stageLabel[stage] || stage}`
        : stageLabel[stage] || stage
    }

    const chips = document.getElementById('nutrientChips')
    if (chips && profile) {
      const bits = []
      if (profile.vitaminLabels?.length) bits.push(`Vitamins: ${profile.vitaminLabels.join(', ')}`)
      if (profile.mineralLabels?.length) bits.push(`Minerals: ${profile.mineralLabels.join(', ')}`)
      chips.textContent = bits.join(' · ') || profile.note || ''
    }

    for (const key of NUTRIENT_KEYS) {
      const bar = document.getElementById(`nutrient-${key}`)
      if (!bar) continue
      const v = Math.max(0, Math.min(1, nutrients?.[key] || 0))
      bar.style.width = `${(v * 100).toFixed(0)}%`
      bar.parentElement?.classList.toggle('lit', v > 0.15)
    }
  },
  setFocusLabel(text) {
    document.getElementById('focusLabel').textContent = text
  },
  setActiveOrgan(id) {
    document.querySelectorAll('.organ-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.part === id || b.dataset.shortcut === id)
    })
  },
  setFloatLabel(text, x, y) {
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
  setInnerParts(items, onClick) {
    const panel = document.getElementById('innerPartsPanel')
    const list = document.getElementById('innerPartsList')
    if (!panel || !list) return
    list.innerHTML = ''
    if (!items || !items.length) {
      panel.classList.add('hidden')
      return
    }
    panel.classList.remove('hidden')
    for (const item of items) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'inner-part-btn'
      btn.textContent = item.schematic ? `${item.label} (layer)` : item.label
      btn.title = item.tip || ''
      btn.addEventListener('click', () => onClick?.(item))
      list.appendChild(btn)
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
  syncSexUI(sex, mode) {
    const sel = document.getElementById('sex')
    if (sel) sel.value = sex
    const note = document.getElementById('referenceNote')
    if (note) {
      if (sex === 'female') {
        note.innerHTML =
          'Reference: <strong>adult female</strong> organs from <strong>HuBMAP HRA</strong> (CC BY). Full skeleton + nerves atlas is richest on <strong>male</strong> (BodyParts3D). Female includes uterus, ovaries, fallopian tubes, and major organs.'
      } else {
        note.innerHTML =
          'Reference: <strong>adult male</strong> (BodyParts3D). Full skeleton, nerves, stomach, and all systems. Switch to Female for HuBMAP HRA organ models (CC BY).'
      }
    }
    const attr = document.getElementById('attributionBlock')
    if (attr) {
      attr.innerHTML =
        sex === 'female'
          ? `Anatomy: <strong>HuBMAP Human Reference Atlas</strong> (
            <a href="https://humanatlas.io/3d-reference-library" target="_blank" rel="noopener noreferrer">3D Reference Library</a>),
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.
            Male atlas remains <strong>BodyParts3D</strong> © DBCLS when selected.`
          : `Anatomy: <strong>BodyParts3D</strong> ©
            <a href="https://dbcls.rois.ac.jp/index-en.html" target="_blank" rel="noopener noreferrer">DBCLS</a>,
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.
            Geometry packaging via
            <a href="https://github.com/ashemag/human-atlas" target="_blank" rel="noopener noreferrer">ashemag/human-atlas</a>.
            Female uses HuBMAP HRA when selected.`
    }
    // Female optional toggles
    const opt = document.getElementById('femaleOptional')
    if (opt) opt.classList.toggle('hidden', sex !== 'female')
    // Presets that need skeleton/nerves — still usable on female for system filters
    document.querySelectorAll('[data-preset="skeleton"], [data-preset="nerves"]').forEach((b) => {
      b.disabled = sex === 'female'
      b.title =
        sex === 'female'
          ? 'Skeleton & nerves atlas is available on Male (BodyParts3D)'
          : ''
    })
    void mode
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
    const female = state.sex === 'female'
    label.textContent = p.label
      ? `Loading ${female ? 'HRA' : 'BodyParts3D'}: ${p.label}`
      : female
        ? 'Loading HuBMAP HRA female organs…'
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
  const shortcuts = scene?.body?.getFocusShortcuts?.() || []
  for (const sc of shortcuts) {
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

function buildNutrientBars() {
  const host = document.getElementById('nutrientBars')
  if (!host) return
  host.innerHTML = ''
  for (const key of NUTRIENT_KEYS) {
    const meta = NUTRIENT_META[key]
    const row = document.createElement('div')
    row.className = 'nutrient-row'
    row.innerHTML = `<span class="nutrient-label">${meta.label}</span>
      <div class="nutrient-track"><div id="nutrient-${key}" class="nutrient-fill" style="background:${meta.color}"></div></div>`
    host.appendChild(row)
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

  const sex = document.getElementById('sex')
  if (sex) {
    sex.value = state.sex
    sex.addEventListener('change', async () => {
      sex.disabled = true
      try {
        await scene.setSex(sex.value)
      } finally {
        sex.disabled = false
      }
    })
  }

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

  document.getElementById('optEyes')?.addEventListener('change', async (e) => {
    await scene.body.setOptional('eyes', e.target.checked)
  })
  document.getElementById('optVessels')?.addEventListener('change', async (e) => {
    await scene.body.setOptional('vasculature', e.target.checked)
    scene.blood.rebuild()
  })

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
  buildNutrientBars()
  buildFocusButtons(scene)
  ui.syncSexUI(state.sex, 'bp3d')
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
