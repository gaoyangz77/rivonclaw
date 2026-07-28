import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { UPSERT_EXPERT_PROFILE } from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";
import { useI18n } from "./i18n.js";

const MARKET_CODES = [
  "US",
  "GB",
  "DE",
  "FR",
  "ES",
  "IT",
  "IE",
  "AT",
  "BE",
  "CZ",
  "GR",
  "HU",
  "NL",
  "PL",
  "PT",
  "JP",
  "BR",
  "MX",
  "ID",
  "MY",
  "PH",
  "SG",
  "TH",
  "VN",
] as const;

const EXPERIENCE_OPTIONS = ["FIRST_TIME", "ECOMMERCE", "TIKTOK_SHOP", "SERVICE_PROVIDER"] as const;
const CAPITAL_OPTIONS = ["UNDECIDED", "UNDER_5K", "FROM_5K_TO_20K", "FROM_20K_TO_50K", "OVER_50K"] as const;

function optionalList(value: string): string[] {
  const normalized = value.trim();
  return normalized ? [normalized] : [];
}

export function buildProfileMarkets(
  marketCodes: string[],
  marketContext: string,
  marketName: (code: string) => string,
): string[] {
  return [
    ...marketCodes.map((code) => `${marketName(code)} (${code})`),
    ...optionalList(marketContext),
  ];
}

export function buildSupplementedAnswer(optionLabel: string, supplement: string): string | undefined {
  const parts = [optionLabel.trim(), supplement.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join("；") : undefined;
}

export function MarketMultiSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (marketCodes: string[]) => void;
}) {
  const { language, t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const marketNames = new Intl.DisplayNames([language], { type: "region" });
  const listFormatter = new Intl.ListFormat([language], { style: "short", type: "conjunction" });

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || !(event.target instanceof Node) || details.contains(event.target)) return;
      details.removeAttribute("open");
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function marketName(code: string): string {
    return marketNames.of(code) ?? code;
  }

  function toggleMarket(code: string) {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  }

  const normalizedQuery = query.trim().toLocaleLowerCase(language);
  const visibleMarkets = MARKET_CODES.filter((code) => {
    if (!normalizedQuery) return true;
    return (
      code.toLocaleLowerCase(language).includes(normalizedQuery) ||
      marketName(code).toLocaleLowerCase(language).includes(normalizedQuery)
    );
  });
  const summary =
    value.length === 0
      ? t("onboarding.marketSelectPlaceholder")
      : value.length <= 2
        ? listFormatter.format(value.map(marketName))
        : t("onboarding.marketSelectedCount", { count: value.length });

  return (
    <details
      className="market-multi-selector"
      ref={detailsRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") detailsRef.current?.removeAttribute("open");
      }}
    >
      <summary>
        <span className={value.length === 0 ? "placeholder" : ""}>{summary}</span>
        <span className="selector-chevron" aria-hidden="true" />
      </summary>
      <div className="market-selector-popover">
        <label className="market-search">
          <span className="visually-hidden">{t("onboarding.marketSearch")}</span>
          <input
            type="search"
            placeholder={t("onboarding.marketSearch")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div
          className="market-options"
          role="group"
          aria-label={t("onboarding.market")}
        >
          {visibleMarkets.map((code) => (
            <label className={value.includes(code) ? "selected" : ""} key={code}>
              <input
                type="checkbox"
                aria-label={`${marketName(code)} (${code})`}
                checked={value.includes(code)}
                onChange={() => toggleMarket(code)}
              />
              <span>{marketName(code)}</span>
              <small>{code}</small>
            </label>
          ))}
          {visibleMarkets.length === 0 ? (
            <p className="market-empty">{t("onboarding.marketNoResults")}</p>
          ) : null}
        </div>
        <footer className="market-selector-actions">
          <button type="button" disabled={value.length === 0} onClick={() => onChange([])}>
            {t("onboarding.marketClear")}
          </button>
          <span>{t("onboarding.marketSelectedCount", { count: value.length })}</span>
          <button
            className="market-selector-done"
            type="button"
            onClick={() => detailsRef.current?.removeAttribute("open")}
          >
            {t("onboarding.marketDone")}
          </button>
        </footer>
      </div>
    </details>
  );
}

