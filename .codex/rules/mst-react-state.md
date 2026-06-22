# GraphQL / MST / React State Rules

These rules are mandatory when changing Panel or Desktop code that reads GraphQL data through MobX-State-Tree and renders it in React.

## Core Rule

MST nodes are live tree objects, not durable DTOs. Any `applySnapshot(array, newList)`, direct model replacement, `null` assignment, delete, disconnect, or logout can destroy the previous child nodes. React code must assume old MST nodes can die immediately after a store replace.

For business state that has an authoritative copy in the database, Desktop store, or Panel entity/runtime store, MST is the source of truth. React must not become a second business-state store. Components may hold ids/keys, UI open/closed flags, loading flags, and short-lived primitive drafts, but persisted values must be read from MST and written through MST store/model actions.

## React State And Lifetime

- Store only entity ids, primitive values, or plain snapshots in React state. Do not store MST model instances in `useState`.
- Modal, drawer, checkout, pending, selected-row, detail, and confirmation state must not hold long-lived MST instances such as `Payment`, `Shop`, `BillingOverview` rows, entitlement rows, or generated model rows. Hold the id/key plus primitive display fields if needed.
- `useRef` must not keep MST nodes across renders or async work.
- Component props may pass MST nodes for synchronous render. The receiving component must not put that node into state, refs, timers, event handlers, or long-lived memoized objects.
- If a component needs a selected entity after a store refresh, keep `selectedId` and look up the current node from the store during render or immediately before the synchronous action.
- Complex/stateful business components such as billing sections, shop drawers, checkout modals, channel/account tables, inventory tools, and settings panels should read their authoritative data from `useEntityStore()`/runtime MST directly or receive only ids/primitive DTOs. Avoid passing long-lived MST nodes through multiple component layers.
- Primitive draft state is acceptable for unsaved form input, but it must be named and treated as a draft. On save, re-read the current MST node by id and call its MST action; do not save through a captured node.

## Async And Event Boundaries

- Async callbacks, `setTimeout`, `setInterval`, event listeners, `panelEventBus` handlers, SSE handlers, and Promise `then`/`catch`/`finally` callbacks must not close over MST nodes.
- Capture ids and primitive values before crossing an async/event boundary. When the callback runs, re-read the current node from the store by id if a live node is still needed.
- If code reads a node before `await`, do not read that same node again after `await`. Save primitive fields first or re-lookup by id after the await.

## Memoization

- Do not use MST observable array/object references as content-change dependencies, for example `useMemo(..., [shops])`, `useMemo(..., [payments])`, or `useMemo(..., [entityStore.someArray])`, when the memo result contains entity data.
- Do not memoize derived arrays/objects that contain MST nodes unless dependencies are explicit primitive signatures and the memo cannot outlive node replacement.
- Prefer direct render-local computation for cheap derived data such as grouping, filtering, sorting, labels, and option lists.
- If performance requires caching, cache plain snapshots or primitive DTOs, not MST nodes.

## GraphQL And MST Consistency

- GraphQL query or mutation success that the current Panel UI depends on must ingest or replace the local Panel store in the current store action. Do not rely only on Desktop proxy ingestion followed by SSE patches to update visible Panel state.
- MST models must match GraphQL codegen semantics for nullable fields, enums, and arrays. Optional backend nullable fields should be represented with `types.maybeNull` when the UI can receive `null`.
- Keep `packages/core/src/models/type-guards.ts` updated so model snapshots continue to compile against `packages/core/src/generated/graphql.ts`.

## Replace/Delete Flows

- `applySnapshot(array, newList)` kills old child nodes. UI code must not keep references to array children across the replace.
- Delete, disconnect, remove, logout, and clear flows must also clear any related selected id, modal id, active checkout id, pending confirmation id, and local draft that points at removed data.
- After destructive or disconnect flows, refresh through the authoritative query or store action so the UI uses current store nodes.

## Known Dead-Node Patterns To Avoid

- `useState<Payment | null>`, `useState<Shop | null>`, `useState<BillingEntitlementStatus | null>`, or equivalent model-instance state.
- `useRef<Payment | Shop | Model>(...)`.
- `useMemo(() => shops.map(...), [shops])` or `useMemo(() => groupShopsByCollection(shops), [shops])` when the result holds shop nodes.
- Async code like `const payment = entityStore.activeCheckout; await ...; payment.lastProviderEventAt`.
- Timer/event/SSE callbacks that read `shop.services`, `payment.status`, or `billingOverview.shops` from a captured node.
