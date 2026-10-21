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
