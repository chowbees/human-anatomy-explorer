# Human Anatomy Explorer

Interactive **3D classroom anatomy model** for kids and students, built with **Vite**, **vanilla JavaScript**, and **Three.js**. Static site for **GitHub Pages**.

> **Medical disclaimer:** For educational / reference use only. **Not medical advice.** Anatomy, blood flow, and digestion reactions are simplified; real physiology may differ. Consult a qualified clinician for health concerns.

## Attribution

**3D organ meshes** are from the **HuBMAP Human Reference Atlas 3D Reference Object Library**, licensed **CC BY 4.0**.

- Library: https://humanatlas.io/3d-reference-library
- Models are **loaded at runtime from the HuBMAP CDN** (not vendored into this repo)
- Manifest: `public/models/hra-manifest.json` (labels, sex, CDN URLs)

## Features

- **Real HRA GLB organs** assembled in shared Visible Human space (skin shell + major organs)
- **Controls:** sex (reloads male/female HRA set), health (subtle tint/emissive), height & weight scaling, simulation speed, **outer-body skin mode** (translucent / more opaque / hidden)
- **Loading UI:** progress bar; core organs first so useful anatomy appears quickly
- **Optional CDN assets:** blood vasculature, eyes (large — off by default). Mouth is skipped (too large)
- **Focus:** click / hover organ meshes or panel buttons (Head / Chest / Abdomen / Pelvis)
- **Blood flow:** particles along a heart→body path; HRA vasculature mesh when loaded
- **Eating simulation:** spinach / rice / meat — bolus along a path derived from gut organ positions
- **Disclaimer modal** with HuBMAP credit + one-time acknowledgment

## Organs loaded by default

| Region | Organs |
|--------|--------|
| Head & neck | Brain, larynx, spinal cord |
| Chest | Heart, lungs, trachea, thymus (+ translucent skin shell) |
| Abdomen | Liver, pancreas, spleen, small intestine, large intestine, left/right kidney |
| Pelvis | Urinary bladder; **male** prostate; **female** uterus, ovaries, fallopian tubes |

**Optional (toggle):** blood vasculature, left/right eyes  
**Skipped:** mouth (~53 MB)

## Load strategy

1. Fetch `hra-manifest.json`
2. Parallel-batch load **core** GLBs for the selected sex from `cdn.humanatlas.io`
3. Place all models in one root group, uniform scale to ~1.7 scene units, ground the bounding box (Y-up)
4. Optional assets load on demand via UI checkboxes

## Coordinate system

HRA Visible Human reference organs share a **meter-scale** body space and assemble coherently when loaded together. This app applies a uniform fit scale (~0.93 for the male set to reach ~1.7 units) and centers the combined bounds on the ground.

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/human-anatomy-explorer/`).

```bash
npm run build    # outputs to dist/
npm run preview  # preview production build
```

Requires network access to the HuBMAP CDN for organ meshes.

## GitHub Pages

Live site: https://chowbees.github.io/human-anatomy-explorer/

Vite `base` is `/human-anatomy-explorer/`. Publish `dist/` to the `gh-pages` branch (parent deploy — do not push from agents unless asked).

## Stack

- Vite 8
- Three.js (WebGL) + OrbitControls + GLTFLoader
- HuBMAP HRA GLBs via CDN
- No backend, no API keys

## License

App code: educational demo — adapt freely for non-clinical teaching.  
**HRA 3D models:** © HuBMAP contributors — **CC BY 4.0** — https://humanatlas.io/3d-reference-library
