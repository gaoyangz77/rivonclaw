/**
 * Convert a raw WeChat accountId (as returned by the OpenClaw weixin plugin's
 * `loginWithQrWait`) to the canonical dash form used by the plugin internally
 * and by the gateway's `channels.status` RPC.
 *
 *   "xxxx@im.bot"     → "xxxx-im-bot"
 *   "xxxx@im.wechat"  → "xxxx-im-wechat"
 *   "xxxx-im-bot"     → "xxxx-im-bot"    (already canonical; returned as-is)
 *   anything else     → returned unchanged
 *
 * Mirrors `normalizeAccountId` in openclaw/plugin-sdk/account-id so our stored
 * identifiers align with the plugin's internal + session-key forms. Storing
 * the canonical dash form everywhere removes the need for any comparison-time
 * normalization on read paths (status merge, allowlist lookup, etc.).
 */
export function normalizeWeixinAccountId(id: string): string {
  if (id.endsWith("@im.bot")) {
    return id.slice(0, -"@im.bot".length) + "-im-bot";
  }
  if (id.endsWith("@im.wechat")) {
    return id.slice(0, -"@im.wechat".length) + "-im-wechat";
  }
  return id;
}
