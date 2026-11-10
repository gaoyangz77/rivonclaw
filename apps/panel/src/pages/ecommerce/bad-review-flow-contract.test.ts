// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import {
  buildSchema,
  graphql,
  isEnumType,
  isListType,
  isNonNullType,
  isScalarType,
  print,
  type GraphQLFieldResolver,
  type GraphQLOutputType,
  type GraphQLTypeResolver,
} from "graphql";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { START_BAD_REVIEW_BULK_FOLLOW_UP_MUTATION } from "../../api/bad-review-queries.js";
import { readBadReviewWorkbook } from "./bad-review-import.js";
import { CustomerServiceWorkspaceModel } from "../../store/models/CustomerServiceWorkspaceModel.js";
import { EcommerceBadReviewModel } from "../../store/models/EcommerceBadReviewModel.js";

/**
 * Runs the bad-review flows through a real Apollo client and the Backend schema, as production does:
 * Apollo adds `__typename` to every result, and the schema coerces every variable. A unit test that
 * mocks `mutate` sees neither, which is how a translation result once reached an input type intact.
 * Resolvers return generated values; only what crosses the wire is under test here.
 */
const schema = buildSchema(
  readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"),
);

function generated(type: GraphQLOutputType, name: string): unknown {
  if (isNonNullType(type)) return generated(type.ofType, name);
  if (isListType(type)) return [generated(type.ofType, name)];
  if (isEnumType(type)) return type.getValues()[0]!.value;
  if (isScalarType(type)) {
    switch (type.name) {
      case "Int":
      case "Float":
        return 1;
      case "Boolean":
        return false;
      case "DateTimeISO":
        return "2026-11-01T00:00:00.000Z";
      case "JSONObject":
        return {};
      default:
        return `${name}-1`;
    }
  }
  return {};
}

interface RootCall {
  field: string;
  args: Record<string, unknown>;
}

function backend() {
  const calls: RootCall[] = [];
  const fieldResolver: GraphQLFieldResolver<unknown, unknown> = (source, args, _context, info) => {
    const isRoot =
      info.parentType === schema.getQueryType() || info.parentType === schema.getMutationType();
    if (isRoot) calls.push({ field: info.fieldName, args });
    const own = (source as Record<string, unknown> | undefined)?.[info.fieldName];
    return own !== undefined ? own : generated(info.returnType, info.fieldName);
  };
  const typeResolver: GraphQLTypeResolver<unknown, unknown> = (_value, _context, _info, abstractType) =>
    schema.getPossibleTypes(abstractType)[0]!.name;
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        graphql({
          schema,
          source: print(operation.query),
          variableValues: operation.variables,
          operationName: operation.operationName,
          fieldResolver,
          typeResolver,
        }).then(
          (result) => {
            observer.next(result as never);
            observer.complete();
          },
          (error: unknown) => observer.error(error),
        );
      }),
  );
  const apolloClient = new ApolloClient({ link, cache: new InMemoryCache() });
  return { apolloClient, calls, fields: () => calls.map((call) => call.field) };
}

function badReviewStore() {
  const server = backend();
  const store = EcommerceBadReviewModel.create({}, { apolloClient: server.apolloClient });
  store.setShopScope(["shop-1"], 2);
  return { ...server, store };
}

