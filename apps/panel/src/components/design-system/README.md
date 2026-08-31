# TK Copilot Design System v1

**Status:** Adopted — structural rollout complete
**Version:** 1.0.0
**Last updated:** 2026-08-30
**Product surfaces:** Desktop Panel and desktop-class web Panel

This document supersedes the previous "Calm Tech Command Center" specification. The previous
specification made gradient buttons, lifted cards, glass, and glow default treatments. That
created visual richness, but it also made hierarchy depend on decoration. The first flat-style
experiment removed much of that decoration without replacing its hierarchy, producing a weak,
unfinished result.

V1 keeps dimensionality. It makes depth intentional.

## 1. Product position

### Brand direction: Precision Intelligence

TK Copilot is an operational AI workspace, not a generic SaaS dashboard and not a consumer AI
chat toy. It should feel:

- precise rather than sterile;
- dimensional rather than ornamental;
- calm under high information density;
- alive when agents are working;
- trustworthy when money, customers, campaigns, and inventory are involved.

### Visual grammar: Refined Optical Depth

The memorable signature is a quiet, engineered surface system with a thin signal line. Depth,
light, and motion communicate state. They are not page decoration.

## 2. Design principles

1. **Hierarchy before decoration.** Position, size, contrast, and containment establish priority.
2. **Depth has meaning.** A raised object must be interactive, transient, dragged, or selected.
3. **Content stays calm.** Operational data gets neutral surfaces and dependable geometry.
4. **Signals may be expressive.** Primary actions, live agent activity, and selected states may
   use controlled gradients, highlights, and motion.
5. **Density is a feature.** Desktop users should scan quickly without navigating card mazes.
6. **Consistency is not uniformity.** Shared primitives stay consistent; workflows may compose
   them differently.
7. **Light and Dark are designed independently.** Dark is not an inverted Light palette.
8. **Accessibility is part of the component contract.** It is not a release cleanup step.

### Product shell hierarchy

The desktop composition has four structural levels. They must remain visually and spatially
distinct:

1. **Global shell navigation** owns the full application height and the product's primary
   destinations. A page header must never cover or visually replace it.
2. **Page header** belongs to the main-content column. It provides current-page context, status,
   and page-level actions; it never spans across the global navigation.
3. **In-page navigation** is optional, subordinate to the page header, and usually rendered as a
   horizontal section rail. It must not resemble a second sidebar.
4. **Page content** contains workflow sections and uses the layer model below.

Only an intentional L3 application modal may interrupt both the shell and page. Popovers,
drawers, sticky headers, and signals otherwise stay inside the region that owns them.

The 4px layout grid is a construction rule, not a visible product texture. Visible grid lines are
allowed only inside a bounded measurement, canvas, editor, or Design Lab specimen. They are never
the default background of an operational page.

## 3. Layer model

Every surface belongs to exactly one layer.

| Layer      | Purpose                              | Treatment                                             | Examples                                     |
| ---------- | ------------------------------------ | ----------------------------------------------------- | -------------------------------------------- |
| L0 Canvas  | Stable workspace                     | Opaque, atmospheric light, no cast shadow             | Page background, table body                  |
| L1 Surface | Group related content                | Tonal separation, optical edge, low ambient elevation | Section, interactive tile                    |
| L2 Raised  | Temporary or actively manipulated UI | Clear shadow, raised surface, stronger edge           | Menu, popover, command palette, dragged item |
| L3 Modal   | Interrupting decision layer          | Backdrop plus strongest elevation                     | Dialog, approval, destructive confirmation   |
| Signal     | State overlay; not a physical layer  | Accent line, restrained gradient, pulse               | Live agent, selected nav item, primary CTA   |

Rules:

- L0 never casts a shadow. A low-contrast, accent-aware ambient light field is allowed, but it
  cannot read as a decorative blob or visible grid.
- L1 static sections use a border, optical highlight, and elevation 1. They never change elevation
  on hover.
- L1 interactive tiles may use elevation 1 at rest and elevation 2 on hover.
- L2 and L3 are the only general-purpose glass-capable layers.
- Signal effects never cover large reading surfaces.

## 4. Token architecture

The implementation has three token layers:

1. **Primitive:** raw scales such as neutral color, spacing, type size, and duration.
2. **Semantic:** mode-aware roles such as `bg.canvas`, `fg.muted`, and `border.default`.
3. **Component:** private mappings such as `button.primary.bg` and `menu.shadow`.

Raw values are allowed only where primitive tokens are declared. Product code must never consume
primitive color values directly.

