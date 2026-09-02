/**
 * Turns a raw tool identifier into the caption drawn over a character's head in
 * the pixel office, and into the read-vs-write classification that decides
 * whether that character reads or types.
 *
 * ## Why this lives in the Panel
 *
 * Desktop records the same tool events to ClickHouse so a session can be
 * replayed as video later, in any language. A caption resolved upstream of that
 * would bake one language into stored history, so `packages/pixel-agents-bridge`
 * stays language-free and Desktop keeps emitting raw identifiers. Translation
 * happens here, at the last possible moment, against the viewer's locale.
 *
 * ## Three tiers, because the tool set is not knowable at build time
 *
 * Cloud tools are declared in the backend and delivered to the client at
 * runtime through `rivonclaw_cloud_tools.reload`, so a shipped desktop build
 * WILL meet tool names it has never seen. A flat table alone would print the
 * identifier for those - 35 characters of snake_case over a pixel character.
 *
 *  1. Exact match on the delivered name, tried verbatim then uppercased, which
 *     covers both key conventions in one table (cloud tools arrive lowercased
 *     from `ToolId`, vendor system tools are lowercase already).
 *  2. A verb rule: strip the namespace prefix, branch on the first token. New
 *     tools follow the same naming conventions as the existing ones, so their
 *     verb is nearly always known even when their name is not.
 *  3. A generic caption. The identifier is never shown.
 *
 * ## One classification, used twice
 *
 * Each caption declares whether it is a read or a write. That single fact
 * answers both questions this module exists to answer: which sentence an
 * unmatched tool gets, and whether the renderer should play its reading
 * animation. There is no second list to keep in step.
 *
 * ## Run phases arrive here too
 *
 * Most of a run's wall clock is spent between its visible events, and the
 * renderer draws exactly one caption - the tool label. So the bridge sends the
 * phases worth reading as pseudo-tools named `phase:<status>`, and they land in
 * these same two functions. They are captioned from the office's own vocabulary
 * rather than the tool table: a phase is not a capability, it is what the
 * character is doing while it has no capability open.
 */

// From the scene contract, not the renderer bridge: the pseudo-tool convention
// is between whoever writes it and whoever captions it, and this module must
// keep working when the bridge is replaced.
import { PHASE_ACTIVITY_PREFIX } from "@rivonclaw/scene-contract";

/**
 * Whether a caption describes looking something up or changing something.
 *
 * `read` is what the renderer draws with its reading sprites; everything else
 * types. Ambiguous cases are deliberately classified `write`: typing is the
 * renderer's own default, so a wrong `write` looks unremarkable while a wrong
 * `read` shows a character reading a book while it deletes a record.
 */
export type ActivityKind = "read" | "write";

/**
 * Every caption the office can draw, with its kind.
 *
 * Keys are caption ids, not tool ids: several tools are the same act to a
 * viewer - `ecom_get_order` and `ecom_cs_get_order` are both someone reading an
 * order - and collapsing them here is what keeps the translated vocabulary at a
 * size eight locales can actually be held consistent at.
 */
