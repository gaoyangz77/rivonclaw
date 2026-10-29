# Human reply translation

`POST /api/messaging/translate` prepares a translation only. It uses Desktop's current default model through the structured one-shot runner (no tools, no delivery), with at most one format repair. It never reads business history or sends messages.

Panel supplies only the currently loaded, route-matched inbound text (latest five, at most 4,000 characters). A cache hit supplies only its target language and original draft. Site language is the fallback when evidence is absent or inconclusive. Email subjects and attachments are not translated.

Panel's shared MST model keeps language decisions in volatile memory, scoped by signed-in actor, business conversation and outbound route. Logout/account switches clear the cache. Site fallbacks are reconsidered when the loaded inbound evidence changes. Preview drafts are unsaved UI state; cancellation preserves the original composer. Sending requires explicit confirmation and uses existing business delivery paths. Translation failures never fall through to sending the original text.

No backend schema, database changes, historical fetching, or Performance hydration are required.
