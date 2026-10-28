# Asset sources

## Current archive

- ../../assets/foliage/leaf-layout.json: exact independently curved meshes, UVs, normals and transforms exported through official local Blender MCP from flat-leaf-split-assets.blend. Source lives under local work/design-studies/ and is not a public runtime dependency. Three leaves share topology for 5,400 triangles total; the layout records coordinates and its orthographic camera.
- ../../assets/foliage/leaf-texture.png: canonical mesh texture. Original native-source/generation provenance remains embedded in the canonical source.
- ../../assets/plates/: approved canonical PNG foliage plates, carved timber frame, story paper and illustrative planner. Separate layers preserve live HTML navigation and text. project-view.png is a planning illustration, not an actual school or software screenshot.
- ../../assets/runtime/: lossless WebP encodings of the canonical leaf texture and six separate composition assets. provenance.json records source paths, SHA-256, byte counts, transforms and exact decoded-RGBA equality for all seven derivatives; each has a sidecar. Canonical PNGs remain unchanged.
- ../../assets/fonts/HelveticaNowDisplay-{Regular,Bold,Black}.woff2: existing self-hosted site typography.
- ../../assets/icons/: existing social icons.
- ../vendor/three.module.js: local Three.js runtime; retained license in vendor/.
- submissions/: generated self-hosted Firebase client code, not imagery. Authoring source and locked build instructions are under ../../firebase/.

## Retained legacy material

- botanical-kit.json: earlier clumps from [Poly Haven Fern 02](https://polyhaven.com/a/fern_02), modeled by Rico Cilliers and scanned by Rob Tuytel, under [CC0](https://polyhaven.com/license). The earlier Blender workflow preserved shared vertices, Y-up coordinates, UVs and normals, and included stones and beveled timber.
- fern-rgba.webp: earlier Fern 02 diffuse/alpha combination. Source checksums were recorded during that preparation. The replacement scene does not load it.
- shifty-schedule.jpg: retained earlier project screenshot. The new first composition uses the approved illustrative planning image instead.

Legacy files remain for compatibility and provenance. The earlier archive-assets.blend is local development material and is not the source of the current split-leaf export.