export const ACTIVITY_CAPTION_KINDS = {
  // ── Orders and fulfillment ──
  readOrder: "read",
  listOrders: "read",
  readSalesStats: "read",
  readTracking: "read",
  searchPackages: "read",
  readPackage: "read",
  readShippingLabel: "read",
  // ── Products, stock and reporting ──
  readProduct: "read",
  searchProducts: "read",
  updateInventory: "write",
  readInventoryAnalysis: "read",
  readSkuPerformance: "read",
  readBiData: "read",
  // ── Shops ──
  listShops: "read",
  readShop: "read",
  updateShop: "write",
  updateCampaign: "write",
  // ── Customer conversations ──
  listConversations: "read",
  readConversation: "read",
  markConversationRead: "write",
  toggleConversationAi: "write",
  sendImage: "write",
  sendCard: "write",
  startSession: "write",
  endSession: "write",
  readCsPerformance: "read",
  searchCsSessions: "read",
  readUnpaidOrderCheck: "read",
  // ── Escalation ──
  escalate: "write",
  readEscalation: "read",
  answerEscalation: "write",
  resolveEscalation: "write",
  dismissEscalations: "write",
  // ── Returns, refunds and cancellations ──
  searchReturns: "read",
  searchCancellations: "read",
  readAftersaleEligibility: "read",
  readReturnRecords: "read",
  readRejectReasons: "read",
  approveReturn: "write",
  approveRefund: "write",
  rejectReturn: "write",
  approveCancellation: "write",
  rejectCancellation: "write",
  // ── Affiliate creators ──
  readCreatorProfile: "read",
  readCreatorRelationship: "read",
  readCreatorTimeline: "read",
  searchCreatorTags: "read",
  predictCreatorFit: "read",
  readCreatorContact: "read",
  updateCreatorContact: "write",
  listOutreachAccounts: "read",
  // ── Affiliate collaborations and work ──
  listCollaborations: "read",
  updateCollaboration: "write",
  readSampleRequests: "read",
  readAttachment: "read",
  copyAttachment: "write",
  uploadAttachment: "write",
  resolveWorkItem: "write",
  decideProposal: "write",
  // ── Vendor system tools ──
  readFile: "read",
  editFile: "write",
  runCommand: "write",
  manageSecrets: "write",
  searchWeb: "read",
  browseWeb: "read",
  readMemory: "read",
  readSessions: "read",
  coordinateAgents: "write",
  sendMessage: "write",
  controlDevice: "write",
  manageGateway: "write",
  scheduleTasks: "write",
  askUser: "write",
  viewImage: "read",
  makeMedia: "write",
  speak: "write",
  // ── Tier 2: one per verb group, for tools this build has never seen ──
  lookingUp: "read",
  listing: "read",
  searching: "read",
  analysing: "read",
  updating: "write",
  creating: "write",
  sending: "write",
  deciding: "write",
  removing: "write",
  running: "write",
  // ── Tier 3 ──
  working: "write",
} as const satisfies Record<string, ActivityKind>;

export type ActivityCaptionId = keyof typeof ACTIVITY_CAPTION_KINDS;

/** Shown when neither the tool nor its verb is recognised. */
export const GENERIC_ACTIVITY_CAPTION: ActivityCaptionId = "working";

/**
 * Tool identifier -> caption.
 *
 * Grouped and ordered to mirror `tools.selector.name` in the locale files, so
 * the two can be read side by side when a tool is added or retired. Entries
 * whose backend tool no longer exists are kept rather than pruned: they cost
 * nothing, and removing one only to have the name come back is worse than
 * carrying it.
 *
 * Keys are written in the source convention - UPPERCASE for cloud `ToolId`s,
 * lowercase for vendor system tools - and matched case-insensitively at lookup,
 * because the runtime name of a cloud tool is its `ToolId` lowercased.
 */
