# Panel development rules

These rules apply to every file under `apps/panel/`. They are the engineering contract for
Design System v1, not optional visual guidance.

## 1. Start from the shared system

- Import product UI primitives from `src/components/design-system/index.ts`.
- Standard pages use `TkPageFrame` and `TkPageHeader`. The application shell alone owns viewport
  and sidebar offsets; pages must not add their own outer canvas padding.
- Use `TkPanel`, `TkPanelHeader`, `TkPanelBody`, and `TkPanelFooter` for surfaces; `TkTableFrame`
  for every product table; `TkInteractiveTableRow` when the row's primary action opens its record;
  `TkToolbar` for filter/action rows.
- Use `TkButton`, `TkIconButton`, `TkComposer`, `TkField`, `TkChoiceSelect`,
  `TkSwitch`/`TkSwitchControl`, `TkBadge`, `TkTabs`, `TkSegmented`, `TkAlert`, `TkLoadingState`,
  and `TkEmptyState` instead of page-local clones.
- Product-shell destinations use `TkHierarchicalNav`. Route metadata owns the information
  architecture; product pages never append sidebar items or implement their own navigation
  flyout.
- All dialogs, confirmation flows, tooltips, menus, and popovers go through `TkModal`,
  `TkConfirmDialog`, `TkTooltip`, `TkInfoTip`, `TkMenu`, or `TkPopover`. Product pages never call
  `createPortal` and never import the low-level `components/modals/Modal` implementation.

If a shared primitive is close but insufficient, extend its explicit API and add the state to the
Design Lab. Do not patch its internal class from a page stylesheet.

## 2. Decide where a component belongs

- Promote an interaction to the shared design-system layer immediately when it owns focus,
  keyboard behavior, overlay positioning, loading/disabled behavior, or accessibility semantics.
- Promote a visual pattern when a second feature needs it. The second copy is the signal to stop
  and extract; do not create a third copy.
- Keep domain composites near their feature when their structure expresses business meaning
  (for example, a campaign funnel or creator relationship card). They must still compose shared
  primitives and semantic tokens.
- Shared layers must never import from `pages/`; cross-feature reuse moves to `components/`,
  `lib/`, or `api/` first.

## 3. CSS ownership

- `src/styles.css` and `src/components/design-system/tk-v1.css` are import-only cascade manifests.
  They must never contain selectors or declarations.
- Design System ownership is split under `src/components/design-system/styles/`: tokens, layout,
  controls, navigation, sections, feedback, and overlays. Extend the file that owns the component
  contract; do not create another catch-all Design System stylesheet.
- A feature stylesheet may own only domain-specific composition and must be colocated with the
  feature. New feature CSS is imported by its owning component, not added to the global manifest.
  Prefix selectors with the feature/component name; do not introduce generic names such as
  `.card`, `.header`, `.row`, or `.active`.
- Files named `Legacy`, `legacy-*`, or `*Legacy` are migration bridges. They are frozen: touched
  rules move to an owner stylesheet or a Design System contract, and no new rule is added there.
- No CSS file may exceed 4,500 lines. This is a backstop, not a target; split earlier whenever a
  file contains more than one component or domain responsibility.
- Never add a CSS rule without a live source reference. `pnpm css:check` rejects orphaned rules,
  missing imports, import cycles, and CSS files that are unreachable from the application module
  graph; `pnpm css:prune` removes rules whose class selectors have no caller.
- Product CSS consumes semantic `--tk-v1-*` tokens. Raw color, shadow, radius, duration, and
  z-index values belong only in token declarations or a documented data-visualization palette.
- Inline `style` is allowed only for runtime geometry or data visualization (coordinates,
  measured sizes, progress widths, transforms, chart colors). Static visual decisions belong in
  CSS and tokens.
- No page-local `!important`, shared-component descendant overrides, or decorative canvas grids.
- Broad legacy selectors for inputs or buttons must exclude `[class*="tk-v1-"]`; a Design System
  component owns its own focus and interaction states.
- Any horizontally scrollable tab, navigation rail, or preview strip must declare `overflow-y`.
  Modal headers never scroll vertically; a single modal body owns vertical overflow.

## 4. Interaction and accessibility

- Every control has a programmatic label, visible focus state, keyboard path, and disabled/loading
  behavior where applicable.
- Shell navigation has at most two interactive levels. A first-level parent discloses but does not
  also navigate; optional second-level group headings are noninteractive. Hover must be paired
  with focus, click-to-pin, arrow-key traversal, Escape, and active-route semantics.
- Status is never communicated by color alone. Text contrast must meet WCAG 2.2 AA.
- Validate Light and Dark, long translated labels, 1280px width, 200% zoom, and reduced motion.
- Overlays close on Escape and restore focus. Tables scroll inside `TkTableFrame`, never through
  body-level horizontal overflow.

## 5. Required workflow

1. Reuse or extend a shared contract before editing a business page.
2. Add/update component tests and the Design Lab when a shared state changes.
3. Run `pnpm css:check`, `pnpm lint`, `pnpm test`, and `pnpm build` from `apps/panel` (or their
   workspace-filtered equivalents).
4. For visual changes, inspect representative Light and Dark screens. Review component families,
   not isolated pages, unless the information architecture or interaction model changes.

Temporary exceptions require a code comment explaining why the shared contract cannot represent
the case and a follow-up owner. An exception is not permission to add a parallel generic control.

The ownership map and migration policy are documented in `src/styles/README.md`.
