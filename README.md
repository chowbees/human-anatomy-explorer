# Human Anatomy Explorer

Interactive **3D classroom anatomy model** for kids and students, built with **Vite**, **vanilla JavaScript**, and **Three.js**. Static site for **GitHub Pages**.

> **Medical disclaimer:** For educational / reference use only. **Not medical advice.** Anatomy, blood flow, and digestion reactions are simplified; real physiology may differ. Consult a qualified clinician for health concerns.

## Features

- **Controls:** sex (male/female proportions + reproductive organs), health (healthy/unhealthy vitals & skin), height & weight scaling, simulation speed, **outer-body skin mode** (translucent / more opaque / hidden)
- **3D scene:** OrbitControls, soft studio lighting, calm gradient backdrop + simple floor (no toy grid)
- **Body:** translucent humanoid silhouette with lathed torso, head/face cues, tapered limbs
- **Organs:** textbook-recognizable shapes (not balloon spheres) — clickable with hover labels
- **Focus:** click organ or panel buttons (Head / Chest / Abdomen / Pelvis); **Zoom out** for full body
- **Blood flow:** subtle particles along vessels
- **Eating simulation:** spinach / rice / meat — bolus path mouth → intestines with stylized energy differences
- **Disclaimer modal** with one-time acknowledgment (`localStorage`)

## Organs included

| Category | Organ ids |
|--------|-----------|
| Head & neck | `brain`, `eyes`, `pituitary`, `spinalCord`, `thyroid` |
| Chest | `heart`, `trachea`, `leftLung`, `rightLung`, `esophagus` |
| Abdomen | `stomach`, `liver`, `gallbladder`, `pancreas`, `spleen`, `smallIntestine`, `largeIntestine`, `leftKidney`, `rightKidney`, `leftAdrenal`, `rightAdrenal` |
| Pelvis | `bladder`, `leftUreter`, `rightUreter`, `rectum` + sex-dependent: female `uterus`, `leftOvary`, `rightOvary` / male `prostate`, `leftTestis`, `rightTestis` |

## Visual approach

**Procedural educational meshes** (not a downloaded GLTF atlas).

Why not a free full-body GLB?

- Complete open anatomy libraries (e.g. HuBMAP HRA) are **tens–hundreds of MB** — too large for a snappy GitHub Pages demo
- This app needs **per-organ IDs**, sex switching, height/weight scale, and digestion/blood paths wired to the same meshes

Instead, organs use **Lathe / Extrude / Tube / multi-part compounds** with organic profiles:

- Brain: sulci-hinted hemispheres + cerebellum + brainstem (eyes are **in face sockets**, not stuck on the brain)
- Heart: classic pointed shape with vessel stubs
- Lungs: elongated lobed forms with cardiac notch on the left
- Stomach: J-shaped lathe; liver: right + left lobes; kidneys: bean extrusions
- Small intestine: continuous coils; large intestine: colon frame with haustrum hint
- Soft **MeshPhysicalMaterial** PBR (low emissive — not toy glow)

No paid APIs. Assets under `public/` are only icons/favicon; geometries are code-generated at runtime.

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

### Quick visual check

1. Default view should look like a **semi-transparent anatomy mannequin**, not balloons
2. Hover brain / heart / kidney / intestine — shapes should be identifiable before reading the label
3. Eyes sit in facial sockets at normal scale (not googly orbs on the brain)
4. Toggle **Outer body (skin)** → Hidden to study organs alone
5. Sex / health / height / weight / food / speed still work

## GitHub Pages

Live site: https://chowbees.github.io/human-anatomy-explorer/

Vite `base` is `/human-anatomy-explorer/`. Publish `dist/` to the `gh-pages` branch.

```bash
npm run build
# push the contents of dist/ to the gh-pages branch
```

## Stack

- Vite 8
- Three.js (WebGL) + OrbitControls
- No backend, no API keys

## Intentional shortcuts

- Body and organs are **procedural educational meshes**, not a medical atlas or photoreal scan
- Some glands (pituitary, adrenals, ovaries/testes) remain compact primitives — still color-coded and labeled
- Digestion and blood flow are **educational animations**, not clinical models
- Male/female differences: silhouette proportions + reproductive organs
- Covers major organs of primary systems; omits countless minor structures

## License

Educational demo — use and adapt freely for non-clinical teaching demos.