export const TOOL_ACTIVITY_CAPTIONS: Record<string, ActivityCaptionId> = {
  // ── E-commerce Ops: conversations ──
  ECOM_GET_CONVERSATIONS: "listConversations",
  ECOM_GET_PENDING_CONVERSATIONS: "listConversations",
  ECOM_GET_CONVERSATION_MESSAGES: "readConversation",
  ECOM_GET_CONVERSATION_DETAILS: "readConversation",
  ECOM_GET_CS_PERFORMANCE: "readCsPerformance",
  ECOM_GET_CS_UNPAID_ORDER_EVALUATION: "readUnpaidOrderCheck",
  ECOM_SEARCH_CS_SESSIONS: "searchCsSessions",
  ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED: "toggleConversationAi",
  ECOM_MARK_CONVERSATION_READ: "markConversationRead",
  ECOM_CREATE_CONVERSATION: "sendMessage",
  // ── E-commerce Ops: orders ──
  ECOM_GET_ORDER: "readOrder",
  ECOM_GET_ORDER_SALES_STATS: "readSalesStats",
  ECOM_LIST_ORDERS: "listOrders",
  ECOM_GET_SHOP_ORDER_SKU_EXPORT: "listOrders",
  // ── E-commerce Ops: fulfillment ──
  ECOM_GET_FULFILLMENT_TRACKING: "readTracking",
  ECOM_SEARCH_PACKAGES: "searchPackages",
  ECOM_GET_PACKAGE_DETAIL: "readPackage",
  ECOM_GET_SHIPPING_DOCUMENT: "readShippingLabel",
  // ── E-commerce Ops: products and stock ──
  ECOM_GET_PRODUCT: "readProduct",
  ECOM_SEARCH_PRODUCTS: "searchProducts",
  AFFILIATE_GET_PRODUCT: "readProduct",
  AFFILIATE_SEARCH_PRODUCTS: "searchProducts",
  AFFILIATE_LIST_SHOPS: "listShops",
  ECOM_GET_INVENTORY_ANALYSIS: "readInventoryAnalysis",
  ECOM_GET_SHOP_SKU_PERFORMANCE_LIST: "readSkuPerformance",
  ECOM_GET_OPERATION_REPORT: "readBiData",
  ECOM_GET_BI_CATALOG: "readBiData",
  ECOM_GET_BI_DATA: "readBiData",
  ECOM_UPDATE_INVENTORY: "updateInventory",
  // ── E-commerce Ops: shops ──
  ECOM_UPDATE_SHOP: "updateShop",
  ECOM_WRITE_AFFILIATE_CAMPAIGN: "updateCampaign",
  ECOM_LIST_SHOPS: "listShops",
  ECOM_GET_SHOP: "readShop",
  // ── E-commerce Ops: returns and refunds ──
  ECOM_SEARCH_RETURNS: "searchReturns",
  ECOM_SEARCH_CANCELLATIONS: "searchCancellations",
  ECOM_GET_AFTERSALE_ELIGIBILITY: "readAftersaleEligibility",
  ECOM_GET_RETURN_RECORDS: "readReturnRecords",
  ECOM_GET_REJECT_REASONS: "readRejectReasons",
  ECOM_APPROVE_RETURN: "approveReturn",
  ECOM_APPROVE_REFUND: "approveRefund",
  ECOM_REJECT_RETURN: "rejectReturn",
  ECOM_APPROVE_CANCELLATION: "approveCancellation",
  ECOM_REJECT_CANCELLATION: "rejectCancellation",
  // ── E-commerce CS: session-scoped ──
  ECOM_CS_SEND_MEDIA: "sendImage",
  ECOM_CS_SEND_CARD: "sendCard",
  ECOM_CS_GET_CONVERSATIONS: "listConversations",
  ECOM_CS_GET_CONVERSATION_MESSAGES: "readConversation",
  ECOM_CS_GET_CONVERSATION_DETAILS: "readConversation",
  ECOM_CS_GET_ORDER: "readOrder",
  ECOM_CS_LIST_ORDERS: "listOrders",
  ECOM_CS_GET_FULFILLMENT_TRACKING: "readTracking",
  ECOM_CS_SEARCH_PACKAGES: "searchPackages",
  ECOM_CS_GET_PACKAGE_DETAIL: "readPackage",
  ECOM_CS_GET_SHIPPING_DOCUMENT: "readShippingLabel",
  ECOM_CS_GET_PRODUCT: "readProduct",
  ECOM_CS_SEARCH_PRODUCTS: "searchProducts",
  ECOM_CS_CREATE_CONVERSATION: "sendMessage",
  ECOM_CS_END_SESSION: "endSession",
  // ── E-commerce CS: returns and refunds ──
  ECOM_CS_SEARCH_RETURNS: "searchReturns",
  ECOM_CS_SEARCH_CANCELLATIONS: "searchCancellations",
  ECOM_CS_GET_AFTERSALE_ELIGIBILITY: "readAftersaleEligibility",
  ECOM_CS_GET_RETURN_RECORDS: "readReturnRecords",
  ECOM_CS_GET_REJECT_REASONS: "readRejectReasons",
  ECOM_CS_APPROVE_RETURN: "approveReturn",
  ECOM_CS_APPROVE_REFUND: "approveRefund",
  ECOM_CS_REJECT_RETURN: "rejectReturn",
  ECOM_CS_APPROVE_CANCELLATION: "approveCancellation",
  ECOM_CS_REJECT_CANCELLATION: "rejectCancellation",
  // ── E-commerce CS: escalation ──
  CS_ESCALATE: "escalate",
  CS_DISMISS_CONVERSATION_ESCALATIONS: "dismissEscalations",
  CS_RESPOND: "answerEscalation",
  CS_GET_ESCALATION_RESULT: "readEscalation",
  CS_START_SESSION: "startSession",
  // ── Affiliate: creators ──
  AFFILIATE_GET_CREATOR_RELATIONSHIP: "readCreatorRelationship",
  AFFILIATE_GET_CREATOR_PROFILE: "readCreatorProfile",
  AFFILIATE_GET_RELATIONSHIP_TIMELINE: "readCreatorTimeline",
  AFFILIATE_SEARCH_MANUAL_TAGS: "searchCreatorTags",
  AFFILIATE_PREDICT_CREATOR_PRODUCT_FIT: "predictCreatorFit",
  AFFILIATE_GET_CREATOR_CONTACT_STATE: "readCreatorContact",
  AFFILIATE_CHECK_CREATOR_WHATSAPP: "readCreatorContact",
  AFFILIATE_SET_CREATOR_WHATSAPP: "updateCreatorContact",
  AFFILIATE_SET_CREATOR_EMAIL: "updateCreatorContact",
  AFFILIATE_LIST_WHATSAPP_ACCOUNTS: "listOutreachAccounts",
  AFFILIATE_LIST_EMAIL_ACCOUNTS: "listOutreachAccounts",
  // ── Affiliate: collaborations and samples ──
  AFFILIATE_LIST_OPEN_COLLABORATIONS: "listCollaborations",
  AFFILIATE_LIST_SHOP_OPEN_COLLABORATIONS: "listCollaborations",
  AFFILIATE_LIST_SHOP_TARGET_COLLABORATIONS: "listCollaborations",
  AFFILIATE_LIST_CREATOR_COLLABORATIONS: "listCollaborations",
  AFFILIATE_MANAGE_OPEN_COLLABORATION: "updateCollaboration",
  AFFILIATE_MANAGE_TARGET_COLLABORATION: "updateCollaboration",
  AFFILIATE_GET_SAMPLE_APPLICATION: "readSampleRequests",
  AFFILIATE_LIST_CREATOR_SAMPLE_APPLICATIONS: "readSampleRequests",
  // ── Affiliate: messages and work ──
  AFFILIATE_READ_MESSAGE_ATTACHMENT: "readAttachment",
  AFFILIATE_COPY_MESSAGE_ATTACHMENT: "copyAttachment",
  AFFILIATE_UPLOAD_DRAFT_ATTACHMENT: "uploadAttachment",
  AFFILIATE_RESOLVE_WORK_ITEM: "resolveWorkItem",
  AFFILIATE_ESCALATE: "escalate",
  AFFILIATE_RESOLVE: "resolveEscalation",
  AFFILIATE_DECIDE_PROPOSAL: "decideProposal",
  // ── System tools: files ──
  read: "readFile",
  write: "editFile",
  edit: "editFile",
  apply_patch: "editFile",
  // ── System tools: runtime ──
  exec: "runCommand",
  process: "runCommand",
  code_execution: "runCommand",
  terminal: "runCommand",
  secrets: "manageSecrets",
  // ── System tools: web ──
  web_search: "searchWeb",
  x_search: "searchWeb",
  web_fetch: "browseWeb",
  browser: "browseWeb",
  // ── System tools: memory ──
  memory_search: "readMemory",
  memory_get: "readMemory",
  // ── System tools: sessions and agents ──
  sessions_list: "readSessions",
  sessions_history: "readSessions",
  sessions_search: "readSessions",
  session_status: "readSessions",
  agents_list: "readSessions",
  sessions: "coordinateAgents",
  sessions_send: "coordinateAgents",
  sessions_spawn: "coordinateAgents",
  sessions_yield: "coordinateAgents",
  agents_wait: "coordinateAgents",
  subagents: "coordinateAgents",
  // ── System tools: messaging ──
  message: "sendMessage",
  conversations_list: "listConversations",
  conversations_send: "sendMessage",
  conversations_turn: "sendMessage",
  ask_user: "askUser",
  // ── System tools: devices and infrastructure ──
  screen: "controlDevice",
  computer: "controlDevice",
  mobile_ui: "controlDevice",
  gateway: "manageGateway",
  portal: "manageGateway",
  nodes: "manageGateway",
  automations: "scheduleTasks",
  cron: "scheduleTasks",
  // ── System tools: session chrome ──
  dashboard: "updating",
  canvas: "updating",
  show_widget: "updating",
  progress_card: "updating",
  heartbeat_respond: "updating",
  suggest_task: "updating",
  dismiss_task: "updating",
  skill_workshop: "updating",
  github_publish: "updating",
  github_identity_status: "lookingUp",
  get_goal: "lookingUp",
  create_goal: "updating",
  update_goal: "updating",
  // ── System tools: media ──
  view_image: "viewImage",
  // The catalog renamed this to `view_image`; the old name is still in the tool
  // picker's vocabulary, so it stays here too rather than falling to tier 2.
  image: "viewImage",
  image_generate: "makeMedia",
  music_generate: "makeMedia",
  video_generate: "makeMedia",
  tts: "speak",
};

