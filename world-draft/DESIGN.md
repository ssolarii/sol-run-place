# Archive design reference

The current implemented system is recorded in [the root DESIGN.md](../DESIGN.md), with machine-readable extensions in ../.impeccable/design.json.

This route uses three shallow curved split leaves, carved timber frames, matte paper and live Helvetica Now text. It is a normal scrolling portfolio with Projects, About and Quicklinks. The discarded island/fern-clump contract no longer describes it.

Source styles are world.css and projects/project.css; graphics and interactions are in scene.js and app.js. Keep anchors and form controls in HTML. Leaf motion is restrained X/Y movement with a fixed camera. The reversible note bends as one continuous sheet and respects reduced motion. Private messages and moderated guestbook submissions use the service documented in ../firebase/README.md.
