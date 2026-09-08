# Product filter interaction

- Opening the popover or typing only edits a draft. Search/Enter explicitly requests catalogs.
- The existing API has no product-name argument. Search downloads each authorized shop's complete
  catalog (one request per shop, provider pagination handled by the backend), then matches the
  submitted name substring or product ID locally. No first-page cap is treated as a complete catalog.
- All shops start concurrently with independent 0–150 ms startup jitter and no concurrency cap.
  A failed shop does not stop other shops. Pagination within a shop remains cursor-ordered.
- Completed shops are shown progressively. Loading displays completed/total shops; cancellation,
  errors and the 30-second per-shop timeout explicitly mark results as potentially incomplete.
  Retry starts a fresh search; selecting a single shop narrows the request scope.
- Scope changes/unmount cancel subscriptions and abort the HTTP request. This does not guarantee
  cancellation of provider work already running on the backend. Late responses cannot replace the
  new scope's results.
- Selection emits exact `(shopId, productId)` pairs, never the draft text. Consumers filter their
  own entity queries before pagination. Existing selections are not changed by searching.
