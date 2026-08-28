import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import {
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import { Select } from "../../../components/inputs/Select.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";
import panelI18n from "../../../i18n/index.js";

const PAGE_SIZE = 25;

export type AffiliateWorkbenchEntityTab = "SAMPLES" | "MESSAGES";

export interface AffiliateWorkbenchEntityOpenTarget {
  creatorRelationshipId: string;
  selectedShopId?: string;
  initialTab: "samples" | "conversation";
  replyToLifecycleEventId?: string;
}

interface Props {
  tab: AffiliateWorkbenchEntityTab;
  selectedShopId: string;
  refreshRevision: number;
  onOpen: (target: AffiliateWorkbenchEntityOpenTarget) => void;
}

interface SamplePageData {
  affiliateWorkbenchSamplePage: GQL.AffiliateWorkbenchSamplePage;
}

interface ConversationPageData {
  affiliateWorkbenchPendingConversationPage: GQL.AffiliateWorkbenchPendingConversationPage;
}

export function AffiliateWorkbenchEntityTabs({
  tab,
  selectedShopId,
  refreshRevision,
  onOpen,
}: Props) {
  return tab === "SAMPLES" ? (
    <AffiliateWorkbenchSampleList
      selectedShopId={selectedShopId}
      refreshRevision={refreshRevision}
      onOpen={onOpen}
    />
  ) : (
    <AffiliateWorkbenchMessageList refreshRevision={refreshRevision} onOpen={onOpen} />
  );
}

function AffiliateWorkbenchSampleList({
  selectedShopId,
  onOpen,
  refreshRevision,
}: Pick<Props, "selectedShopId" | "refreshRevision" | "onOpen">) {
  const { t } = useTranslation();
  const [disposition, setDisposition] = useState<GQL.AffiliateSampleReviewDisposition>(
    GQL.AffiliateSampleReviewDisposition.Open,
  );
  const [items, setItems] = useState<GQL.AffiliateWorkbenchSampleRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const { data, loading, fetchMore, refetch } = useQuery<
    SamplePageData,
    { input: GQL.AffiliateWorkbenchSamplePageInput }
  >(AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || null,
        reviewDisposition: disposition,
        limit: PAGE_SIZE,
        cursor: null,
      },
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const page = data?.affiliateWorkbenchSamplePage;

  useEffect(() => {
    if (!page) return;
    setItems(page.items);
    setNextCursor(page.nextCursor ?? null);
    setHasMore(page.hasMore);
  }, [page]);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
  }, [disposition, selectedShopId]);

  useEffect(() => {
    if (refreshRevision > 0) void refetch();
  }, [refetch, refreshRevision]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    const result = await fetchMore({
      variables: {
        input: {
          shopId: selectedShopId || null,
          reviewDisposition: disposition,
          limit: PAGE_SIZE,
          cursor: nextCursor,
        },
      },
      updateQuery: (current) => current,
    });
    const next = result.data?.affiliateWorkbenchSamplePage;
    if (next) {
      setItems((current) => appendUniqueRows(current, next.items));
      setNextCursor(next.nextCursor ?? null);
      setHasMore(next.hasMore);
    }
  }, [disposition, fetchMore, hasMore, nextCursor, selectedShopId]);

  return (
    <section className="affiliate-workbench-entity-section">
      <div className="affiliate-workbench-entity-toolbar">
        <Select
          value={disposition}
          onChange={(value) => setDisposition(value as GQL.AffiliateSampleReviewDisposition)}
          options={[
            {
              value: GQL.AffiliateSampleReviewDisposition.Open,
              label: t("ecommerce.affiliateWorkspace.workbench.sampleOpen"),
            },
            {
              value: GQL.AffiliateSampleReviewDisposition.SoftRejected,
              label: t("ecommerce.affiliateWorkspace.workbench.sampleSoftRejected"),
            },
          ]}
          className="affiliate-status-select"
        />
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t("common.refresh")}
        </button>
      </div>
      {loading && items.length === 0 ? (
        <WorkbenchLoading />
      ) : items.length === 0 ? (
        <WorkbenchEmpty>{t("ecommerce.affiliateWorkspace.workbench.noSamples")}</WorkbenchEmpty>
      ) : (
        <div className="affiliate-workbench-entity-list">
          {items.map((row) => (
            <button
              className="affiliate-workbench-entity-row"
              type="button"
              key={row.id}
              onClick={() => onOpen({
                creatorRelationshipId: row.creatorRelationshipId,
                selectedShopId: row.sampleApplication.shopId,
                initialTab: "samples",
              })}
            >
              <EntityIdentity
                name={row.creatorName}
                username={row.creatorUsername}
                avatarUrl={row.creatorAvatarUrl}
              />
              <div className="affiliate-workbench-entity-main">
                <strong>{row.productTitle || row.sampleApplication.productId || t("common.unknown")}</strong>
                <span>{row.shopName || t("common.unknown")}</span>
                <small>
                  {formatLocalizedDateTime(row.sampleApplication.firstObservedAt, panelI18n.language)}
                  {row.sampleApplication.approveExpirationAt
                    ? ` · ${t("ecommerce.affiliateWorkspace.workbench.expiresAt", {
                        value: formatLocalizedDateTime(
                          row.sampleApplication.approveExpirationAt,
                          panelI18n.language,
                        ),
                      })}`
                    : ""}
                </small>
              </div>
              <EntityBadges
                protectedCreator={row.protected}
                humanOnly={row.humanOnly}
                businessDeveloperName={row.businessDeveloperName}
                proposal={row.proposal}
                sampleApplication={row.sampleApplication}
              />
              <span className="affiliate-workbench-row-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}
      {hasMore ? (
        <button className="btn btn-secondary affiliate-workbench-load-more" type="button" disabled={loading} onClick={() => void loadMore()}>
          {loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.loadMoreProposals")}
        </button>
      ) : null}
    </section>
  );
}

function AffiliateWorkbenchMessageList({
  onOpen,
  refreshRevision,
}: Pick<Props, "refreshRevision" | "onOpen">) {
  const { t } = useTranslation();
  const [items, setItems] = useState<GQL.AffiliateWorkbenchPendingConversationRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const { data, loading, fetchMore, refetch } = useQuery<
    ConversationPageData,
    { input: GQL.AffiliateWorkbenchPendingConversationPageInput }
  >(AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY, {
    variables: { input: { limit: PAGE_SIZE, cursor: null } },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const page = data?.affiliateWorkbenchPendingConversationPage;

  useEffect(() => {
    if (!page) return;
    setItems(page.items);
    setNextCursor(page.nextCursor ?? null);
    setHasMore(page.hasMore);
  }, [page]);

  useEffect(() => {
    if (refreshRevision > 0) void refetch();
  }, [refetch, refreshRevision]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    const result = await fetchMore({
      variables: { input: { limit: PAGE_SIZE, cursor: nextCursor } },
      updateQuery: (current) => current,
    });
    const next = result.data?.affiliateWorkbenchPendingConversationPage;
    if (next) {
      setItems((current) => appendUniqueRows(current, next.items));
      setNextCursor(next.nextCursor ?? null);
      setHasMore(next.hasMore);
    }
  }, [fetchMore, hasMore, nextCursor]);

  return (
    <section className="affiliate-workbench-entity-section">
      <div className="affiliate-workbench-entity-toolbar affiliate-workbench-entity-toolbar-end">
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t("common.refresh")}
        </button>
      </div>
      {loading && items.length === 0 ? (
        <WorkbenchLoading />
      ) : items.length === 0 ? (
        <WorkbenchEmpty>{t("ecommerce.affiliateWorkspace.workbench.noMessages")}</WorkbenchEmpty>
      ) : (
        <div className="affiliate-workbench-entity-list">
          {items.map((row) => (
            <button
              className="affiliate-workbench-entity-row"
              type="button"
              key={row.id}
              onClick={() => onOpen({
                creatorRelationshipId: row.creatorRelationshipId,
                selectedShopId: row.sourceShopId ?? undefined,
                initialTab: "conversation",
                replyToLifecycleEventId: row.replyToLifecycleEventId,
              })}
            >
              <EntityIdentity
                name={row.creatorName}
                username={row.creatorUsername}
                avatarUrl={row.creatorAvatarUrl}
              />
              <div className="affiliate-workbench-entity-main">
                <strong>{channelLabel(row.channel)}</strong>
                <span>{row.sourceLabel}</span>
                <small>
                  {t("ecommerce.affiliateWorkspace.workbench.pendingSince", {
                    value: formatLocalizedDateTime(row.lastPendingAt, panelI18n.language),
                  })}
                </small>
              </div>
              <EntityBadges
                protectedCreator={row.protected}
                humanOnly={row.humanOnly}
                businessDeveloperName={row.businessDeveloperName}
                proposal={row.proposal}
              />
              <span className="affiliate-workbench-row-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}
      {hasMore ? (
        <button className="btn btn-secondary affiliate-workbench-load-more" type="button" disabled={loading} onClick={() => void loadMore()}>
          {loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.loadMoreProposals")}
        </button>
      ) : null}
    </section>
  );
}

function EntityIdentity(props: {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}) {
  const { t } = useTranslation();
  const name = props.name || props.username || t("ecommerce.affiliateWorkspace.unknownCreator");
  return (
    <div className="affiliate-workbench-entity-identity">
      {props.avatarUrl ? (
        <img src={props.avatarUrl} alt="" className="affiliate-workbench-entity-avatar" />
      ) : (
        <span className="affiliate-workbench-entity-avatar affiliate-workbench-entity-avatar-fallback">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>
        <strong>{name}</strong>
        {props.username ? <small>@{props.username.replace(/^@/u, "")}</small> : null}
      </span>
    </div>
  );
}

function EntityBadges(props: {
  protectedCreator: boolean;
  humanOnly: boolean;
  businessDeveloperName?: string | null;
  proposal?: GQL.ActionProposal | null;
  sampleApplication?: GQL.SampleApplicationRecord | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-workbench-entity-badges">
      {props.sampleApplication?.reviewDisposition ===
      GQL.AffiliateSampleReviewDisposition.SoftRejected ? (
        <span className="affiliate-workbench-badge affiliate-workbench-badge-soft-rejected">
          {t("ecommerce.affiliateWorkspace.workbench.sampleSoftRejected")}
        </span>
      ) : props.sampleApplication?.sampleWorkStatus ===
        GQL.SampleWorkStatus.PlatformStatusUnknown ? (
        <span className="affiliate-workbench-badge affiliate-workbench-badge-sync">
          {t("ecommerce.affiliateWorkspace.workbench.sampleSyncIssue")}
        </span>
      ) : props.sampleApplication ? (
        <span className="affiliate-workbench-badge">
          {t("ecommerce.affiliateWorkspace.workbench.sampleOpen")}
        </span>
      ) : null}
      {props.businessDeveloperName ? <span className="affiliate-workbench-badge">{props.businessDeveloperName}</span> : null}
      {props.protectedCreator ? <span className="affiliate-workbench-badge affiliate-workbench-badge-protected">{t("ecommerce.affiliateWorkspace.workbench.protected")}</span> : null}
      {props.humanOnly ? <span className="affiliate-workbench-badge affiliate-workbench-badge-human">{t("ecommerce.affiliateWorkspace.workbench.humanOnly")}</span> : null}
      {props.proposal ? (
        <span className="affiliate-workbench-badge affiliate-workbench-badge-proposal">
          {t("ecommerce.affiliateWorkspace.workbench.viewFullBundle")}
        </span>
      ) : null}
    </div>
  );
}

function WorkbenchLoading() {
  const { t } = useTranslation();
  return <div className="affiliate-proposal-empty">{t("common.loading")}</div>;
}

function WorkbenchEmpty({ children }: { children: string }) {
  return <div className="affiliate-proposal-empty">{children}</div>;
}

function channelLabel(channel: GQL.AffiliateMessageChannel): string {
  if (channel === GQL.AffiliateMessageChannel.Whatsapp) return "WhatsApp";
  if (channel === GQL.AffiliateMessageChannel.Email) return "Email";
  return "TikTok Shop";
}

function appendUniqueRows<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}
