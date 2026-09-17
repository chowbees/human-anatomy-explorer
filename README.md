# Human Anatomy Explorer

Interactive, **stylized** 3D human anatomy web app built with **Vite**, **vanilla JavaScript**, and **Three.js**. Designed as a static site for **GitHub Pages**.

> **Medical disclaimer:** For educational / reference use only. **Not medical advice.** Anatomy, blood flow, and digestion reactions are simplified and stylized; real physiology and food reactions may differ. Consult a qualified clinician for health concerns.

## Features

- **Controls:** sex (male/female proportions), health (healthy/unhealthy vitals & skin), height & weight scaling, simulation speed
- **3D scene:** OrbitControls (orbit + zoom), translucent body silhouette, clickable organs (brain, heart, lungs, liver, stomach, intestines)
- **Focus:** click organ or use panel buttons; **Zoom out** returns to full-body view
- **Blood flow:** animated particles along stylized vessels (intensity follows health / energy)
- **Eating simulation:** spinach / rice / meat — bolus path mouth → esophagus → stomach → intestines with stylized energy & gut activity differences
- **Disclaimer modal** with one-time acknowledgment (`localStorage`)

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

Vite `base` is `/human-anatomy-explorer/` for project pages. The built `dist/` is published on the `gh-pages` branch (Settings → Pages → Deploy from branch `gh-pages` / root).

To republish after changes:

```bash
npm run build
# push the contents of dist/ to the gh-pages branch
```

If you rename the repository, update `base` in `vite.config.js` to match:

```js
base: '/your-repo-name/',
```

For a **user/organization site** (`username.github.io`), set `base: '/'` instead.

## Stack

- Vite 8
- Three.js (WebGL) + OrbitControls
- No backend, no API keys

## Intentional shortcuts (v1)

- Body and organs are **procedural / stylized meshes**, not a medical atlas or photoreal scan
- Digestion and blood flow are **educational animations**, not clinical models
- Single vessel loop and simplified digestive path
- Male/female differences are silhouette/proportion cues only

## License

Educational demo — use and adapt freely for non-clinical teaching demos.
