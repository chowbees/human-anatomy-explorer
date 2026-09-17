# Models

Organ meshes come from the **HuBMAP Human Reference Atlas 3D Reference Object Library** (**CC BY 4.0**).

- https://humanatlas.io/3d-reference-library
- API: https://apps.humanatlas.io/api/v1/reference-organs
- CDN: `https://cdn.humanatlas.io/digital-objects/ref-organ/.../*.glb`

`hra-manifest.json` lists labels, sex, and CDN file URLs. **GLB files are not vendored** — the app loads them at runtime with a progress UI.

Mouth is intentionally never loaded (very large). Eyes and blood vasculature are optional toggles.
