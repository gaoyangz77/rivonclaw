import { afterEach, describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../i18n/index.js";
import { formatAffiliateActor } from "./affiliate-actor.js";

afterEach(async () => {
  await i18n.changeLanguage("zh");
});

const kinds = GQL.AffiliateActorDisplayKind;

describe("formatAffiliateActor", () => {
  it("labels every actor kind in Chinese", async () => {
    await i18n.changeLanguage("zh");
    const t = i18n.t.bind(i18n);
    expect(formatAffiliateActor({ kind: kinds.Owner }, t)).toBe("主账号");
    expect(formatAffiliateActor({ kind: kinds.BusinessDeveloper, displayName: "孙浩鹏" }, t)).toBe(
      "孙浩鹏",
    );
    expect(formatAffiliateActor({ kind: kinds.Member, displayName: "李四" }, t)).toBe("李四");
    expect(formatAffiliateActor({ kind: kinds.DeletedMember }, t)).toBe("已删除的账号");
    expect(formatAffiliateActor({ kind: kinds.UnknownHuman }, t)).toBe("人工");
    expect(formatAffiliateActor({ kind: kinds.Agent }, t)).toBe("Agent");
    expect(formatAffiliateActor({ kind: kinds.System }, t)).toBe("系统");
  });

  it("labels every actor kind in English", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.t.bind(i18n);
    expect(formatAffiliateActor({ kind: kinds.Owner }, t)).toBe("Owner account");
    expect(formatAffiliateActor({ kind: kinds.BusinessDeveloper, displayName: "Sam" }, t)).toBe(
      "Sam",
    );
    expect(formatAffiliateActor({ kind: kinds.Member, displayName: "Lee" }, t)).toBe("Lee");
    expect(formatAffiliateActor({ kind: kinds.DeletedMember }, t)).toBe("Deleted account");
    expect(formatAffiliateActor({ kind: kinds.UnknownHuman }, t)).toBe("Staff");
    expect(formatAffiliateActor({ kind: kinds.Agent }, t)).toBe("Agent");
    expect(formatAffiliateActor({ kind: kinds.System }, t)).toBe("System");
  });

  it("names a business developer by name alone, with no role suffix", () => {
    const t = i18n.t.bind(i18n);
    expect(formatAffiliateActor({ kind: kinds.BusinessDeveloper, displayName: "孙浩鹏" }, t)).toBe(
      "孙浩鹏",
    );
    expect(formatAffiliateActor({ kind: kinds.Member, displayName: "李四" }, t)).toBe("李四");
  });

  it("falls back to the generic staff label when a named kind has no name", () => {
    const t = i18n.t.bind(i18n);
    expect(formatAffiliateActor({ kind: kinds.Member, displayName: null }, t)).toBe("人工");
    expect(formatAffiliateActor({ kind: kinds.BusinessDeveloper, displayName: "  " }, t)).toBe(
      "人工",
    );
  });
});
