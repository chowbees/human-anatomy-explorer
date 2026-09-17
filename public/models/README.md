# Models

This app uses **procedural** educational meshes (see `src/geometry/organic.js` and `src/body.js`) rather than a downloaded full-body GLB.

Open anatomy GLB libraries (e.g. HuBMAP HRA) are typically far larger than ~15 MB when covering a full organ set, which is awkward for GitHub Pages. Per-organ click IDs, sex switching, and height/weight scaling are also easier with procedural meshes.

If you later add a CC0/CC-BY GLB here, document its license and attribution in the root README.
