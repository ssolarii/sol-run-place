# Sol's world draft

Public route: `/world-draft/`. Static HTML, CSS and a real Three.js WebGL2 scene; no backend or private message submission.

The homepage is preserved with an entry link. Projects, About, Quicklinks and music are readable at `?view=simple` even if WebGL or the scene bundle fails. Save-Data selects the simple view. A twelve-second load timeout and a context-loss handler release the renderer and reveal the document. Mobile uses fewer leaves, no shadow map, no antialiasing and a pixel ratio capped at 1. Desktop caps it at 1.5. The scene renders on demand; only a requested camera transition schedules frames. Reduced motion disables camera travel, and visitors can switch it off manually.

Edit `notes.json` for the peelable note. Visitor peeling is stored locally under `sol-world-note-peeled-v1` and is reversible. No text is submitted. Longer biography, additional project entries, message delivery and a separate public guestbook remain unfinished.

Music uses Lanyard's Spotify WebSocket first, then the repository's existing secret-backed Last.fm JSON/history. Last.fm refresh workflow remains unchanged. There is no browser API key and no audio autoplay. Existing Firebase/GA4 measurement ID is used; no Supabase integration. Internal links retain `utm_` campaign values.

Assets: foliage photograph and fonts are existing site assets; project screenshot is the existing `school-live-desktop.jpg` from Sol's Schedule Assistant source. Scene geometry and generated material textures are original code. Three.js 0.180.0 is MIT; license retained under `vendor/`. Source is `scene.js`, browser runtime is the bundled/minified `scene.bundle.js`.

Design maturity: L0. Values are provisional and will need reconciliation with a future design system. The visual contract is shaded green-black foliage, worn timber, paper, rust-red string, sharp Helvetica Now type, and persistent readable navigation. No invented biography, fake projects, generic feature cards or looping decorative motion.