```text
primitive.blue.600
        ↓
semantic.accent.default
        ↓
component.button.primary.background
```

### Naming

- CSS primitive: `--tk-v1-neutral-900`
- CSS semantic: `--tk-v1-bg-canvas`
- CSS component-private: `--_tk-button-bg`
- React primitive: `TkButton`, `TkIconButton`, `TkComposer`, `TkField`, `TkSection`
- CSS class: `.tk-v1-button`, `.tk-v1-field`, `.tk-v1-section`

## 5. Foundations

### 5.1 Typography

| Role          | Font           | Size / line height |  Weight |
| ------------- | -------------- | -----------------: | ------: |
| Display       | IBM Plex Sans  |            34 / 40 |     600 |
| Page title    | IBM Plex Sans  |            26 / 32 |     600 |
| Section title | IBM Plex Sans  |            16 / 22 |     600 |
| Body          | IBM Plex Sans  |            13 / 20 |     400 |
| Control       | IBM Plex Sans  |            13 / 18 |     500 |
| Supporting    | IBM Plex Sans  |            12 / 18 |     400 |
| Micro label   | JetBrains Mono |            10 / 14 |     500 |
| Data / ID     | JetBrains Mono |            12 / 18 | 400–500 |

Guidance:

- Sentence case is the default.
- Uppercase is reserved for short mono metadata labels.
- Numeric data uses tabular figures.
- Use weight and space before color to create text hierarchy.
- Chinese falls back to PingFang SC on macOS and Microsoft YaHei on Windows.

### 5.2 Spacing and density

All layout uses a 4px base grid.

| Token | Value | Common use                |
| ----- | ----: | ------------------------- |
| 1     |   4px | Tight icon gap            |
| 2     |   8px | Inline control gap        |
| 3     |  12px | Compact padding           |
| 4     |  16px | Default component padding |
| 5     |  20px | Section rhythm            |
| 6     |  24px | Page rhythm               |
| 8     |  32px | Major separation          |
| 12    |  48px | Editorial separation      |

Control heights are 28px compact, 34px default, and 40px prominent. Table rows are 36px compact
or 44px default. Touch-first 48px targets are not required for the desktop shell, but all small
icon targets need a minimum 32px hit area.

### 5.3 Shape

| Token    | Value | Use                                 |
| -------- | ----: | ----------------------------------- |
| radius.1 |   2px | Small tags, code                    |
| radius.2 |   4px | Buttons, inputs, nav items          |
| radius.3 |   6px | Tiles, grouped controls, menus      |
| radius.4 |   8px | Sections                            |
| radius.5 |  12px | Dialogs and major floating surfaces |
| round    | 999px | Status badge, avatar, switch only   |

Do not use pills as general buttons or tabs. Nested radii decrease inward: an 8px section owns
4px controls. The reduced scale is part of the product's precise, engineered character; round is
reserved for components whose shape communicates state or identity.

### 5.4 Color

Neutral colors own the interface. Accent is a signal.

| Role           | Light     | Dark                    |
| -------------- | --------- | ----------------------- |
| Canvas         | `#F2F4F6` | `#111318`               |
| Surface        | `#FBFCFD` | `#171A1F`               |
| Raised         | `#FFFFFF` | `#20252C`               |
| Sidebar        | `#ECEFF2` | `#0D0F12`               |
| Text           | `#15191F` | `#EDF0F3`               |
| Secondary text | `#525B66` | `#AEB6C0`               |
| Muted text     | `#7E8894` | `#747F8B`               |
| Border         | `#D8DDE3` | `rgba(235,240,246,.10)` |

Default brand signal is cobalt. Cyan is a secondary operational signal, not a second general
accent. User accent themes may remap the brand signal, but semantic success, warning, danger, and
information colors never change with theme choice.

Accent coverage should remain below roughly 8% of a typical operational screen.

### 5.5 Gradient and highlight

Gradients are allowed when they communicate energy or optical material:

- primary CTA: subtle same-family gradient;
- active AI state: cobalt-to-cyan signal gradient;
- L0 canvas: a full-page, nonrepeating ambient field with no visible edge or hotspot;
- L1 optical surface: vertical luminance delta no greater than approximately 4% in Light or 8% in
  Dark;
- skeleton or progress motion.

Large decorative gradients are not allowed as default page backgrounds, every-card decoration,
text fill, or semantic status color. Canvas atmosphere stays below content contrast and must never
tile. Large purple blobs and decorative cyan glows are prohibited.

