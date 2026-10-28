---
name: Sol archive
description: Shallow foliage, carved timber and readable pinned paper.
colors:
  ground: "#101111"
  ink: "#eff0db"
  muted: "#bac8b7"
  accent: "#c4d484"
  paper-ink: "#17251e"
  submission-paper: "#a6a695"
  field-paper: "#b7b7a5"
  field-border: "#4c5a4b"
  button-hover: "#2d412c"
  error: "#6a211e"
typography:
  display:
    fontFamily: "HelveticaNow, Arial, sans-serif"
    fontSize: "max(2.25rem,9.23cqw)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "0"
  headline:
    fontFamily: "HelveticaNow, Arial, sans-serif"
    fontSize: "clamp(36px,6vw,60px)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-.02em"
  body:
    fontFamily: "HelveticaNow, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "HelveticaNow, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  square: "0"
spacing:
  field: "12px"
  section-gap: "24px"
  object-gap: "48px"
components:
  button-submit:
    backgroundColor: "{colors.paper-ink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "13px 18px"
    width: "100%"
  button-submit-hover:
    backgroundColor: "{colors.button-hover}"
  text-field:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.square}"
    padding: "{spacing.field}"
    width: "100%"
  submission-sheet:
    backgroundColor: "{colors.submission-paper}"
    textColor: "{colors.paper-ink}"
    padding: "clamp(24px,4vw,48px)"
---

# Design System: Sol archive

## Overview

**Creative North Star: "The shallow leaf archive"**

Dark foliage surrounds Sol's work, with carved timber holding project imagery and matte paper carrying readable content. Material objects provide character; live HTML carries navigation, project copy, forms and links. This records the implemented archive and project page, not a replacement for the fast homepage's established design.

Three curved leaves share a fixed orthographic camera. Restrained movement belongs to their shallow layers. The portfolio remains an ordinary scrolling document with immediate Projects, About and Quicklinks destinations.

**Key Characteristics:**
- Green-black ground, pale ink and a restrained leaf accent.
- Self-hosted Helvetica Now with heavy headings and regular reading text.
- Timber, paper and foliage as specific materials.
- Semantic controls and static fallbacks beneath graphics.

## Colors

The archive uses pale plant-colored ink against near-black, and dark green ink on muted paper.

### Primary
- **Leaf accent:** wordmark dot, active navigation marker, selection and dark-surface focus.

### Neutral
- **Ground:** archive and project-page background.
- **Ink / muted:** primary reading and supporting text on the archive.
- **Paper ink:** notes, labels and submission controls.
- **Submission paper / field paper:** distinguish the submission sheet from editable fields.
- **Field border / button hover / error:** interaction and feedback states.

The project page has local palette variations: ink `#f1f0db`, leaf `#c8d58b`, muted `#c4c8b9` in `world-draft/projects/project.css`. These are observed differences, not new global tokens.

## Typography

The archive's `HelveticaNow` and project page's `Helvetica Now` names load the same local Display font files. Regular, Bold and Black serve weights 400, 700 and 900 in the archive. Arial/sans-serif is the archive fallback; Helvetica/sans-serif is the project-page fallback.

The composition uses container units with root-relative minimums: brand `max(1.84375rem,7.565cqw)`, story title `max(1.53125rem,6.28cqw)`, navigation/subtitle/link `max(.875rem,3.59cqw)`, description `max(.8125rem,3.333cqw)`. Reading layout switches these to scaled root-relative sizes. The project page has a `clamp(64px,10vw,112px)` heading and 19px/1.55 body text, reduced to 18px on narrow screens.

**The Live Ink Rule.** Keep headings, captions, links and forms as semantic HTML; the moving note temporarily paints matching ink into its bending texture.

## Layout

The first composition has a 780:1688 aspect ratio and maximum width of 780px, centered on desktop. Leaves, frame and paper use measured percentage positions. Following sections use a 960px maximum width and normal flow, with 64px top and 80px bottom padding. At 700px About objects form two columns; below 420px padding and gaps tighten. At 1000px section side padding becomes 60px.

Reading layout activates when root text exceeds 17.6px or the composition is narrower than 340px. It replaces absolute text positions with vertical flow, wrapping navigation and a separate framed image. The project page has a 980px reading container, 1080px header and 480px mobile breakpoint.

## Elevation & Depth

Three independently curved textured leaf meshes contain 5,400 triangles total. The fixed camera does not travel; pointer, scroll and section changes shift leaves slightly in X/Y with very small rotation. Depth comes from shallow curvature and timber/paper imagery. Rendering settles on demand and pauses offscreen. Failed WebGL leaves raster foliage and HTML usable.

Paper shadows are `2px 7px 14px #0004` beneath the revealed note and `3px 9px 24px #0004` beneath the submission sheet. The project picture uses `drop-shadow(2px 15px 18px #0008)`. The sheet's slight resting rotation clears on focus within.

**The Settled Paper Rule.** The flat note is a whole HTML surface. Peeling bends one continuous 96-row WebGL sheet with paper texture and note ink over 450ms with cubic ease-out. Reduced motion snaps to the target, including when enabled mid-transition.

## Shapes

Inputs and submit buttons have square corners. Carved timber contours and irregular paper edges belong to the assets. Frame and image share a slight rotation in the first composition. These material silhouettes do not define a general rounded-card system.

## Components

### Navigation
Real anchors connect the three sections. Active navigation uses the leaf marker and aria-current; reading layout uses an underline. Hover brightens links. Focus uses a 2px outline with 6px offset, changing to paper ink inside the submission sheet. A skip link appears on focus. Social rows have 76px minimum height and fine separators.

### Framed project
Timber and planning illustration remain separate image layers. The illustration is a planning scene, not an actual school or software screenshot; its alt text preserves that distinction. Links lead to readable HTML and existing Schedule Assistant destinations.

### Reversible note
The button reveals the back message, moves focus to restore and stores only local peeled state. Restoring returns focus. Public front/back text comes from notes.json. HTML remains usable if the paper renderer fails.

### Listening frame
Live text sits inside timber with a scrollable interior, track link and expandable history. Lanyard Spotify is primary; Last.fm JSON/history is fallback. Playback never starts automatically.

### Inputs / Fields
Paper-colored fields have a 1px border, 12px padding, 48px minimum input height and 130px minimum textarea height. Character counts use tabular numerals. Visible labels distinguish optional names and private/public scope. Failure preserves text.

### Submit buttons
Full width and at least 48px tall, dark green with pale lettering. Hover deepens green, active moves down 1px, disabled opacity is .55. Both forms lock during sends and share a cooldown. Success appears after persistence; guestbook sends await moderation.

## Do's and Don'ts

### Do:
- **Do** keep navigation, reading and submissions usable without decorative graphics.
- **Do** preserve self-hosted fonts, approved imagery and honest image descriptions.
- **Do** keep motion shallow, optional and still for reduced motion.
- **Do** preserve entered messages on failed or uncertain delivery.

### Don't:
- **Don't** substitute an island, terrain or primitive fern garden for the split leaves.
- **Don't** rasterize the interface or invent biography, project evidence or personal notes.
- **Don't** add automatic audio or camera travel in Z.
- **Don't** present pending guestbook notes as published entries.
