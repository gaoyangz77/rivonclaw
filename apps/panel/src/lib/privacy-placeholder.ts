/**
 * Stand-in for a sensitive value — a shop name, a product name, a seller SKU —
 * that lands in a slot typed as a plain `string` and therefore cannot carry the
 * `data-tk-private` marker that blurs the same value everywhere else.
 *
 * `TkConfirmDialog.message`, `Modal` titles, and composite labels such as
 * `SKU · ABC-123 +2` are all such slots. Substituting the noun hides it while
 * leaving the sentence around it readable, which blurring the whole string
 * would not.
 *
 * Only components wrapped in `observer()` may substitute: unlike the CSS-driven
 * blur, a substituted string is baked into the render and goes stale unless the
 * component re-renders when `privacyMode` flips.
 */
export const MASKED_NAME_PLACEHOLDER = "••••";
