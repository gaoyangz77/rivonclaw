# Panel

React SPA management UI served by the Desktop Electron app on a dynamic port.

## Development

```bash
pnpm dev    # Start Vite dev server with HMR
pnpm build  # Production build to dist/
```

## Manual Testing (Dev Mode)

The Panel exposes dev helpers on `window` when running in development mode (`import.meta.env.DEV`). These are stripped from production builds.

### Runtime Status

Simulate CS bridge connection states to test the global warning banner:

```js
// In browser DevTools console:

// Simulate disconnected state (shows warning banner)
__runtimeStatus.simulateCsBridge("disconnected")

// Simulate reconnecting with attempt count (shows banner with spinner)
__runtimeStatus.simulateCsBridge("reconnecting", 3)

// Restore connected state (hides banner)
__runtimeStatus.simulateCsBridge("connected")

// Inspect current store state
__runtimeStatus.store.csBridge.state
__runtimeStatus.store.csBridge.reconnectAttempt
```

**Prerequisites:** The warning banner only appears when the GLOBAL_ECOMMERCE_SELLER module is enrolled and at least one shop has CS enabled. If you don't see the banner after simulating, verify these conditions are met.

**Note:** The SSE connection to Desktop may overwrite simulated state if the Desktop-side bridge state changes. To keep the simulated state stable, you can disconnect the SSE first:

```js
// Disconnect SSE (prevents Desktop from overwriting simulated state)
// Reconnect by refreshing the page
```
