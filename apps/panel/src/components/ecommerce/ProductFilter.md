# Product filter interaction

- Opening the popover or typing only edits a draft. Search/Enter sends exactly one GraphQL request:
  `searchProductsForUser(keywordOrId)`. No user ID or shop IDs are accepted by this API.
- Backend authentication determines the user. The backend selects only that user's authorized shops,
  starts all shops concurrently with independent 0–150 ms jitter (no concurrency cap), consumes all
  provider pages per shop, and matches name substrings case-insensitively or product IDs.
- Only matching shop/product/title records cross the network. Duplicate product IDs across shops
  remain separate selection pairs. A selected shop in the UI only filters returned matches locally.
- One response contains products, totalShops and failedShopIds. The UI shows an indeterminate search
  indicator until it arrives, and explicitly warns when any shop failed. No fake per-shop progress,
  polling, per-shop retries, automatic search, or fallback to the old catalog API.
- Retry starts one fresh user-level request. Backend per-shop timeout is 30 seconds; frontend overall
  timeout is 45 seconds. These bound response waiting, not provider work already in flight.
- Scope changes/unmount cancel subscriptions and abort the HTTP request. This does not guarantee
  cancellation of provider work already running on the backend. Late responses cannot replace the
  new scope's results.
- Selection emits exact `(shopId, productId)` pairs, never the draft text. Consumers filter their
  own entity queries before pagination. Existing selections are not changed by searching.