/**
 * First token after the namespace prefix -> caption, for unrecognised tools.
 *
 * This is the whole of tier 2, and the reason a tool shipped after this build
 * still says something true over a character's head. Verbs are grouped rather
 * than captioned individually: the caption has to fit above a 16-pixel sprite,
 * so "Looking something up" is as specific as an unknown tool can honestly be.
 */
export const VERB_ACTIVITY_CAPTIONS: Record<string, ActivityCaptionId> = {
  // Reads
  get: "lookingUp",
  read: "lookingUp",
  fetch: "lookingUp",
  view: "lookingUp",
  load: "lookingUp",
  describe: "lookingUp",
  inspect: "lookingUp",
  preview: "lookingUp",
  check: "lookingUp",
  status: "lookingUp",
  list: "listing",
  count: "listing",
  search: "searching",
  find: "searching",
  query: "searching",
  lookup: "searching",
  analyze: "analysing",
  analyse: "analysing",
  evaluate: "analysing",
  calculate: "analysing",
  compute: "analysing",
  predict: "analysing",
  forecast: "analysing",
  // Writes
  set: "updating",
  update: "updating",
  write: "updating",
  edit: "updating",
  save: "updating",
  patch: "updating",
  apply: "updating",
  mark: "updating",
  sync: "updating",
  refresh: "updating",
  upload: "updating",
  copy: "updating",
  move: "updating",
  import: "updating",
  export: "updating",
  enable: "updating",
  disable: "updating",
  assign: "updating",
  manage: "updating",
  create: "creating",
  add: "creating",
  make: "creating",
  build: "creating",
  generate: "creating",
  spawn: "creating",
  schedule: "creating",
  start: "creating",
  open: "creating",
  submit: "creating",
  publish: "creating",
  post: "creating",
  draft: "creating",
  send: "sending",
  notify: "sending",
  reply: "sending",
  respond: "sending",
  ask: "sending",
  request: "sending",
  message: "sending",
  approve: "deciding",
  reject: "deciding",
  decide: "deciding",
  resolve: "deciding",
  escalate: "deciding",
  confirm: "deciding",
  review: "deciding",
  remove: "removing",
  delete: "removing",
  clear: "removing",
  dismiss: "removing",
  cancel: "removing",
  close: "removing",
  end: "removing",
  stop: "removing",
  run: "running",
  exec: "running",
  execute: "running",
  invoke: "running",
  retry: "running",
  restart: "running",
  install: "running",
};

