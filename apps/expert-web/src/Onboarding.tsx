import { useState } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { UPSERT_EXPERT_PROFILE } from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";

function commaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const Onboarding = observer(function Onboarding() {
  const store = useExpertStore();
  const [stage, setStage] = useState("EXPLORING");
  const [markets, setMarkets] = useState("");
  const [sellerTypes, setSellerTypes] = useState<string[]>(["CROSS_BORDER"]);
  const [experience, setExperience] = useState("");
  const [capitalBand, setCapitalBand] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleSellerType(value: string) {
    setSellerTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
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
            locale: navigator.language || "en",
            stage,
            targetMarkets: commaList(markets),
            sellerTypes,
            experience: experience.trim() || null,
            capitalBand: capitalBand.trim() || null,
            teamCapacity: null,
            targetTimeline: null,
            goals: commaList(goals),
            constraints: commaList(constraints),
          },
        },
      });
      store.markProfileComplete();
    } catch (error) {
      store.setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-layout">
      <section className="onboarding-copy">
        <div className="brand-mark">R</div>
        <p className="eyebrow">Your operating context</p>
        <h1>Good advice starts with the constraints.</h1>
        <p>
          The Expert uses this context to choose for you—not merely repeat policies or list every
          possible path. You can refine it later.
        </p>
      </section>
      <form className="onboarding-card" onSubmit={save}>
        <label>
          Where are you now?
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="EXPLORING">Exploring the opportunity</option>
            <option value="VALIDATING">Validating a market or product</option>
            <option value="LAUNCHING">Preparing to launch</option>
            <option value="OPERATING">Already operating a shop</option>
            <option value="SCALING">Scaling an existing operation</option>
          </select>
        </label>
        <label>
          Target markets
          <input
            required
            placeholder="US, UK, DE — use the markets you are considering"
            value={markets}
            onChange={(event) => setMarkets(event.target.value)}
          />
          <small>Comma-separated. The Expert supports every market represented in its current knowledge release.</small>
        </label>
        <fieldset>
          <legend>Seller setup</legend>
          <label className="check-label">
            <input
              type="checkbox"
              checked={sellerTypes.includes("CROSS_BORDER")}
              onChange={() => toggleSellerType("CROSS_BORDER")}
            />
            Cross-border seller
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={sellerTypes.includes("LOCAL")}
              onChange={() => toggleSellerType("LOCAL")}
            />
            Local entity / local seller
          </label>
        </fieldset>
        <div className="two-column-fields">
          <label>
            Relevant experience
            <input
              placeholder="Amazon operator, first-time founder…"
              value={experience}
              onChange={(event) => setExperience(event.target.value)}
            />
          </label>
          <label>
            Capital range
            <input
              placeholder="$5k, $20–50k…"
              value={capitalBand}
              onChange={(event) => setCapitalBand(event.target.value)}
            />
          </label>
        </div>
        <label>
          Goals
          <input
            placeholder="Validate a product, launch in 60 days"
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
          />
        </label>
        <label>
          Hard constraints
          <input
            placeholder="No local warehouse, two-person team"
            value={constraints}
            onChange={(event) => setConstraints(event.target.value)}
          />
        </label>
        {store.error ? <p className="form-error">{store.error}</p> : null}
        <button className="primary-button" disabled={saving || sellerTypes.length === 0}>
          {saving ? "Saving…" : "Start with my context"}
        </button>
      </form>
    </main>
  );
});
