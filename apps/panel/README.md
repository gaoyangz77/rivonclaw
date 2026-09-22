# Panel

React SPA management UI served by the Desktop Electron app on a dynamic port.

The binding development rules are in [`AGENTS.md`](./AGENTS.md). The visual language, tokens,
component contracts, and migration ledger are in
[`src/components/design-system/README.md`](./src/components/design-system/README.md).
The CSS ownership layers, cascade manifests, and legacy migration policy are in
[`src/styles/README.md`](./src/styles/README.md).

## Development

```bash
pnpm dev    # Start Vite dev server with HMR
pnpm build  # Production build to dist/
pnpm lint   # Code, architecture, and CSS usage guards
pnpm css:check
pnpm test
```

## Manual Testing (Dev Mode)

### Campaign qualification funnel

Open an existing Campaign detail from **Affiliate → Campaigns**. The daily funnel shows
scan → qualification passed → scheduled → invitations sent. Qualification failures are an
always-visible branch, separate from duplicate/protection/cadence exclusions and Provider refusals.
The pass rate is `qualified / (qualified + qualificationFailed)`; pending evaluations and technical
retries are not inferred to be rejected. No completed decisions or legacy unrecorded outcomes
display `—`, not a fabricated 0%.

The mode description identifies the execution's current screening strategy. Daily counters can
include both strategies after a same-day mode switch, so metric labels remain mode-neutral and the
scope note explicitly disclaims exclusive AI attribution.

The separate `affiliateCampaignScreeningBreakdown` read query attributes today's latest per-Creator
rejections from stored decision evidence: AI requires AI_PRE_APPROVAL + OK + preApproved=false +
PRE_APPROVAL_REJECTED; explicit failed filters are other conditions; unknown historical decisions
remain unattributed. This is a unique-Creator snapshot, not the cumulative attempt counter; never
subtract it from `qualificationFailed` to invent an "other" count. Technical failures are excluded.
An unavailable breakdown displays `—` and an explicit message, never zero or a mode-based estimate.
Ship the Backend query and `campaign_creator_screening_day` index before releasing the Panel.

For visual QA, run `pnpm dev` from the repository root using an already signed-in account; inspect
both smart and Marketplace-rules Campaigns without editing their configuration. Check light/dark,
long translations, and zoomed layouts. `CampaignFunnel.test.tsx` covers rendering, denominator,
legacy/empty states, mode wording, and eight-language copy completeness.

The Panel exposes dev helpers on `window` when running in development mode (`import.meta.env.DEV`). These are stripped from production builds.

### Runtime Status

Simulate CS bridge connection states to test the global warning banner:

```js
// In browser DevTools console:

// Simulate disconnected state (shows warning banner)
__runtimeStatus.simulateCsBridge("disconnected");

// Simulate reconnecting with attempt count (shows banner with spinner)
__runtimeStatus.simulateCsBridge("reconnecting", 3);

// Restore connected state (hides banner)
__runtimeStatus.simulateCsBridge("connected");

// Inspect current store state
__runtimeStatus.store.csBridge.state;
__runtimeStatus.store.csBridge.reconnectAttempt;
```

**Prerequisites:** The warning banner only appears when the GLOBAL_ECOMMERCE_SELLER module is enrolled and at least one shop has CS enabled. If you don't see the banner after simulating, verify these conditions are met.

**Note:** The SSE connection to Desktop may overwrite simulated state if the Desktop-side bridge state changes. To keep the simulated state stable, you can disconnect the SSE first:

```js
// Disconnect SSE (prevents Desktop from overwriting simulated state)
// Reconnect by refreshing the page
```
