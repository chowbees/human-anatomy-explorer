# Human Anatomy Explorer

Interactive **3D classroom anatomy atlas** for kids and students, built with **Vite**, **vanilla JavaScript**, and **Three.js**. Static site for **GitHub Pages**.

> **Medical disclaimer:** For educational / reference use only. **Not medical advice.** Anatomy, blood flow, digestion, and nutrient breakdowns are simplified; real physiology may differ. Consult a qualified clinician for health concerns.

## Attribution

- **Male atlas:** **BodyParts3D** © [DBCLS](https://dbcls.rois.ac.jp/index-en.html), **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**. Browser-ready packaging adapted from [ashemag/human-atlas](https://github.com/ashemag/human-atlas).
- **Female organs:** **HuBMAP Human Reference Atlas** [3D Reference Library](https://humanatlas.io/3d-reference-library), **CC BY 4.0**. Lean CDN GLB set (`public/models/hra-female-manifest.json`).

The full skeleton + nerves + stomach atlas is richest on **male** (BodyParts3D). **Female** uses HuBMAP HRA organ models (including uterus, ovaries, fallopian tubes).

## Features

1. **Sex control** — Male (BodyParts3D) / Female (HRA); switching reloads the dataset
2. **Interior / cutaway** — Zooming heart, stomach, lungs (and more) lists clickable inner parts or educational layer markers
3. **Eating → nutrients** — Spinach / rice / meat release distinct Energy / Vitamins / Protein / Carbs / Fiber / Minerals with particles and UI bars
4. **Heartbeat & breathing** — Heart and lungs scale about their bounding-box centers so they stay inside the thorax

## Load strategy

**Male**

1. Fetch `atlas.json` from jsDelivr (`ashemag/human-atlas`)
2. Load 15 gzipped geometry chunks in parallel (×3)
3. Optional local fallback: `public/models/bp3d/`

**Female**

1. Read `public/models/hra-female-manifest.json`
2. Load core organ GLBs from `cdn.humanatlas.io` (skin, brain, heart, lung, liver, kidneys, spleen, pancreas, intestines, bladder, trachea, larynx, spinal cord, uterus, ovaries, fallopian tubes, ureters, thymus)
3. Optional toggles: eyes, blood vasculature

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

## GitHub Pages

Live site: https://chowbees.github.io/human-anatomy-explorer/

Vite `base` is `/human-anatomy-explorer/`. Publish `dist/` to the `gh-pages` branch (parent deploy — do not push from agents unless asked).

## Stack

- Vite 8 · Three.js + OrbitControls + GLTFLoader
- BodyParts3D 4.0 (male) · HuBMAP HRA (female)
- No backend, no API keys

## License

App code: educational demo — adapt freely for non-clinical teaching.  
**BodyParts3D** © DBCLS — CC BY 4.0 · **HuBMAP HRA** — CC BY 4.0