/**
 * Namespace prefixes stripped before the verb is read.
 *
 * Longest first: `ecom_cs_get_order` must lose `ecom_cs_`, not `ecom_`, or its
 * verb reads as `cs`.
 */
const NAMESPACE_PREFIXES = ["ecom_cs_", "affiliate_", "ecom_", "cs_"] as const;

function verbOf(toolName: string): string {
  let rest = toolName.toLowerCase();
  for (const prefix of NAMESPACE_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }
  return rest.split(/[_.:\-\s]/)[0] ?? "";
}

/**
 * Run phases the office captions, with the pose each one plays.
 *
 * `thinking` is the only one that reads. It is the phase with genuinely nothing
 * on screen to look at - the model has been started and nothing has come back -
 * so the reading pose is the one that says "something is happening here". The
 * rest are moments of doing rather than considering, and the renderer's default
 * typing animation is what they should look like.
 *
 * Written as this module's own kind so the two classifications - phase and tool
 * - stay one vocabulary and one answer to "does this character read or type".
 */
export const PHASE_ACTIVITY_KINDS = {
  arriving: "write",
  preparing: "write",
  thinking: "read",
  // The catch-all: the run is going and this build cannot name what it is doing
  // any more precisely. Typing, because a character with no caption at all is
  // drawn as idle by the renderer, and busy-looking is the honest reading.
  working: "write",
  replying: "write",
  // How the run ended. One id per outcome rather than one `leaving` caption
  // with a modifier, because the office has a single caption slot and the
  // difference between finishing and failing is the whole of what a viewer
  // wants from the last frame.
  "leaving-success": "write",
  "leaving-failure": "write",
  "leaving-aborted": "write",
  "leaving-reclaimed": "write",
} as const satisfies Record<string, ActivityKind>;

