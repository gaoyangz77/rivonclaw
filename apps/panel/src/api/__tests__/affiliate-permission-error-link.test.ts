// @vitest-environment jsdom
import { ApolloClient, ApolloLink, InMemoryCache, Observable, gql } from "@apollo/client";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../i18n/index.js";
import { createAffiliatePermissionErrorLink } from "../affiliate-permission-error-link.js";

const mutation = gql`mutation ReviewSample { reviewSample }`;
const clients: ApolloClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.stop()));

function clientFor(reason: string, code = "FORBIDDEN") {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createAffiliatePermissionErrorLink().concat(new ApolloLink(() => new Observable((observer) => {
      observer.next({
        data: null,
        errors: [{ message: "Server fallback", path: ["reviewSample"], extensions: { code, reason, entity: "AffiliateCreatorRelationship" } }],
      });
      observer.complete();
    }))),
  });
  clients.push(client);
  return client;
}

describe("Affiliate permission error localization", () => {
  it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])("localizes other-BD denials in %s without losing error metadata", async (language) => {
    await i18n.changeLanguage(language);
    const message = i18n.t("ecommerce.affiliateWorkspace.workbench.otherBdOperationForbidden");
    expect(message).not.toContain("ecommerce.");
    await expect(clientFor("AFFILIATE_CREATOR_OWNED_BY_OTHER_BD").mutate({ mutation })).rejects.toMatchObject({
      message,
      errors: [{ message, path: ["reviewSample"], extensions: { code: "FORBIDDEN", reason: "AFFILIATE_CREATOR_OWNED_BY_OTHER_BD", entity: "AffiliateCreatorRelationship" } }],
    });
  });

  it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])("localizes region-scope denials in %s", async (language) => {
    await i18n.changeLanguage(language);
    const message = i18n.t("ecommerce.affiliateStaff.creatorOutsideRegionScope");
    expect(message).not.toContain("ecommerce.");
    await expect(clientFor("AFFILIATE_CREATOR_OUTSIDE_REGION_SCOPE").mutate({ mutation })).rejects.toMatchObject({
      message,
      errors: [{ message, extensions: { code: "FORBIDDEN", reason: "AFFILIATE_CREATOR_OUTSIDE_REGION_SCOPE" } }],
    });
  });

  it.each([
    ["AFFILIATE_TARGET_BD_OUTSIDE_REGION_OVERLAP", "targetOutsideRegionOverlap"],
    ["AFFILIATE_CREATOR_OUTSIDE_TEAM_LEAD_SCOPE", "creatorOutsideTeamLeadScope"],
    ["AFFILIATE_TARGET_BD_OUTSIDE_TEAM_LEAD_SCOPE", "targetOutsideTeamLeadScope"],
    ["AFFILIATE_OPERATOR_OUTSIDE_SCOPE", "operatorOutsideScope"],
  ])("localizes the ADR-113 denial %s", async (reason, key) => {
    await i18n.changeLanguage("zh");
    const message = i18n.t(`ecommerce.affiliateStaff.${key}`);
    expect(message).not.toContain("ecommerce.");
    await expect(clientFor(reason).mutate({ mutation })).rejects.toMatchObject({ message });
  });

  it("uses the language current at response time and keeps configuration denials distinct from other-BD denials", async () => {
    await i18n.changeLanguage("en");
    const client = clientFor("AFFILIATE_OPERATION_NOT_PERMITTED");
    await i18n.changeLanguage("zh");
    await expect(client.mutate({ mutation })).rejects.toMatchObject({ message: "你没有执行此达人业务操作的权限。" });
  });

  it.each([
    ["UNKNOWN_REASON", "FORBIDDEN"],
    ["AFFILIATE_CREATOR_OWNED_BY_OTHER_BD", "NOT_FOUND"],
  ])("leaves unrelated errors untouched (%s, %s)", async (reason, code) => {
    await expect(clientFor(reason, code).mutate({ mutation })).rejects.toMatchObject({ message: "Server fallback" });
  });

  it("does not swallow network failures", async () => {
    const failure = new Error("Network failed");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: createAffiliatePermissionErrorLink().concat(new ApolloLink(() => new Observable((observer) => observer.error(failure)))),
    });
    clients.push(client);
    await expect(client.mutate({ mutation })).rejects.toBe(failure);
  });
});
