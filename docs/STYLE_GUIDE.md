# Teikas Interface Style Guide

## 1. Purpose

This document is the design and implementation standard for all new Teikas interface work. Its purpose is to keep future pages visually consistent, accessible, and compatible with both light and dark themes.

Use the existing visual character of Teikas: restrained, editorial, calm, lightly translucent, and atmospheric. New sections should reuse established tokens and component patterns instead of introducing one-off colours, font sizes, shadows, or interaction styles.

When an existing implementation conflicts with this guide, treat this guide as the intended direction for future standardisation. Do not change an established component only to satisfy the guide without checking its use across the site.

## 2. Core principles

1. **Content comes first.** Interface styling must support reading and research rather than compete with the legends.
2. **Use semantic tokens.** Choose a colour by meaning, not by its hex value.
3. **One interaction, one visual meaning.** Green communicates interaction and navigation; yellow communicates pinned or deliberately selected content.
4. **Keep controls quiet.** Default states should be neutral. Colour appears on hover, focus, selection, or status.
5. **Preserve the palette.** New sections may use different combinations and transparency levels, but must not introduce a new brand palette.
6. **Light and dark themes are equal.** A component is not complete until it has been checked in both themes.
7. **Prefer shared patterns over local exceptions.** Reuse component classes and tokens. Avoid page-specific styling unless the page has a genuinely unique content requirement.

## 3. Design tokens

The project already uses semantic CSS custom properties. New components must use these properties rather than copying their current colour values.

### 3.1 Foundation colours

| Token | Meaning | Typical use |
| --- | --- | --- |
| `--ink` | Primary foreground | Body text, important labels, default icons |
| `--muted` | Secondary foreground | Metadata labels, hints, inactive controls |
| `--paper` | Page background | Main canvas |
| `--surface` | Subtle surface | Preview areas, passive grouped content |
| `--raised` | Raised/translucent surface | Cards, menus, panels, form controls |
| `--line` | Structural border | Dividers, card borders, input outlines |
| `--navy` | Deep background/shadow base | Dark sections and shadow colour mixing |
| `--blue` | Brand and editorial accent | Titles, structural emphasis, selected editorial content |

### 3.2 Interaction and status colours

| Token | Meaning | Rules |
| --- | --- | --- |
| `--interaction-green` | Global interactive green | Links, navigation hover, back links, interactive icons |
| `--browse-green` | Browser/detail interaction green | May alias the global interaction colour within browsing views |
| `--focus` | Keyboard focus | Focus rings only; keep visibly distinct from the background |
| `--pin` | Pinned/selected status | Pins, pinned borders, intentional persistent selection |
| `--pin-soft` | Soft yellow surface | Search highlights and subtle pinned emphasis |
| `--ambient-blue` | Blue atmosphere | Large, low-contrast decorative washes |
| `--ambient-green` | Green atmosphere | Interactive ambience and subtle decorative washes |
| `--ambient-yellow` | Yellow atmosphere | Very restrained pinned/highlight ambience |

Do not use green to indicate that an item is pinned. An unpinned pin icon uses the normal text colour; a pinned item uses `--pin`.

Do not use yellow as a generic hover colour. Yellow is reserved for a persistent selected or pinned state and for text-search highlighting.

### 3.3 Adding tokens

Add a new global token only when all of the following are true:

- it represents a reusable semantic role;
- it will be used by at least two components or sections;
- it has both light and dark theme values;
- an existing token cannot express the same meaning.

Component-scoped custom properties are acceptable for genuinely local data categories, but they must derive from or harmonise with the global palette.

## 4. Typography

### 4.1 Font roles

- Use `var(--sans)` for navigation, controls, labels, metadata, utility text, and general interface copy.
- Use `var(--serif)` for page titles, legend titles, editorial headings, and primary reading text.
- Do not use the serif font merely to make a control look important.
- Information-panel headings, filter headings, buttons, and menu labels use the sans-serif interface font.