An optical top highlight may be used on L1–L3 surfaces. It must be a 1px inset or edge highlight,
not a visible white stripe.

### 5.6 Elevation

| Token             | Light                                   | Dark                                 | Use                    |
| ----------------- | --------------------------------------- | ------------------------------------ | ---------------------- |
| elevation.0       | none                                    | none                                 | Canvas, table body     |
| elevation.1       | `0 1px 2px rgba(17,24,39,.05)`          | `0 1px 2px rgba(0,0,0,.24)`          | Tactile control        |
| elevation.surface | Three low-opacity ambient shadow layers | Three directional dark shadow layers | Static L1 section      |
| elevation.2       | `0 10px 28px rgba(17,24,39,.10)`        | `0 14px 36px rgba(0,0,0,.36)`        | Menu, hover card       |
| elevation.3       | `0 22px 56px rgba(17,24,39,.16)`        | `0 26px 72px rgba(0,0,0,.50)`        | Modal, command palette |

No component may choose an arbitrary shadow. Dark surfaces primarily use edge contrast; shadows
alone cannot communicate hierarchy.

### 5.7 Motion

| Token | Duration | Use                     |
| ----- | -------: | ----------------------- |
| fast  |    120ms | Hover, press, toggle    |
| base  |    180ms | Tab and component state |
| slow  |    240ms | Panel, menu, modal      |

Standard easing is `cubic-bezier(.2, 0, 0, 1)`. Emphasized entry uses
`cubic-bezier(.16, 1, .3, 1)`.

- Top-level navigation fades; it does not slide the whole workspace.
- Hover does not translate static cards.
- Agent activity may pulse opacity or move a signal trace.
- `prefers-reduced-motion` removes decorative motion and preserves instantaneous state feedback.

## 6. Component contracts

### 6.0 Page composition

Every standard product page is composed from shared layout primitives. Pages provide content;
they do not own shell or header geometry.

| Owner          | Component      | Geometry contract                                  |
| -------------- | -------------- | -------------------------------------------------- |
| Application    | App Shell      | 28px top, 48px inline, 48px bottom desktop inset   |
| Page           | `TkPageFrame`  | 16px vertical rhythm; no page-local outer padding  |
| Page context   | `TkPageHeader` | 12px block, 16px inline padding; 80px minimum      |
| Content group  | `TkPanel`      | 8px radius and semantic L1/L2 surface variants     |
| Local controls | `TkToolbar`    | 8px control gap; open or framed composition        |
| Record set     | `TkTableFrame` | shared overflow, header, row density, and boundary |

The App Shell is the only owner of distance from the sidebar and viewport. `TkPageHeader` is the
only owner of title, description, and page-action alignment. A workflow may choose which sections
appear and in what order, but it may not redefine these measurements. Responsive shell insets are
24px at medium widths and 16px at compact widths.

Composite panels use `TkPanelHeader`, `TkPanelBody`, and `TkPanelFooter` for internal geometry.
When an embedded table or media surface reaches a panel edge, `TkPanel` uses `clip` and remains the
only owner of the outer radius.

### 6.1 Button

Variants are Primary, Secondary, Ghost, and Danger.

- Primary is solid or a restrained same-family gradient and appears once per decision region.
- Secondary uses a dimensional neutral surface with a border and optical highlight.
- Ghost is for low-priority toolbar actions.
- Danger never becomes the default action through position alone.
- Loading preserves button width, sets `aria-busy`, and prevents duplicate submission.
- Icon-only actions use `TkIconButton`; the accessible label and square control geometry are part of
  the component contract, never reconstructed with an unstyled page button.

### 6.2 Field

Every field has a programmatic label. Hint, error, and unit occupy a stable support row. Focus uses
both border and focus ring. Error uses icon or text in addition to color.

`Select` owns `default` / `ghost` appearance and `default` / `compact` density. A page chooses a
variant through props; it never restyles `.custom-select-trigger`. `TkComposer` owns the combined
textarea, focus boundary, keyboard submit, disabled state, and send action. Mixed field/action rows
use `.tk-v1-form-action-row` so every action shares the default control baseline.

Vertical settings and edit forms use `TkFormStack`; a titled subset of related fields uses
`TkFormGroup`. Framed composites use `TkPanelBody` for content padding and `TkPanelFooter` for
actions. Product code must not rely on an unrelated feature stylesheet to provide these spaces.

Legacy page-level control bridges must exclude elements whose class contains `tk-v1-`. Once a
shared primitive is present, that primitive alone owns hover, focus, disabled, and loading states.

