import { useState } from "react";
import {
  AccountIcon,
  AdsIcon,
  BillingIcon,
  ChannelsIcon,
  ChatIcon,
  CheckIcon,
  CronsIcon,
  EcommerceIcon,
  ExtrasIcon,
  InfoIcon,
  ModuleIcon,
  ProvidersIcon,
  RefreshIcon,
  SettingsIcon,
  ShopIcon,
  UsageIcon,
} from "../../components/icons.js";
import {
  TkAlert,
  TkBadge,
  TkButton,
  TkChoiceSelect,
  TkComposer,
  TkEmptyState,
  TkField,
  TkMetric,
  TkLoadingState,
  TkIconButton,
  TkHierarchicalNav,
  TkMenu,
  TkModal,
  TkPopover,
  TkSection,
  TkSegmented,
  TkStatus,
  TkSwitch,
  TkInteractiveTableRow,
  TkTableFrame,
  TkTabs,
  type TkHierarchicalNavItem,
} from "../../components/design-system/index.js";
import "./DesignSystemPage.css";

const TAB_ITEMS = [
  { id: "attention", label: "Needs attention", count: 8 },
  { id: "running", label: "Running", count: 3 },
  { id: "complete", label: "Complete", count: 24 },
];

const WORK_ITEMS = [
  {
    creator: "@studio.mika",
    task: "Approve sample request",
    value: "$8.4k",
    status: "Needs review",
    tone: "warning" as const,
  },
  {
    creator: "@northcraft.co",
    task: "Send collaboration brief",
    value: "$5.1k",
    status: "Agent drafting",
    tone: "accent" as const,
  },
  {
    creator: "@everyday.ritual",
    task: "Confirm delivered content",
    value: "$3.7k",
    status: "Ready",
    tone: "success" as const,
  },
];

const HIERARCHICAL_NAV_ITEMS: readonly TkHierarchicalNavItem[] = [
  { id: "/", label: "对话", icon: <ChatIcon /> },
  {
    id: "shop",
    label: "店铺",
    icon: <ShopIcon />,
    flyoutEyebrow: "COMMERCE",
    description: "授权店铺、经营概览与渠道健康度。",
    children: [
      { id: "/commerce/shops", label: "店铺管理", description: "授权、状态与店铺配置" },
      {
        id: "/commerce/shop-analytics",
        label: "店铺分析",
        description: "经营指标与增长变化",
      },
    ],
  },
  {
    id: "customer-service",
    label: "客服",
    icon: <ChannelsIcon />,
    flyoutEyebrow: "SERVICE",
    description: "会话处理、升级协同与服务质量。",
    children: [
      { id: "/commerce/customer-service/conversations", label: "客服对话" },
      { id: "/commerce/customer-service/escalations", label: "客服升级" },
      { id: "/commerce/customer-service/performance", label: "客服绩效" },
      { id: "/commerce/customer-service/experiments", label: "实验分析" },
    ],
  },
  {
    id: "affiliate",
    label: "达人联盟",
    icon: <EcommerceIcon />,
    flyoutEyebrow: "AFFILIATE",
    description: "推广执行、关系资产与增长洞察。",
    children: [
      { id: "/commerce/affiliate/campaigns", label: "推广计划", group: "执行" },
      { id: "/commerce/affiliate/attention", label: "工作台", group: "执行" },
      { id: "/commerce/affiliate/team", label: "团队与渠道", group: "执行" },
      { id: "/commerce/product-knowledge", label: "产品知识", group: "资产" },
      { id: "/commerce/affiliate/creators", label: "合作达人", group: "资产" },
      { id: "/commerce/affiliate/history", label: "平台合作", group: "资产" },
      { id: "/commerce/affiliate/analytics", label: "数据分析", group: "洞察" },
      { id: "/commerce/affiliate/intelligence", label: "智能分析", group: "洞察" },
    ],
  },
  { id: "/commerce/ads", label: "广告", icon: <AdsIcon /> },
  { id: "/commerce/inventory", label: "库存", icon: <ModuleIcon /> },
  { id: "/automation/crons", label: "定时任务", icon: <CronsIcon /> },
  { id: "/connections/channels", label: "渠道", icon: <ChannelsIcon /> },
  { id: "/connections/models", label: "模型", icon: <ProvidersIcon /> },
  {
    id: "extensions",
    label: "扩展",
    icon: <ExtrasIcon />,
    flyoutEyebrow: "EXTENSIONS",
    children: [
      { id: "/automation/skills", label: "技能" },
      { id: "/connections/extensions", label: "插件" },
    ],
  },
  { id: "/account/usage", label: "用量", icon: <UsageIcon /> },
  { id: "/account/billing", label: "账单", icon: <BillingIcon /> },
  { id: "/account/settings", label: "设置", icon: <SettingsIcon /> },
  { id: "/account/profile", label: "账户", icon: <AccountIcon /> },
];