export type PhaseCaptionId = keyof typeof PHASE_ACTIVITY_KINDS;

/**
 * The phase a pseudo-tool names, or null for a real tool.
 *
 * A phase the bridge starts sending that this build does not know falls through
 * to the tool tiers, which caption it generically rather than printing it - the
 * same guarantee an unknown tool gets.
 */
function phaseOf(rawToolName: string | null | undefined): PhaseCaptionId | null {
  if (typeof rawToolName !== "string") return null;
  const trimmed = rawToolName.trim();
  if (!trimmed.startsWith(PHASE_ACTIVITY_PREFIX)) return null;
  const phase = trimmed.slice(PHASE_ACTIVITY_PREFIX.length);
  return phase in PHASE_ACTIVITY_KINDS ? (phase as PhaseCaptionId) : null;
}

/**
 * Caption for a tool, by the three tiers described at the top of this file.
 *
 * Total: an absent, blank or wholly unrecognised name still yields a caption,
 * which is what guarantees no identifier reaches the screen.
 */
export function activityCaptionId(
  rawToolName: string | null | undefined,
): ActivityCaptionId {
  if (typeof rawToolName !== "string") return GENERIC_ACTIVITY_CAPTION;
  const trimmed = rawToolName.trim();
  if (trimmed === "") return GENERIC_ACTIVITY_CAPTION;

  const exact =
    TOOL_ACTIVITY_CAPTIONS[trimmed] ?? TOOL_ACTIVITY_CAPTIONS[trimmed.toUpperCase()];
  if (exact) return exact;

  return VERB_ACTIVITY_CAPTIONS[verbOf(trimmed)] ?? GENERIC_ACTIVITY_CAPTION;
}

/** i18n key for a tool's - or a run phase's - office caption. */
export function activityCaptionKey(rawToolName: string | null | undefined): string {
  const phase = phaseOf(rawToolName);
  if (phase) return `office.phase.${phase}`;
  return `tools.activity.${activityCaptionId(rawToolName)}`;
}

/**
 * Whether the office should play the reading animation for this tool.
 *
 * Derived from the caption, so a tool that says it is reading something also
 * looks like it. Passed to the bridge as a predicate rather than a list because
 * the callable tool set arrives at runtime: a name this build has never seen is
 * still classified the moment it runs.
 */
export function isReadingTool(rawToolName: string | null | undefined): boolean {
  const phase = phaseOf(rawToolName);
  if (phase) return PHASE_ACTIVITY_KINDS[phase] === "read";
  return ACTIVITY_CAPTION_KINDS[activityCaptionId(rawToolName)] === "read";
}
