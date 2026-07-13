import { print } from "graphql";
import { describe, expect, it } from "vitest";
import { ECOMMERCE_GET_CS_EXPERIMENT_WORKSPACE } from "./cs-experiment-queries.js";

describe("customer service experiment workspace query", () => {
  it("loads detail with only the active signal payload in one operation", () => {
    const query = print(ECOMMERCE_GET_CS_EXPERIMENT_WORKSPACE);

    expect(query).toContain("ecommerceGetCSExperimentDetail");
    expect(query).toContain("messageTemplate");
    expect(query).toMatch(
      /ecommerceGetCSExperimentTimeToEventCurve\(input: \$curveInput\) @include\(if: \$includeCurve\)/,
    );
    expect(query).toMatch(
      /ecommerceGetCSExperimentTrend\(input: \$trendInput\) @include\(if: \$includeTrend\)/,
    );
  });
});
