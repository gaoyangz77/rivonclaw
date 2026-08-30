# Panel CSS ownership

Panel CSS is organized by ownership, not by visual coincidence. A table frame belongs to the
Design System; a campaign conversion column belongs to the campaign feature even though both render
inside a table.

## Cascade entry points

- `../styles.css` is the application compatibility manifest. It imports the mechanically migrated
  foundation, component, and feature files in their pre-migration cascade order.
- `../components/design-system/tk-v1.css` is the Design System manifest. Its responsibility files
  live in `../components/design-system/styles/`.
- Both manifests are import-only. New product CSS is imported by the component that owns it rather
  than appended to either manifest.

The compatibility manifest deliberately preserves the old cascade while ownership is made
explicit. This avoids turning a file-organization refactor into an uncontrolled visual redesign.
Vite still produces optimized CSS for production.

## Ownership layers

1. `foundation.css` owns reset, root typography, base elements, and global accessibility behavior.
2. `components/design-system/styles/` owns reusable component contracts and semantic tokens.
3. Shared application chrome belongs beside its component or provider, such as `layout/Layout.css`,
   `components/Toast.css`, and `components/modals/ModalLegacy.css`.
4. Business composition belongs under the owning `pages/<feature>/` directory. Cross-feature reuse
   is promoted to `components/` or the Design System before a second copy is introduced.

## Legacy policy

`legacy-shared.css`, `legacy-utilities.css`, `legacy-dark.css`, and files containing `Legacy` are
compatibility bridges, not destinations. Do not add rules to them. When touching a rule:

1. identify the rendered component and its semantic responsibility;
2. move shared behavior into the relevant Design System responsibility file;
3. otherwise move it to a prefixed stylesheet beside the owning component;
4. preserve Light/Dark and responsive states with the rule;
5. run `pnpm css:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

Architecture checks keep both manifests declaration-free and reject any CSS file over 4,500 lines.
`pnpm css:check` also walks the complete TS/TSX-to-CSS import graph: every local import must resolve,
cycles are rejected, and every CSS file must be reachable from a real application entry. Together
with the selector-usage check, this catches both abandoned rules and migration files that exist on
disk but are no longer loaded. The size ceiling only prevents another monolith; normal component
stylesheets should remain much smaller.
