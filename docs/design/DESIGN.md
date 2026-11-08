# Design System: DEVOHOLICS

Design read: developer-intelligence product (dense app + public hero) for independent developers and AI engineers.
Dark-first precision-instrument language, graph-paper structure, one ember accent. Tailwind v4, Geist + Geist Mono,
Motion with restrained physics, Phosphor icons. Dials: DESIGN_VARIANCE 7, MOTION_INTENSITY 5, VISUAL_DENSITY 5.

## 1. Visual Theme & Atmosphere
A quiet control room. Obsidian surfaces separated by hairlines instead of boxes, large monospaced numbers as the
main visual weight, and a single ember accent that only ever means "this is the thing you can act on". Layouts are
asymmetric (sticky rail + content, split hero), data breathes in plain layout, and motion is short, physical and rare.
Dark is the default theme and is locked page-wide; a light theme exists as a user toggle, never as a section flip.

## 2. Color Palette & Roles (one neutral family: Zinc, one accent)
- **Obsidian** (#0A0A0B): page background
- **Panel** (#101012): primary surface (rails, toolbars, cards that earn elevation)
- **Raised** (#16161A): inputs, hovered rows, inset wells
- **Lifted** (#1D1D22): pressed/selected neutral
- **Hairline** (rgba(255,255,255,0.07)): structural 1px lines; **Hairline Strong** (rgba(255,255,255,0.13)): focus-adjacent edges
- **Paper Ink** (#ECECEE): primary text (never pure white); **Muted Steel** (#8E8E98): secondary; **Faint** (#7E7E89): tertiary/disabled
- **Ember** (#E57C45): the single accent (primary action, active nav, selected state, focus ring); text on Ember is Obsidian
- Status only, never decorative: **Go** (#62C28F), **Caution** (#E0B84B), **Alert** (#E26B6B)
- Light theme: Paper (#F6F6F7), White (#FFFFFF), Ink (#151518), Ember Deep (#B24A17)
- Banned: purple/blue neon glows, pure #000/#fff, warm beige craft palettes, second accent hues.

## 3. Typography Rules
- **Sans:** Geist. Display tracking -0.035em, weight 560-600, leading 1.02-1.08; body 14-15px, 65ch max, Muted Steel.
- **Mono:** Geist Mono for every number, version, slug, timestamp and label chip; `tabular-nums` always.
- Hierarchy by weight and colour, not just size. No serif anywhere. No uppercase micro-eyebrows except at most one per three sections.

## 4. Component Stylings
- **Shape scale (locked):** containers 12px, controls 8px, chips fully round (999px). No other radii.
- **Buttons:** Ember fill for the single primary action; ghost with Hairline for secondary. `:active` scale(0.97), 150ms ease-out. No glows.
- **Cards:** only where elevation communicates hierarchy; otherwise rows separated by `divide-y` Hairline or space.
- **Inputs:** label above, helper below, Ember focus ring (2px, offset 2px). Contrast >= 4.5:1.
- **Logos:** real owner avatars from GitHub where available, a generated monogram otherwise.
- **Loading:** skeletons shaped like the final layout. **Empty:** composed, says how to populate.

## 5. Layout Principles
Max width 1280px, CSS Grid only, `min-h-[100dvh]` never `h-screen`. Nav is one line, 56px. Feed and Explore use a sticky 240px
filter rail + content; below 768px the rail becomes a horizontal scroller and everything is single column.
Hero: asymmetric split, <= 2 headline lines, <= 20 words of subtext, one primary + one secondary CTA, real component preview.

## 6. Motion & Interaction (Emil Kowalski rules)
Never animate keyboard-driven actions. UI transitions 150-250ms, ease-out custom curve `cubic-bezier(0.23,1,0.32,1)`;
never ease-in, never `transition: all`, never from scale(0) (start 0.96 + opacity). Stagger 30-50ms, first screenful only.
Hover effects gated by `(hover:hover) and (pointer:fine)`. Animate only transform/opacity. `prefers-reduced-motion` collapses to opacity.
Popovers scale from their trigger; modals from centre.

## 7. Anti-Patterns (Banned)
No emojis. No Inter. No em-dashes in copy. No AI purple, no neon. No 3 equal feature cards. No fake div screenshots (the hero shows the
real diagram component). No scroll cues, decorative dots, section-number eyebrows, version labels, locale strips. No middle-dot spam.
No custom cursors. No lucide/unicode glyph icons: Phosphor only, one weight family.

## 8. Verified Contrast (WCAG AA)
Every text token pair used in the UI is >= 4.5:1 in both themes (checked against Obsidian/Panel/Raised in dark and Paper/White in light).
