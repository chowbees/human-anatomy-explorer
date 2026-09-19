# Anatomy models

This app loads **BodyParts3D 4.0** at runtime from jsDelivr:

- Manifest: `https://cdn.jsdelivr.net/gh/ashemag/human-atlas@main/public/models/atlas.json`
- Chunks: `body-0.bin.gz` … `body-14.bin.gz`

Optional local fallback: place the same files under `public/models/bp3d/` if CDN/CORS is blocked. Do **not** commit ~60 MB uncompressed bins when the gzip CDN works.

Attribution: BodyParts3D © DBCLS, CC BY 4.0; packaging via ashemag/human-atlas.