export const Onboarding = observer(function Onboarding({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const store = useExpertStore();
  const { language, t } = useI18n();
  const [step, setStep] = useState(1);
  const [stage, setStage] = useState("EXPLORING");
  const [marketCodes, setMarketCodes] = useState<string[]>([]);
  const [marketContext, setMarketContext] = useState("");
  const [sellerTypes, setSellerTypes] = useState<string[]>([]);
  const [experienceOption, setExperienceOption] = useState("");
  const [experienceSupplement, setExperienceSupplement] = useState("");
  const [capitalOption, setCapitalOption] = useState("");
  const [capitalSupplement, setCapitalSupplement] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [saving, setSaving] = useState(false);

  const marketNames = new Intl.DisplayNames([language], { type: "region" });

  function marketName(code: string): string {
    return marketNames.of(code) ?? code;
  }

  function profileMarkets(): string[] {
    return buildProfileMarkets(marketCodes, marketContext, marketName);
  }

  function toggleSellerType(value: string) {
    setSellerTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function next(event: React.FormEvent) {
    event.preventDefault();
    if (step === 1 && profileMarkets().length === 0) return;
    setStep((current) => Math.min(3, current + 1));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    store.setError(undefined);
    try {
      await apolloClient.mutate({
        mutation: UPSERT_EXPERT_PROFILE,
        variables: {
          input: {
            locale: language,
            stage,
            targetMarkets: profileMarkets(),
            sellerTypes,
            experience:
              buildSupplementedAnswer(
                experienceOption ? t(`onboarding.experienceOption.${experienceOption}`) : "",
                experienceSupplement,
              ) ?? null,
            capitalBand:
              buildSupplementedAnswer(
                capitalOption ? t(`onboarding.capitalOption.${capitalOption}`) : "",
                capitalSupplement,
              ) ?? null,
            teamCapacity: null,
            targetTimeline: null,
            goals: optionalList(goals),
            constraints: optionalList(constraints),
          },
        },
      });
      store.markProfileComplete();
      await onComplete();
    } catch (error) {
      store.setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const title =
    step === 1
      ? t("onboarding.contextTitle")
      : step === 2
        ? t("onboarding.setupTitle")
        : t("onboarding.prioritiesTitle");
  const body =
    step === 1
      ? t("onboarding.contextBody")
      : step === 2
        ? t("onboarding.setupBody")
        : t("onboarding.prioritiesBody");

  return (
    <div className="onboarding-backdrop">
      <section
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <aside className="onboarding-intro">
          <p className="eyebrow">{t("onboarding.kicker")}</p>
          <h2 id="onboarding-title">{t("onboarding.title")}</h2>
          <p>{t("onboarding.body")}</p>
          <div className="onboarding-progress" aria-hidden="true">
            {[1, 2, 3].map((item) => (
              <span className={item <= step ? "active" : ""} key={item} />
            ))}
          </div>
        </aside>

        <form className="onboarding-form" onSubmit={step === 3 ? save : next}>
          <header>
            <span>{t("onboarding.step", { current: step, total: 3 })}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </header>

          {step === 1 ? (
            <div className="onboarding-fields">
              <label>
                {t("onboarding.stage")}
                <select value={stage} onChange={(event) => setStage(event.target.value)}>
                  {["EXPLORING", "VALIDATING", "LAUNCHING", "OPERATING", "SCALING"].map(
                    (value) => (
                      <option value={value} key={value}>
                        {t(`stage.${value}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="onboarding-field">
                {t("onboarding.market")}
                <MarketMultiSelector value={marketCodes} onChange={setMarketCodes} />
              </div>
              <label>
                {t("onboarding.marketFreeLabel")}
                <input
                  placeholder={t("onboarding.marketFreePlaceholder")}
                  value={marketContext}
                  onChange={(event) => setMarketContext(event.target.value)}
                />
                <small>{t("onboarding.marketHint")}</small>
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="onboarding-fields">
              <fieldset>
                <legend>{t("onboarding.sellerSetup")}</legend>
                <div className="choice-grid">
                  <label className={sellerTypes.includes("CROSS_BORDER") ? "selected" : ""}>
                    <input
                      type="checkbox"
                      checked={sellerTypes.includes("CROSS_BORDER")}
                      onChange={() => toggleSellerType("CROSS_BORDER")}
                    />
                    {t("onboarding.crossBorder")}
                  </label>
                  <label className={sellerTypes.includes("LOCAL") ? "selected" : ""}>
                    <input
                      type="checkbox"
                      checked={sellerTypes.includes("LOCAL")}
                      onChange={() => toggleSellerType("LOCAL")}
                    />
                    {t("onboarding.local")}
                  </label>
                  <label className={`unsure-option ${sellerTypes.length === 0 ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={sellerTypes.length === 0}
                      onChange={() => setSellerTypes([])}
                    />
                    {t("onboarding.sellerUnsure")}
                  </label>
                </div>
              </fieldset>
              <div className="two-column-fields">
                <label>
                  {t("onboarding.experience")}
                  <select
                    value={experienceOption}
                    onChange={(event) => setExperienceOption(event.target.value)}
                  >
                    <option value="">{t("onboarding.optionalSelect")}</option>
                    {EXPERIENCE_OPTIONS.map((option) => (
                      <option value={option} key={option}>
                        {t(`onboarding.experienceOption.${option}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder={t("onboarding.experienceSupplement")}
                    value={experienceSupplement}
                    onChange={(event) => setExperienceSupplement(event.target.value)}
                  />
                </label>
                <label>
                  {t("onboarding.capital")}
                  <select
                    value={capitalOption}
                    onChange={(event) => setCapitalOption(event.target.value)}
                  >
                    <option value="">{t("onboarding.optionalSelect")}</option>
                    {CAPITAL_OPTIONS.map((option) => (
                      <option value={option} key={option}>
                        {t(`onboarding.capitalOption.${option}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder={t("onboarding.capitalSupplement")}
                    value={capitalSupplement}
                    onChange={(event) => setCapitalSupplement(event.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="onboarding-fields">
              <label>
                {t("onboarding.goals")}
                <textarea
                  autoFocus
                  placeholder={t("onboarding.goalsPlaceholder")}
                  value={goals}
                  onChange={(event) => setGoals(event.target.value)}
                />
              </label>
              <label>
                {t("onboarding.constraints")}
                <textarea
                  placeholder={t("onboarding.constraintsPlaceholder")}
                  value={constraints}
                  onChange={(event) => setConstraints(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {store.error ? <p className="form-error">{store.error}</p> : null}
          <footer className="onboarding-actions">
            <button
              className="secondary-button"
              disabled={step === 1 || saving}
              type="button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
            >
              {t("onboarding.back")}
            </button>
            <button
              className="primary-button"
              disabled={
                saving ||
                (step === 1 && profileMarkets().length === 0)
              }
              type="submit"
            >
              {saving
                ? t("onboarding.saving")
                : step === 3
                  ? t("onboarding.save")
                  : t("onboarding.next")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
});