describe("bad-review flows against the Backend schema", () => {
  it("rejects what the Backend rejects: a result object passed back as input", async () => {
    const { apolloClient } = backend();
    await expect(
      apolloClient.mutate({
        mutation: START_BAD_REVIEW_BULK_FOLLOW_UP_MUTATION,
        variables: {
          reviewIds: ["review-1"],
          messages: [{ __typename: "EcomBadReviewBulkMessage", language: "DE", text: "Hallo" }],
        },
      }),
    ).rejects.toThrow(/__typename/);
  });

  it("lists with every filter set and turns the page", async () => {
    const { store, fields } = badReviewStore();
    store.setRating(2);
    store.setHandlingStatus(GQL.ProductReviewHandlingStatus.InProgress);
    store.setSource(GQL.ProductReviewSource.ManualImport);
    store.setInProgressOverDays(7);
    await store.fetchReviews();
    expect(store.error).toBeNull();
    expect(store.rows.length).toBe(1);
    store.setPage(2);
    await store.fetchReviews();
    await store.refreshInBackground();
    expect(store.error).toBeNull();
    expect(fields()).toEqual(["ecommerceBadReviews", "ecommerceBadReviews", "ecommerceBadReviews"]);
  });

  it("starts follow-up and updates the status of a listed review", async () => {
    const { store, calls } = badReviewStore();
    await store.fetchReviews();
    const row = store.rows[0]!;
    await expect(store.startFollowUp(row.shopId, row.id)).resolves.toBeTruthy();
    await store.updateFollowUpStatus(row.shopId, row.id, GQL.ProductReviewHandlingStatus.Closed, "done");
    expect(store.actionError).toBeNull();
    expect(calls.slice(1).map((call) => call.field)).toEqual([
      "ecommerceStartBadReviewFollowUp",
      "ecommerceUpdateBadReviewFollowUpStatus",
    ]);
  });

  it("sends a bulk follow-up with the translations exactly as the modal holds them", async () => {
    const { store, calls } = badReviewStore();
    const preview = await store.previewBulkFollowUp(["review-1"]);
    const translations = await store.translateBulkMessage(
      "Sorry",
      preview.languages.map((entry) => entry.language),
    );
    // The modal edits translations by spreading them, so the result's __typename stays on each one.
    const edited = translations.map((entry) => ({ ...entry, text: `${entry.text} (edited)` }));
    const batch = await store.startBulkFollowUp(["review-1"], edited);
    await store.readBulkFollowUp(batch.id);
    const start = calls.find((call) => call.field === "ecommerceStartBadReviewBulkFollowUp")!;
    expect(start.args.messages).toEqual(edited.map(({ language, text }) => ({ language, text })));
  });

  it("previews and applies a workbook typed the way sellers type it", async () => {
    const { store, calls } = badReviewStore();
    const sheet = XLSX.utils.aoa_to_sheet(
      [
        ["订单号", "差评原因", "差评星级", "差评时间", "跟进状态", "备注"],
        ["576966216039176770", "Arrived broken", 1, "", "", ""],
        ["576969006386551297", "", "2", "2026-11-02 08:30:00", "", "called"],
        ["576965759515924745", "", "", "", "已结束", ""],
      ],
    );
    // A real date cell, as Excel stores it: a day serial with a date format, no time zone.
    const serial = (Date.UTC(2026, 10, 1, 10, 0, 0) - Date.UTC(1899, 11, 30)) / 86_400_000;
    sheet.D2 = { t: "n", v: serial, z: "yyyy-mm-dd hh:mm:ss" };
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "差评导入");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const rows = readBadReviewWorkbook(XLSX, bytes);
    expect(rows.map((row) => [row.orderId, row.stars, row.reviewTime, row.status])).toEqual([
      ["576966216039176770", "1", "2026-11-01 10:00:00", null],
      ["576969006386551297", "2", "2026-11-02 08:30:00", null],
      ["576965759515924745", null, null, "已结束"],
    ]);
    await store.previewImport(rows);
    await store.applyImport(rows);
    expect(store.error).toBeNull();
    expect(calls.map((call) => call.field)).toEqual([
      "ecommercePreviewBadReviewImport",
      "ecommerceApplyBadReviewImport",
      "ecommerceBadReviews",
    ]);
  });

  it("opens a review's order on the conversations page through the order search", async () => {
    const { apolloClient, calls } = backend();
    const workspace = CustomerServiceWorkspaceModel.create({}, { apolloClient });
    workspace.focusConversationOrder("576966216039176770");
    await expect.poll(() => workspace.conversationsLoading).toBe(false);
    expect(workspace.conversationsError ?? null).toBeNull();
    expect(calls[0]).toMatchObject({
      field: "ecommerceGetCustomerServiceInbox",
      args: { search: "576966216039176770" },
    });
  });
});