### 4.2 Type scale

Use this scale for new components. Choose the closest level rather than creating an intermediate size.

| Role | Size | Suggested line height |
| --- | --- | --- |
| Micro/helper | `0.75rem` | `1.4` |
| Label/metadata | `0.875rem` | `1.45` |
| Interface body | `1rem` | `1.55` |
| Emphasised interface text | `1.125rem` | `1.45` |
| Card title | `1.25rem`–`1.375rem` | `1.25` |
| Reading text | `1.08rem`–`1.15rem` | `1.7`–`1.75` |
| Section heading | `clamp(1.75rem, 3vw, 2.5rem)` | `1.15` |
| Page heading | `clamp(2.5rem, 5vw, 4.75rem)` | `1` |

### 4.3 Font weights

Use only these standard weights in new work:

- `400`: body text, helper text, metadata, ordinary controls;
- `500`: active labels, card titles, restrained emphasis;
- `600`: button labels and important interface labels;
- `700`: rare, strong emphasis only.

Avoid non-standard intermediate values such as `450`, `650`, and `750`. They may render inconsistently when a font file does not contain that exact weight.

Avoid bold text as a substitute for hierarchy. Prefer spacing, colour, size, or position first.

### 4.4 Text details

- Use tabular numerals for IDs, years, counts, and pagination values.
- Keep labels in sentence case.
- Do not use all caps except for established abbreviations or a deliberately defined eyebrow style.
- Use `overflow-wrap: anywhere` for unpredictable metadata values, not for normal headings.
- Reading text must never be visually reduced to interface-label styling.

## 5. Links

### 5.1 Inline content links

- Inline links must remain recognisable without relying on hover.
- Use the established link colour and an underline where the surrounding context does not already make the link obvious.
- On hover, shift to `--interaction-green`; do not add a heavy background.
- Keep underline offset consistent and never use colour as the only indication of keyboard focus.

### 5.2 Navigation and utility links

- Header navigation hover: green text with a restrained transition.
- Active header navigation: green text and a green underline.
- Back links: muted by default; green text and icon on hover.
- The Teikas wordmark: retain its default brand colour; use the same green hover language as other global navigation.
- Previous/next legend links: title and directional label become green together on hover.

Avoid scaling ordinary text links. If motion is used in primary navigation, keep it extremely subtle and consistent.

### 5.3 Link transitions

Use a standard duration of `180ms` with `ease` for colour, border, background, and light shadow transitions.

## 6. Buttons and controls

### 6.1 Shared button sizes

| Size | Height | Use |
| --- | --- | --- |
| Compact | `34px`–`36px` | Header tools, icon controls, dense utilities |
| Default | `40px` | Filters, sort controls, pagination, secondary actions |
| Large | `46px`–`48px` | Primary page actions only |

Use a fully rounded pill for text controls and a circle for icon-only controls. Do not mix arbitrary radii within the same control group.

### 6.2 Button variants

#### Primary

- Use sparingly for the main action on a page.
- Filled background; strong readable contrast.
- Hover may slightly strengthen the shadow or background.
- Do not place several competing primary buttons in one toolbar.

#### Secondary/outline

- Transparent or lightly raised background.
- `--line` border and `--ink` or `--blue` text.
- Hover uses a subtle green-tinted border or wash.

#### Text action

- No enclosing border unless needed for discoverability.
- Text and icon use the same colour.
- Hover changes both to green.
- Do not underline button elements; underlines are for links.

#### Icon button

- Provide an accessible name with visible text or `aria-label`.
- Use the compact size consistently.
- Default icon colour is `--ink` or `--muted` according to importance.
- Hover uses green with a very light green surface.

#### Pinned state

- Unpinned pin: normal text colour, visually quiet.
- Pinned pin: `--pin` with a persistent yellow border or emphasis.
- Hover alone must never make an unpinned item appear pinned.

### 6.3 Toggle groups

Language, list/grid, and similar mutually exclusive options use a shared pill container.