function findNavigationLabel(value: string) {
  for (const item of HIERARCHICAL_NAV_ITEMS) {
    if (item.id === value) return item.label;
    const child = item.children?.find((candidate) => candidate.id === value);
    if (child) return child.label;
  }
  return "工作台";
}

const COMPONENT_CONTRACTS = [
  {
    component: "Button",
    states: "Rest · hover · focus · pressed · disabled · loading",
    contract: "Width is stable while async",
  },
  {
    component: "Field",
    states: "Rest · focus · disabled · invalid",
    contract: "Hint and error keep a stable support row",
  },
  {
    component: "Choice select",
    states: "Default · compact · ghost · focus · open",
    contract: "Portal menu follows its owning overlay layer",
  },
  {
    component: "Composer",
    states: "Rest · focus · disabled · submitting",
    contract: "Input and send action share one focus boundary",
  },
  {
    component: "Switch",
    states: "Off · on · focus · disabled",
    contract: "Label and description form one target",
  },
  {
    component: "Tabs",
    states: "Rest · hover · selected · focus · keyboard",
    contract: "Line/rail tabs navigate; segmented controls select a mode",
  },
  {
    component: "Hierarchical navigation",
    states: "Rest · hover intent · focus · pinned · current · collapsed",
    contract: "Two levels only; hover, click and keyboard expose the same routes",
  },
  {
    component: "Interactive table row",
    states: "Rest · hover · focus · pressed · nested control",
    contract: "Click, Enter and Space activate; nested controls never activate the row",
  },
  {
    component: "Feedback state",
    states: "Info · warning · danger · loading · empty",
    contract: "Announcements and geometry stay consistent",
  },
  {
    component: "Section",
    states: "Open · framed · raised",
    contract: "Static sections never lift on hover",
  },
  {
    component: "Popover",
    states: "Closed · open · flipped · constrained",
    contract: "Portal position survives clipping and scroll",
  },
  {
    component: "Menu",
    states: "Open · hover · focus · disabled · danger",
    contract: "Arrow keys move; selection returns focus",
  },
  {
    component: "Modal",
    states: "Open · focus trap · Escape · backdrop",
    contract: "Only L3 may interrupt shell and page",
  },
];