### 6.3 Hierarchical navigation

`TkHierarchicalNav` owns the product's two-level destination model. The first level is a stable
orientation rail; a parent discloses its second-level destinations in a portal flyout. A parent
never both navigates and discloses. Direct first-level destinations remain ordinary navigation
actions.

- Hover intent and focus open a temporary flyout; clicking a parent pins or unpins it.
- Arrow Right, Arrow Down, Enter, and Space open a parent and move focus into its first child.
  Arrow keys, Home, and End traverse children; Arrow Left and Escape close and restore focus.
- `aria-current="page"` belongs to the selected destination. A parent receives only a visual
  active-path signal when one of its children is current.
- Section labels inside a flyout are noninteractive scan aids. They never create a third
  interactive navigation level.
- The collapsed icon rail preserves accessible names and the same flyout behavior. Hover is never
  the only path to a destination.
- Route metadata is the information-architecture source of truth. Pages may not insert their own
  shell navigation markup or override flyout geometry.

### 6.4 Tabs

`TkTabs` has two intentional variants: `line` for compact content switching and `rail` for richer
in-page navigation with optional icon, description, count, and semantic tone. Both are navigation
or content-section controls, use `tablist` semantics, and implement roving arrow-key focus. Use the
`scrollable` contract for constrained headers: it scrolls only on the inline axis, never creates a
vertical scrollbar, and keeps its scrollbar visually hidden while keyboard focus remains usable.

`TkSegmented` is reserved for mutually exclusive view, metric, time-window, and filter modes. It
uses radio semantics. Neither tabs nor segmented controls may be recreated as pill-button rows in
page code.

### 6.5 Section and Card

`TkSection` is the default titled grouping primitive. `TkPanel` is the unopinionated content
surface for existing headings or custom composition. `TkCard` is reserved for independently
actionable, selectable, draggable, or summarized content.

Static cards do not react on hover. Interactive cards must expose the same selected and focus state
to keyboard users.

### 6.6 Table

Tables are the default for comparable operational records. `TkTableFrame` owns the boundary,
overflow, header density, and row rhythm. The `standalone` variant has a 6px frame. The `embedded`
variant is square and flush with its parent `TkPanel`; the parent alone owns outer clipping and its
8px radius. Never put a rounded table frame inside another rounded surface. Headers remain quiet,
numbers align on the decimal or right edge, IDs and metrics use mono type, row actions appear
consistently, and status never relies on color alone.

When opening a record is the row's primary action, use `TkInteractiveTableRow` instead of adding a
redundant View button. Click, Enter, and Space activate the row; hover and focus share the standard
table signal. Inputs, links, buttons, selects, and other nested controls remain independent and do
not trigger the row. Destructive or state-changing actions stay explicit in the actions column.

### 6.7 Badge and status

Badges communicate categorical state. A live status may add a dot or pulse. Pills are not used as
general decoration. Labels use explicit language such as `Running`, `Needs review`, and `Failed`.

### 6.8 Overlay

Popovers and menus use elevation 2. Modals use elevation 3 and an opaque-enough backdrop. Frosted
material is allowed only when underlying content remains legible and does not become visual noise.

- All overlays render through a document-level portal and reposition on resize, nested scroll, and
  viewport collision.
- The layer scale is semantic: shell, sticky content, ordinary popover, modal, modal-child popover,
  and toast. A portal opened from inside a modal is promoted automatically; an ordinary shell menu
  can never paint above a modal.
- Escape closes the top overlay and returns focus to its trigger. Pointer-down outside closes a
  nonmodal overlay without changing the active workflow.
- Menus use `menu` / `menuitem` semantics. Arrow keys, Home, and End move focus; Tab exits.
- Popovers add local information or controls. They never replace a modal decision or hide a major
  workflow.
- Modals trap focus, lock background scroll, and interrupt both shell and content only for a
  genuine decision or bounded task.
- Modal headers and navigation rails never own vertical scrolling. One explicit modal body region
  owns the workflow's vertical scroll.

### 6.9 Feedback state

`TkAlert`, `TkLoadingState`, and `TkEmptyState` own generic feedback geometry and semantics.
Feature-specific states may add domain content, but pages must not recreate the generic
`error-alert`, `loading-state`, or `empty-state` wrappers. Danger alerts announce immediately;
loading states expose polite status; empty states use copy and a restrained signal mark rather
than decorative illustration.

## 7. AI interaction patterns