- Inactive option: muted text, transparent background.
- Hover: light interaction wash.
- Active option: outlined persistent state, not a heavy filled capsule.
- Use yellow only when the selection is intentionally part of the existing yellow selection language; otherwise use green consistently.

### 6.4 Disabled controls

- Keep labels readable.
- Reduce contrast without making the control disappear.
- Use `cursor: not-allowed` only for controls that remain interactive elements.
- Provide a nearby explanation when the reason is not obvious, for example why downloads are unavailable.

## 7. Form fields

- Default control height is `40px`; large search fields may use `46px`–`48px`.
- Use a pill shape for single-line search, selection, and compact numeric inputs.
- Default border is `--line`.
- Default background is `--raised` or a very lightly transparent derivation of it.
- Placeholder text uses `--muted` and must remain readable in dark mode.
- Hover slightly strengthens the border.
- Focus uses one visible green/focus ring; do not stack several outlines.
- Error states require text as well as colour.
- Native controls may be used only when their appearance is acceptable and consistent across supported browsers; otherwise use the established custom menu pattern.

## 8. Menus, disclosure panels, and filters

### 8.1 Menus

Sorting, page-size, download, and future selection menus must share the same structure:

- rounded raised panel;
- `--line` or a subtle green-mixed border;
- restrained ambient shadow;
- optional backdrop blur;
- rows with a transparent default background;
- green wash on hover;
- green check and text for the selected row;
- no native blue selection fill.

Menus close when the user selects an option, presses Escape, or clicks outside the menu.

### 8.2 Disclosure controls

Filter blocks, “Additional metadata”, and editorial comments share one disclosure behaviour:

- sans-serif label with normal weight;
- chevron rotates when opened;
- green text/icon and a faint green surface on hover;
- the entire summary row is clickable;
- no bold label solely to signal that the section can be opened.

### 8.3 Checkboxes

- Use an unfilled box by default.
- Checked state uses a green check without a heavy filled background.
- The label remains the main clickable target.
- Use the same checkbox treatment for places, people, undated texts, and future filter categories.

### 8.4 Active filter tags

- Tags identify the applied category and value.
- Keep fills translucent.
- The remove icon and label respond together on hover.
- Do not show a negative “without unknown…” tag when a concrete place or person selection already communicates the effective filter, unless the distinction changes the result set and must be made explicit.

## 9. Cards and surfaces

### 9.1 Surface levels

Use three visual levels:

1. **Page:** `--paper`, no border.
2. **Passive surface:** `--surface`, used for grouped or inset content.
3. **Raised surface:** `--raised`, used for cards, menus, filters, and information panels.

Do not create another background level with a new hard-coded colour.

### 9.2 Interactive cards

- Default: subtle border, quiet translucent background.
- Hover: no more than `translateY(-2px)`, a slightly greener border, and a restrained ambient shadow.
- Focus-visible: clear focus ring independent of hover.
- Pinned: persistent yellow indication that remains distinguishable from hover.

### 9.3 Static panels

Static information panels should not lift as though clickable. Only their actual interactive rows receive hover treatment.

### 9.4 Transparency and ambience

- Transparency should create depth, not reduce legibility.
- Use `color-mix()` with semantic tokens where possible.
- Keep dark-theme glow larger but lower in opacity; avoid bright neon edges.
- Use backdrop blur as enhancement, not as the only way to separate a panel from the background.
- Ensure the fallback without backdrop-filter remains readable.

## 10. Search highlights and selection

- Search matches use a translucent yellow highlight derived from `--pin-soft` or the established yellow palette.
- The highlight must look like marked text, not an underline.
- Preserve text contrast in both themes.
- Do not reuse the search-highlight style for hover, focus, or validation.

## 11. Motion

- Standard interaction transition: `180ms ease`.
- Large ambient animation may be slower, but must remain subtle.
- Use movement only when it communicates interaction, hierarchy, or state.
- Avoid simultaneous scale, translation, bright glow, and colour change on a single ordinary control.
- Respect `prefers-reduced-motion: reduce`; remove decorative animation and non-essential transforms.

