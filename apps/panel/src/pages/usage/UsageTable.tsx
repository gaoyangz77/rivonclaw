import { formatCost, formatTokens, type ProviderGroup } from "./usage-utils.js";
import { TkPanel, TkPanelHeader, TkTableFrame } from "../../components/design-system/index.js";

export function UsageTable({
  grouped,
  isCN,
  t,
}: {
  grouped: ProviderGroup[];
  isCN: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="usage-blocks">
      {grouped.flatMap((pg) =>
        pg.keys.map((kg) => (
          <TkPanel key={kg.keyId} padding="none" clip className="usage-key-block">
            <TkPanelHeader
              headingLevel={4}
              title={pg.provider}
              description={kg.keyLabel}
              actions={
                kg.authType !== "oauth" ? (
                  <span className="usage-key-cost">
                    {formatCost(kg.totalCost, kg.currency, isCN)}
                  </span>
                ) : undefined
              }
            />
            <TkTableFrame variant="embedded">
              <table className="usage-inner-table">
                <thead>
                  <tr>
                    <th>{t("keyUsage.model")}</th>
                    <th>{t("keyUsage.inputTokens")}</th>
                    <th>{t("keyUsage.outputTokens")}</th>
                    <th>{t("keyUsage.cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {kg.models.map((mr) => (
                    <tr key={mr.row.model} className="table-hover-row">
                      <td className="usage-model-name">
                        {mr.row.model}
                        {mr.isActive && (
                          <>
                            {" "}
                            <span className="badge badge-active">{t("keyUsage.active")}</span>
                          </>
                        )}
                      </td>
                      <td className="usage-token-cell">{formatTokens(mr.row.inputTokens)}</td>
                      <td className="usage-token-cell">{formatTokens(mr.row.outputTokens)}</td>
                      <td className="usage-token-cell">
                        {kg.authType === "oauth"
                          ? "-"
                          : formatCost(mr.cost.amount, mr.cost.currency, isCN)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TkTableFrame>
          </TkPanel>
        )),
      )}
    </div>
  );
}