export function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState("attention");
  const [assignment, setAssignment] = useState("agent");
  const [agentEvents, setAgentEvents] = useState(true);
  const [compactRows, setCompactRows] = useState(false);
  const [composerDraft, setComposerDraft] = useState("A concise customer reply.");
  const [modalOpen, setModalOpen] = useState(false);
  const [navMode, setNavMode] = useState("expanded");
  const [navValue, setNavValue] = useState("/commerce/affiliate/attention");

  return (
    <div className="tk-design-lab">
      <header className="tk-design-lab-hero">
        <div className="tk-design-lab-eyebrow">
          <span className="tk-design-lab-live-dot" />
          TK SYSTEM / V1 · FOLLOWS PANEL THEME
        </div>
        <div className="tk-design-lab-hero-grid">
          <div>
            <h1>Precision Intelligence</h1>
            <p>
              精密纵深，而不是纯扁平。稳定的内容层、带光学高光的交互层，以及只在 AI
              运行状态出现的信号层。
            </p>
          </div>
          <dl className="tk-design-lab-meta">
            <div>
              <dt>Visual grammar</dt>
              <dd>Refined Optical Depth</dd>
            </div>
            <div>
              <dt>Density</dt>
              <dd>Desktop operational</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Adopted · staged rollout</dd>
            </div>
          </dl>
        </div>
        <div className="tk-design-lab-signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>

      <nav className="tk-design-lab-section-nav" aria-label="Design Lab page sections">
        <span>PAGE SECTIONS</span>
        <a href="#direction">01 Direction</a>
        <a href="#foundation">02 Foundation</a>
        <a href="#components">03 Components</a>
        <a href="#navigation">04 Navigation</a>
        <a href="#pattern">05 Pattern</a>
        <a href="#rules">06 Rules</a>
      </nav>

      <div className="tk-design-lab-layout">
        <div className="tk-design-lab-content">
          <section id="direction" className="tk-design-lab-block">
            <div className="tk-design-lab-block-heading">
              <span>01</span>
              <div>
                <h2>Depth with responsibility</h2>
                <p>每一层都回答一个交互问题，而不是单纯为了“看起来高级”。</p>
              </div>
            </div>

            <div className="tk-design-lab-reference-plane">
              <div className="tk-design-lab-reference-label">
                <span>LOCAL REFERENCE PLANE</span>
                <span>Design Lab specimen · not the product canvas</span>
              </div>
              <div className="tk-design-lab-layer-grid">
                <article className="tk-design-lab-layer tk-design-lab-layer-canvas">
                  <span>L0</span>
                  <strong>Canvas</strong>
                  <p>稳定、无阴影，承载长时间工作的主画布。</p>
                </article>
                <article className="tk-design-lab-layer tk-design-lab-layer-surface">
                  <span>L1</span>
                  <strong>Optical surface</strong>
                  <p>轻微纵向渐变和顶部高光，用于可交互内容。</p>
                </article>
                <article className="tk-design-lab-layer tk-design-lab-layer-raised">
                  <span>L2</span>
                  <strong>Raised control</strong>
                  <p>菜单、命令栏、拖拽对象拥有明确阴影。</p>
                </article>
                <article className="tk-design-lab-layer tk-design-lab-layer-signal">
                  <span>S</span>
                  <strong>Agent signal</strong>
                  <p>渐变、光和运动只用于状态与关键操作。</p>
                </article>
              </div>
            </div>
          </section>

          <section id="foundation" className="tk-design-lab-block">
            <div className="tk-design-lab-block-heading">
              <span>02</span>
              <div>
                <h2>Foundation</h2>
                <p>字体、颜色、间距和几何全部来自共享 token。</p>
              </div>
            </div>

            <div className="tk-design-lab-foundation-grid">
              <TkSection
                title="Semantic color"
                description="Roles change with Light and Dark."
                variant="framed"
              >
                <div className="tk-design-lab-swatches">
                  <div className="tk-design-lab-swatch tk-design-lab-swatch-canvas">
                    <span />
                    <strong>Canvas</strong>
                    <code>bg.canvas</code>
                  </div>
                  <div className="tk-design-lab-swatch tk-design-lab-swatch-surface">
                    <span />
                    <strong>Surface</strong>
                    <code>bg.surface</code>
                  </div>
                  <div className="tk-design-lab-swatch tk-design-lab-swatch-raised">
                    <span />
                    <strong>Raised</strong>
                    <code>bg.raised</code>
                  </div>
                  <div className="tk-design-lab-swatch tk-design-lab-swatch-accent">
                    <span />
                    <strong>Signal</strong>
                    <code>accent.default</code>
                  </div>
                </div>
              </TkSection>

              <TkSection
                title="Typography"
                description="IBM Plex Sans + JetBrains Mono."
                variant="framed"
              >
                <div className="tk-design-lab-type-stack">
                  <div className="tk-design-lab-type-title">Operational clarity</div>
                  <div className="tk-design-lab-type-body">
                    Agent work should remain readable under high information density.
                  </div>
                  <div className="tk-design-lab-type-mono">RUN_0841 · 18.4% · 06:42:18</div>
                </div>
              </TkSection>

              <TkSection
                title="Geometry"
                description="A 4px grid with restrained radii."
                variant="framed"
              >
                <div className="tk-design-lab-geometry">
                  <div className="tk-design-lab-radius tk-design-lab-radius-2">2</div>
                  <div className="tk-design-lab-radius tk-design-lab-radius-4">4</div>
                  <div className="tk-design-lab-radius tk-design-lab-radius-6">6</div>
                  <div className="tk-design-lab-radius tk-design-lab-radius-8">8</div>
                  <div className="tk-design-lab-radius tk-design-lab-radius-12">12</div>
                  <div className="tk-design-lab-spacing-track">
                    <span>4</span>
                    <span>8</span>
                    <span>12</span>
                    <span>16</span>
                    <span>24</span>
                  </div>
                </div>
              </TkSection>

              <TkSection
                title="System status"
                description="Color never works alone."
                variant="framed"
              >
                <div className="tk-design-lab-badge-row">
                  <TkBadge tone="neutral" dot>
                    Idle
                  </TkBadge>
                  <TkBadge tone="info" dot>
                    Queued
                  </TkBadge>
                  <TkBadge tone="accent" dot>
                    Running
                  </TkBadge>
                  <TkBadge tone="success" dot>
                    Complete
                  </TkBadge>
                  <TkBadge tone="warning" dot>
                    Needs review
                  </TkBadge>
                  <TkBadge tone="danger" dot>
                    Failed
                  </TkBadge>
                </div>
              </TkSection>
            </div>
          </section>

          <section id="components" className="tk-design-lab-block">
            <div className="tk-design-lab-block-heading">
              <span>03</span>
              <div>
                <h2>Core components</h2>
                <p>所有状态必须在共享组件中一次定义，而不是每个页面重新发明。</p>
              </div>
            </div>

            <div className="tk-design-lab-showcase">
              <TkSection
                title="Actions"
                description="Primary is expressive once per decision region."
                variant="raised"
              >
                <div className="tk-design-lab-button-row">
                  <TkButton variant="primary" leadingIcon={<CheckIcon size={14} />}>
                    Approve proposal
                  </TkButton>
                  <TkButton variant="secondary">Review details</TkButton>
                  <TkButton variant="ghost">Dismiss</TkButton>
                  <TkButton variant="danger">Reject</TkButton>
                  <TkButton variant="secondary" loading>
                    Saving
                  </TkButton>
                  <TkButton variant="primary" disabled>
                    Unavailable
                  </TkButton>
                  <TkIconButton label="Refresh data">
                    <RefreshIcon size={14} />
                  </TkIconButton>
                </div>
              </TkSection>

              <TkSection
                title="Fields"
                description="Stable labels and support rows."
                variant="raised"
              >
                <div className="tk-design-lab-form-grid">
                  <TkField
                    label="Search creators"
                    placeholder="Name, handle, or product"
                    prefix="/"
                    hint="Press ⌘K from anywhere."
                  />
                  <TkChoiceSelect
                    label="Assignment"
                    value={assignment}
                    onChange={setAssignment}
                    options={[
                      { value: "agent", label: "Affiliate agent" },
                      { value: "bd", label: "BD specialist" },
                      { value: "owner", label: "Account owner" },
                    ]}
                    hint="Defines who owns the next action."
                  />
                  <TkField
                    label="Daily quota"
                    defaultValue="500"
                    error="Quota must be 300 or lower for this channel."
                  />
                </div>
                <TkComposer
                  className="tk-design-lab-composer"
                  value={composerDraft}
                  onValueChange={setComposerDraft}
                  onSubmit={() => {}}
                  submitLabel="Send reply"
                  placeholder="Write a customer reply"
                  submitDisabled={!composerDraft.trim()}
                  textareaProps={{ rows: 2 }}
                />
              </TkSection>

              <TkSection
                title="View and preferences"
                description="Tabs are rails; pills remain status-only."
                variant="raised"
              >
                <TkTabs
                  items={TAB_ITEMS}
                  value={activeTab}
                  onChange={setActiveTab}
                  label="Work item status"
                />
                <TkTabs
                  variant="rail"
                  items={[
                    {
                      id: "attention",
                      label: "Operations",
                      description: "8 items need review",
                      icon: "01",
                      tone: "warning",
                    },
                    {
                      id: "running",
                      label: "Agent activity",
                      description: "3 workflows running",
                      icon: "02",
                    },
                    {
                      id: "complete",
                      label: "Outcomes",
                      description: "24 completed today",
                      icon: "03",
                      tone: "success",
                    },
                  ]}
                  value={activeTab}
                  onChange={setActiveTab}
                  label="Rich page navigation"
                />
                <TkSegmented
                  items={[
                    { id: "attention", label: "Attention" },
                    { id: "running", label: "Running" },
                    { id: "complete", label: "Complete" },
                  ]}
                  value={activeTab}
                  onChange={setActiveTab}
                  label="Compact view mode"
                />
                <div className="tk-design-lab-switches">
                  <TkSwitch
                    label="Show agent activity"
                    description="Expose tool and reasoning state while work is running."
                    checked={agentEvents}
                    onChange={setAgentEvents}
                  />
                  <TkSwitch
                    label="Compact rows"
                    description="Use 36px rows for high-volume review queues."
                    checked={compactRows}
                    onChange={setCompactRows}
                  />
                </div>
              </TkSection>

              <TkSection
                title="Overlay hierarchy"
                description="Popover and menu occupy L2; modal is the interrupting L3 layer."
                variant="raised"
              >
                <div className="tk-design-lab-overlay-actions">
                  <TkPopover
                    label="Agent run context"
                    placement="bottom-start"
                    trigger={(props) => (
                      <TkButton {...props} variant="secondary">
                        Open popover
                      </TkButton>
                    )}
                  >
                    <div className="tk-v1-popover-body">
                      <span className="tk-v1-micro-label">RUN 0841 / LIVE CONTEXT</span>
                      <strong>18 creators are being qualified</strong>
                      <p>
                        Popovers add local context without interrupting the active work surface.
                      </p>
                      <TkStatus
                        tone="accent"
                        live
                        label="Agent is working"
                        detail="discovery · qualification · dispatch"
                      />
                    </div>
                  </TkPopover>

                  <TkMenu
                    label="Queue actions"
                    triggerLabel="Open menu"
                    items={[
                      {
                        id: "review",
                        label: "Review details",
                        description: "Open the work item in place",
                        shortcut: "↵",
                        leadingIcon: <InfoIcon size={14} />,
                        onSelect: () => {},
                      },
                      {
                        id: "refresh",
                        label: "Refresh intelligence",
                        description: "Recompute the current signals",
                        shortcut: "⌘R",
                        leadingIcon: <RefreshIcon size={14} />,
                        onSelect: () => {},
                      },
                      { type: "separator", id: "danger-separator" },
                      {
                        id: "archive",
                        label: "Archive run",
                        tone: "danger",
                        onSelect: () => {},
                      },
                    ]}
                  />

                  <TkButton variant="primary" onClick={() => setModalOpen(true)}>
                    Open modal
                  </TkButton>
                </div>
                <p className="tk-design-lab-overlay-note">
                  Escape closes and restores focus. Menus use arrow navigation; overlays render
                  outside clipped page regions.
                </p>
              </TkSection>

              <TkSection
                title="Feedback states"
                description="Errors, progress, and no-data states share one semantic grammar."
                variant="raised"
              >
                <TkAlert tone="info" title="Sync is running">
                  Existing records remain available while the agent refreshes this source.
                </TkAlert>
                <TkLoadingState label="Loading operational records" />
              </TkSection>
            </div>

            <TkTableFrame className="tk-design-lab-contract-wrap">
              <table className="tk-design-lab-contract-table">
                <caption>Core component state contract</caption>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Required states</th>
                    <th>Behavior contract</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPONENT_CONTRACTS.map((item) => (
                    <tr key={item.component}>
                      <td>
                        <strong>{item.component}</strong>
                      </td>
                      <td>{item.states}</td>
                      <td>{item.contract}</td>
                      <td>
                        <TkBadge tone="success" dot>
                          Implemented
                        </TkBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TkTableFrame>
          </section>

          <section id="navigation" className="tk-design-lab-block">
            <div className="tk-design-lab-block-heading">
              <span>04</span>
              <div>
                <h2>Two-level product navigation</h2>
                <p>一级保持稳定方位，二级按意图展开；hover、点击与键盘共享同一套路径。</p>
              </div>
            </div>

            <div className="tk-design-lab-navigation-toolbar">
              <div>
                <span className="tk-v1-micro-label">INTERACTIVE PROTOTYPE</span>
                <strong>真实 Panel 菜单映射 · 9 个一级入口</strong>
              </div>
              <TkSegmented
                items={[
                  { id: "expanded", label: "展开侧栏" },
                  { id: "collapsed", label: "图标 Rail" },
                ]}
                value={navMode}
                onChange={setNavMode}
                label="侧栏显示模式"
              />
            </div>

            <div
              className={
                navMode === "collapsed"
                  ? "tk-design-lab-navigation-shell is-collapsed"
                  : "tk-design-lab-navigation-shell"
              }
            >
              <aside
                className={
                  navMode === "collapsed"
                    ? "tk-design-lab-navigation-sidebar is-collapsed"
                    : "tk-design-lab-navigation-sidebar"
                }
              >
                <div className="tk-design-lab-navigation-brand">
                  <span>TK</span>
                  <strong>TK匠</strong>
                  <small>DESKTOP</small>
                </div>
                <TkHierarchicalNav
                  items={HIERARCHICAL_NAV_ITEMS}
                  value={navValue}
                  onChange={setNavValue}
                  label="Panel 原型导航"
                  collapsed={navMode === "collapsed"}
                />
                <div className="tk-design-lab-navigation-sidebar-note">
                  <span>2L</span>
                  <small>MAX DEPTH</small>
                </div>
              </aside>

              <div className="tk-design-lab-navigation-canvas">
                <header>
                  <div>
                    <span className="tk-v1-micro-label">CURRENT ROUTE</span>
                    <code>{navValue}</code>
                  </div>
                  <TkBadge tone="success" dot>
                    Contract active
                  </TkBadge>
                </header>
                <main>
                  <div className="tk-design-lab-navigation-page-title">
                    <span>04 / NAVIGATION SPECIMEN</span>
                    <h3>{findNavigationLabel(navValue)}</h3>
                    <p>一级入口给出稳定空间记忆；二级入口承载任务名称，不再把全部路由平铺。</p>
                  </div>
                  <div className="tk-design-lab-navigation-principles">
                    <article>
                      <span>OPEN</span>
                      <strong>Hover intent / focus</strong>
                      <p>短暂查看，不改变当前页面。</p>
                    </article>
                    <article>
                      <span>PIN</span>
                      <strong>Click parent</strong>
                      <p>固定面板，支持连续选择。</p>
                    </article>
                    <article>
                      <span>MOVE</span>
                      <strong>Arrow keys / Escape</strong>
                      <p>完整键盘路径并返回触发项。</p>
                    </article>
                  </div>
                </main>
              </div>
            </div>

            <TkAlert tone="info" title="Navigation contract">
              一级父项只负责展开，不同时承担跳转；最多两层可交互导航。二级分组标题只帮助扫描，不制造第三层。
            </TkAlert>
          </section>

          <section id="pattern" className="tk-design-lab-block">
            <div className="tk-design-lab-block-heading">
              <span>05</span>
              <div>
                <h2>Operational pattern</h2>
                <p>用真实工作台组合检查设计系统，而不是只看孤立按钮。</p>
              </div>
            </div>

            <div className="tk-design-lab-workbench">
              <div className="tk-design-lab-workbench-topline">
                <TkStatus
                  tone="accent"
                  live
                  label="Affiliate agent is working"
                  detail="qualifying 18 creators · run 0841"
                />
                <div className="tk-design-lab-workbench-actions">
                  <TkButton variant="ghost" size="sm" leadingIcon={<RefreshIcon size={13} />}>
                    Refresh
                  </TkButton>
                  <TkButton variant="primary" size="sm">
                    Review queue
                  </TkButton>
                </div>
              </div>

              <div className="tk-design-lab-metrics">
                <TkMetric label="Qualified today" value="184" delta="+12.4%" />
                <TkMetric label="Awaiting approval" value="8" delta="−3 since 09:00" />
                <TkMetric label="Expected GMV" value="$17.2k" delta="+8.1%" />
                <TkMetric label="Reply rate" value="23.8%" delta="+2.7 pt" />
              </div>

              <TkTableFrame variant="embedded" className="tk-design-lab-table-wrap">
                <table
                  className={compactRows ? "tk-design-lab-table is-compact" : "tk-design-lab-table"}
                >
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Next action</th>
                      <th>Expected value</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {WORK_ITEMS.map((item) => {
                      const disabled = item.status === "Agent drafting";
                      return (
                        <TkInteractiveTableRow
                          key={item.creator}
                          aria-label={`Open ${item.creator}`}
                          disabled={disabled}
                          onActivate={() => undefined}
                        >
                          <td>
                            <strong>{item.creator}</strong>
                          </td>
                          <td>{item.task}</td>
                          <td className="tk-design-lab-mono">{item.value}</td>
                          <td>
                            <TkBadge tone={item.tone} dot>
                              {item.status}
                            </TkBadge>
                          </td>
                          <td>
                            <span aria-hidden="true">{disabled ? "—" : "›"}</span>
                          </td>
                        </TkInteractiveTableRow>
                      );
                    })}
                  </tbody>
                </table>
              </TkTableFrame>
            </div>
          </section>

          <section id="rules" className="tk-design-lab-block">
            <div className="tk-design-lab-block-heading">
              <span>06</span>
              <div>
                <h2>Usage rules</h2>
                <p>“有立体感”不等于“所有东西都浮起来”。</p>
              </div>
            </div>

            <div className="tk-design-lab-rules-grid">
              <article className="tk-design-lab-rule is-do">
                <CheckIcon size={17} />
                <div>
                  <strong>Use depth to explain behavior</strong>
                  <p>菜单、主操作、拖拽对象和运行状态拥有明确的光、影和运动。</p>
                </div>
              </article>
              <article className="tk-design-lab-rule is-dont">
                <InfoIcon size={17} />
                <div>
                  <strong>Do not decorate every container</strong>
                  <p>长表格、设置分区和阅读表面保持安静，避免卡片套卡片。</p>
                </div>
              </article>
            </div>

            <TkEmptyState
              eyebrow="No pending decisions"
              title="The queue is clear"
              description="Empty states preserve the product voice without relying on illustrations, sparkles, or oversized gradients."
              action={<TkButton variant="secondary">View completed work</TkButton>}
            />
          </section>
        </div>
      </div>

      <TkModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Approval checkpoint"
        maxWidth={460}
      >
        <div className="tk-design-lab-modal-copy">
          <span className="tk-v1-micro-label">L3 / DECISION REQUIRED</span>
          <p>
            The agent prepared 18 creator outreach messages. Review the decision before dispatch.
          </p>
        </div>
        <div className="tk-v1-modal-actions">
          <TkButton variant="secondary" onClick={() => setModalOpen(false)}>
            Keep reviewing
          </TkButton>
          <TkButton variant="primary" onClick={() => setModalOpen(false)}>
            Approve dispatch
          </TkButton>
        </div>
      </TkModal>
    </div>
  );
}
