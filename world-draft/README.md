# Sol's archive

Route: /world-draft/. This source implements the replacement flat-leaf archive. This document does not certify publication or final visual-review completion.

The fast homepage retains immediate quicklinks and the world entry. Its private-message link now reaches #private-title. Internal attributed links preserve utm_ parameters. Projects, About and Quicklinks use ordinary anchors and scrolling, including on phones. projects/shifty.html is the readable project page.

## Graphics and accessibility

scene.js loads local Three.js and three independently curved split-leaf meshes exported through the official local Blender MCP workflow. ../assets/foliage/leaf-layout.json preserves geometry, normals, UVs and transforms: 5,400 triangles total. The orthographic camera stays fixed. Pointer/scroll/section response changes shallow leaf positions in X/Y with slight rotation, never camera travel in Z. Rendering runs on demand, pauses offscreen and caps pixel ratio at 1.75.

Raster foliage and semantic content exist before graphics load. Initialization failure or context loss leaves the plates visible. ?view=simple skips the leaf world; there is no visible Simple view label. It does not disable the separately loaded paper renderer. There is no current Save-Data switch or twelve-second timeout. Narrow widths and enlarged root text activate a flowing reading layout. Focus, skip link and touch controls stay in HTML.

The note uses original HTML while flat and a continuous 96-row WebGL sheet during curling, with approved paper texture and matching ink. The transition lasts 450ms. Reduced motion snaps to the target even if enabled mid-transition. notes.json edits public front/back text. Peeling is reversible and stores only a local boolean under sol-world-note-peeled-v1; it submits nothing. The leaf-motion toggle is separate from the operating system's reduced-motion preference.

## Listening and messages

Music uses Lanyard's Spotify WebSocket first, then existing Last.fm JSON/history. There is no audio autoplay or browser Last.fm secret. Analytics uses only the existing Firebase/GA4 ID G-TCHBCRP2LX, guarded to the production hostname.

submissions.js provides private delivery and a separate moderated public guestbook. The self-hosted Firebase 13 Firestore Lite client loads when needed; anonymous authentication occurs only on send. Private text is limited to 2,000 characters, guestbook text to 500, optional names to 60. An atomic server limiter enforces 60 seconds between sends per anonymous UID across both forms. Public reading returns published guestbook entries; new notes are pending until approved. Private client reads are denied. Sol reads and moderates using existing Firebase console IAM access.

Errors and uncertain delivery preserve entered text. There is no offline queue or automatic send retry. See [Firebase operations](../firebase/README.md) for the live service contract and authoring/moderation instructions. Rebuild the client with npm ci then npm run build:client in ../firebase; source is ../firebase/submissions-client.mjs.

## Assets and maintenance

Canonical approved PNGs remain unchanged in ../assets/plates/ and ../assets/foliage/. Lossless WebP derivatives in ../assets/runtime/ preserve exact decoded RGBA, recorded in provenance.json and adjacent sidecars. The planning image is illustrative, not a software screenshot or school photograph; alt descriptions remain honest. Helvetica Now uses the existing self-hosted font files.

See [asset sources](assets/SOURCES.md) and [the root design system](../DESIGN.md). Old fern/botanical-kit assets remain as legacy material; this renderer does not use them. Do not remove them just because the new route does not need them. Local Blender sources and internal studies are development files, not public runtime dependencies.
