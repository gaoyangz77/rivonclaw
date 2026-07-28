import { useState } from "react";
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
  const [sellerTypes, setSellerTypes] = useState<string[]>(["CROSS_BORDER"]);
  const [experience, setExperience] = useState("");
  const [capitalBand, setCapitalBand] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [saving, setSaving] = useState(false);

  const marketNames = new Intl.DisplayNames([language], { type: "region" });

  function marketName(code: string): string {
    return marketNames.of(code) ?? code;
  }

  function addMarket(code: string) {
    if (!code) return;
    setMarketCodes((current) => (current.includes(code) ? current : [...current, code]));
  }

  function removeMarket(code: string) {
    setMarketCodes((current) => current.filter((item) => item !== code));
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
    if (step === 2 && sellerTypes.length === 0) return;
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
            experience: experience.trim() || null,
            capitalBand: capitalBand.trim() || null,
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
              <label>
                {t("onboarding.market")}
                <select
                  autoFocus
                  value=""
                  onChange={(event) => addMarket(event.target.value)}
                >
                  <option value="">{t("onboarding.marketSelectPlaceholder")}</option>
                  {MARKET_CODES.map((code) => (
                    <option value={code} disabled={marketCodes.includes(code)} key={code}>
                      {marketName(code)}
                    </option>
                  ))}
                </select>
              </label>
              {marketCodes.length > 0 ? (
                <div className="selected-markets" aria-label={t("onboarding.selectedMarkets")}>
                  {marketCodes.map((code) => (
                    <button
                      type="button"
                      onClick={() => removeMarket(code)}
                      aria-label={t("onboarding.removeMarket", { market: marketName(code) })}
                      key={code}
                    >
                      <span>{marketName(code)}</span>
                      <small>{code}</small>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
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
                </div>
              </fieldset>
              <div className="two-column-fields">
                <label>
                  {t("onboarding.experience")}
                  <input
                    placeholder={t("onboarding.experiencePlaceholder")}
                    value={experience}
                    onChange={(event) => setExperience(event.target.value)}
                  />
                </label>
                <label>
                  {t("onboarding.capital")}
                  <input
                    placeholder={t("onboarding.capitalPlaceholder")}
                    value={capitalBand}
                    onChange={(event) => setCapitalBand(event.target.value)}
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
                (step === 1 && profileMarkets().length === 0) ||
                (step === 2 && sellerTypes.length === 0)
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
