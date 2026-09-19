# Human Anatomy Explorer

Interactive **3D classroom anatomy atlas** for kids and students, built with **Vite**, **vanilla JavaScript**, and **Three.js**. Static site for **GitHub Pages**.

> **Medical disclaimer:** For educational / reference use only. **Not medical advice.** Anatomy, blood flow, and digestion reactions are simplified; real physiology may differ. Consult a qualified clinician for health concerns.

## Attribution

**3D anatomy meshes** are from **BodyParts3D** © [DBCLS](https://dbcls.rois.ac.jp/index-en.html), licensed **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.

Browser-ready packaging (chunked binary atlas) adapted from [ashemag/human-atlas](https://github.com/ashemag/human-atlas) (MIT app code; anatomy remains CC BY 4.0).

This explorer uses the **adult male** BodyParts3D 4.0 reference. There is no female full-body atlas in this dataset — the UI states that honestly instead of inventing a female mesh.

## Features

- **Full BodyParts3D systems:** skeletal (296), nervous (139), digestive (97, includes **Stomach**), respiratory, cardiac, urinary, endocrine, reproductive, plus optional muscular / arterial / venous / lymphatic / sensory / connective / integumentary
- **Presets:** Organs · Skeleton · Nerves · Full systems (kids defaults)
- **Click / hover** any part for its name (and a short classroom tip when available)
- Height / weight scale, simulation speed, health tint
- **Eating simulation:** bolus along esophagus → stomach → intestines using real part centers
- Progress overlay while **15 geometry chunks** load (parallel ×3)
- Medical disclaimer modal

## Load strategy

1. Fetch `atlas.json` from **jsDelivr CDN**:  
   `https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models/atlas.json`
2. Load `body-0.bin.gz` … `body-14.bin.gz` (~33 MB gzip total) with concurrency 3
3. Decode gzip carefully (avoid double-decompress when the host already decoded `Content-Encoding`)
4. Fallback to `public/models/bp3d/` if CDN fails (optional local vendor — **not** committed by default)

HuBMAP HRA loaders were removed so the app is not limited to the partial organ set (no HRA stomach / peripheral nerves / full skeleton).

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

Requires network access to jsDelivr for atlas geometry (unless you vendor into `public/models/bp3d/`).

## GitHub Pages

Live site: https://chowbees.github.io/human-anatomy-explorer/

Vite `base` is `/human-anatomy-explorer/`. Publish `dist/` to the `gh-pages` branch (parent deploy — do not push from agents unless asked).

## Stack

- Vite 8
- Three.js (WebGL) + OrbitControls
- BodyParts3D 4.0 via jsDelivr / ashemag packaging
- No backend, no API keys

## License

App code: educational demo — adapt freely for non-clinical teaching.  
**BodyParts3D anatomy:** © DBCLS — **CC BY 4.0**