## 12. Focus and accessibility

- Every interactive element must have a visible `:focus-visible` state.
- Use a consistent ring based on `--focus` or the designated interaction token.
- Do not remove outlines unless an equivalent focus indicator is supplied.
- Minimum pointer target: `40 × 40px` where layout permits; never below `34 × 34px` for compact controls.
- Icon-only controls require accessible names.
- Colour must not be the only way to communicate selected, pinned, disabled, expanded, or error states.
- Maintain sufficient text and control contrast in both themes.
- Test keyboard order, Escape behaviour, and outside-click closing for custom menus.

## 13. Responsive behaviour

- Design for content reflow, not merely element shrinking.
- Toolbars may wrap or split into two rows before labels become compressed.
- Preserve at least `40px` control heights on touch layouts.
- Move secondary information below primary content on narrow screens.
- Avoid hiding essential status, navigation, or active-filter information.
- Custom menus must remain inside the viewport.
- Test at approximately 1440px, 1024px, 768px, and 390px widths.

## 14. CSS implementation rules

1. Define foundational tokens once in the global token section and override only their values for dark mode.
2. Keep each shared component in one canonical CSS section.
3. Do not redefine a complete component later in the cascade to correct an earlier version.
4. Prefer modifier classes and state attributes such as `[aria-pressed="true"]`, `[aria-selected="true"]`, `[open]`, and `.is-pinned`.
5. Prefer semantic component classes over deeply nested page selectors.
6. Avoid `!important` except for accessibility utilities or a documented third-party override.
7. Avoid hard-coded colours inside components. Decorative illustrations are the main exception.
8. Use shared duration, radius, spacing, and shadow tokens when these are introduced during CSS consolidation.
9. Page-specific CSS may control layout; shared CSS controls the appearance of buttons, links, fields, cards, menus, and states.
10. New work must not add another visual variant when an existing variant can express the requirement.

## 15. Recommended component naming

The existing code does not need to be renamed immediately. For new reusable work, follow a predictable structure:

```css
.button { }
.button--primary { }
.button--secondary { }
.button--text { }
.button--icon { }
.button--compact { }

.menu { }
.menu__trigger { }
.menu__panel { }
.menu__option { }

.card { }
.card--interactive { }
.card--pinned { }
```

State should preferably be expressed with native attributes or existing state classes:

```css
[aria-pressed="true"] { }
[aria-selected="true"] { }
[aria-expanded="true"] { }
:focus-visible { }
.is-pinned { }
.is-disabled { }
```

## 16. New-section checklist

Before considering a new section complete, confirm:

- [ ] It uses existing semantic colour tokens.
- [ ] It works in light and dark themes.
- [ ] Sans-serif and serif fonts follow their defined roles.
- [ ] Font sizes and weights use the approved scale.
- [ ] Buttons use an existing size and variant.
- [ ] Links follow the appropriate inline, navigation, or utility pattern.
- [ ] Hover does not conflict with selected or pinned status.
- [ ] Focus-visible is clear and keyboard navigation works.
- [ ] Menus close on selection, Escape, and outside click.
- [ ] Motion respects reduced-motion preferences.
- [ ] The layout has been checked at desktop, laptop, tablet, and mobile widths.
- [ ] No unnecessary hard-coded colour, shadow, radius, or font value was introduced.
- [ ] The component is defined once rather than patched later in the cascade.

## 17. Current implementation note

The current site loads styles in this order:

1. `global.css`
2. `polish.css`
3. `responsive-fix.css`
4. `icons.css`

At present, `polish.css` contains historical refinements and repeated overrides for several shared components. Future standardisation should consolidate these definitions carefully, component by component, while preserving the current appearance. Until that work is complete, verify the final computed styles rather than assuming the first matching rule is authoritative.