AI state is expressed with a signal system rather than sparkles.

| State                | Visual behavior                                        |
| -------------------- | ------------------------------------------------------ |
| Idle                 | Neutral icon and text                                  |
| Thinking             | Moving signal trace plus explicit label                |
| Acting               | Accent rail, tool/action label, progress if measurable |
| Waiting for approval | Warning containment and clear decision buttons         |
| Complete             | Brief success confirmation, then calm state            |
| Failed               | Error containment, cause, and recovery action          |

The user must always be able to distinguish observation, proposal, approval, execution, and
completion.

## 8. Accessibility

- Meet WCAG 2.2 AA contrast: 4.5:1 text, 3:1 large text and interactive boundaries.
- Every interactive element is keyboard reachable and has a visible focus state.
- Color is never the sole carrier of status.
- Respect reduced motion, increased contrast, and browser zoom to 200%.
- Avoid important information in hover-only UI.
- Validate both English and long translated labels.

## 9. Governance

### Required artifacts

- this specification;
- a Design Lab rendering every primitive, variant, state, density, and theme;
- visual-regression baselines for Light and Dark;
- usage examples and component API tests;
- a migration ledger listing remaining legacy components.

### Change process

1. Add or change a token/component in the Design Lab.
2. Review Light, Dark, compact, default, disabled, error, focus, and loading states.
3. Approve the visual and interaction contract.
4. Implement or update the shared component.
5. Migrate business pages without page-local clones or overrides of shared components.

The binding implementation rules live in `apps/panel/AGENTS.md`. `styles.css` and `tk-v1.css` are
import-only cascade manifests. Design System contracts are owned by the responsibility files under
`design-system/styles/`; product styling is colocated and scoped to its component or feature.
`pnpm css:check` rejects CSS rules with no live caller, and the architecture guard prevents either
manifest or a new monolithic stylesheet from accumulating declarations.

### Prohibited in migrated product code

- raw hex, RGB, shadow, radius, duration, or z-index values;
- page-local clones of shared controls;
- styling through inline `style` props except runtime geometry or data visualization;
- `!important` as normal component composition;
- decorative gradients or glow without a documented semantic role.

## 10. Migration gates

V1 migration proceeds by shared product archetype after Design Lab approval. Page-by-page visual
approval is not required once an archetype is approved; a batch pauses only for information
architecture, interaction-model, or brand-direction decisions.

1. **Foundation:** tokens, typography, focus, density, theme contract.
2. **Primitives:** button, field, tabs, badge, section, card, table, overlay.
3. **Archetypes:** Settings, operational list/workbench, Chat.
4. **Shell:** navigation, command surface, notification and account chrome.
5. **Feature migration:** one workflow family per batch with before/after screenshots.
6. **Enforcement:** lint or architecture checks reject new raw visual values.

Settings and the Affiliate attention workbench are the approved reference archetypes. Settings
defines preference and form composition; the workbench defines dense operational composition.
Feature families now migrate through their shared page frame and primitives, with representative
Light and Dark review at each batch milestone. This is mechanical integration, not page-level
visual design: any requested page-local spacing or control clone is treated as a missing component
contract and resolved in the library first.

### Migration ledger

| Area                                         | Status           | Next gate                                      |
| -------------------------------------------- | ---------------- | ---------------------------------------------- |
| Foundation tokens and Light/Dark mapping     | Approved         | Reuse without page-local visual values         |
| Button, field, choice select, switch, tabs   | Adopted          | Guard against page-local clones                 |
| Alert, loading, empty, badge, status, metrics| Adopted          | Extend only through component contracts         |
| Page frame, header, panel, toolbar, table    | Adopted          | Structural CI guard active                      |
| Popover, menu, modal contract                | Adopted          | Continue keyboard and collision regression QA  |
| Tooltip and info-tip contract                | Adopted          | Use the shared portal implementation           |
| Settings                                     | Approved         | Reference archetype for preference pages       |
| Affiliate attention workbench                | Approved         | Reference archetype for operational pages      |
| Affiliate shared business-page frame         | Adopted          | Preserve domain-specific dense composites      |
| Commerce operations                          | Adopted          | Representative Light/Dark visual regression    |
| Remaining product families                   | Adopted          | Continue replacing nonstructural legacy controls|

The chat session tab bar remains an intentional composite exception: it manages closable,
reorderable sessions rather than page navigation. It must keep the shared tokens and accessibility
contract, but it should not be forced into `TkTabs` until a dedicated document-tab primitive is
specified.
