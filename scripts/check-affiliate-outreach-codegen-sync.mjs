#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaPath = join(root, "server/backend/schema.graphql");
const generatedPath = join(root, "packages/core/src/generated/graphql.ts");

const schema = readFileSync(schemaPath, "utf8");
const generated = readFileSync(generatedPath, "utf8");

const checks = [];

function addCheck(name, ok, details = "") {
  checks.push({ name, ok, details });
}

function block(source, kind, name) {
  const pattern = new RegExp(`${kind}\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  return source.match(pattern)?.[1] ?? "";
}

function generatedInterface(name) {
  return block(generated, "export interface", name);
}

function generatedConst(name) {
  const pattern = new RegExp(`export const ${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}\\s+as const;`, "m");
  return generated.match(pattern)?.[1] ?? "";
}

function hasLine(source, expected) {
  return source.split(/\r?\n/).some((line) => line.trim() === expected);
}

function hasSnippet(source, expected) {
  return source.includes(expected);
}

const signalSchema = block(schema, "type", "AffiliateRelationshipSignal");
const signalGenerated = generatedInterface("AffiliateRelationshipSignal");
addCheck(
  "AffiliateRelationshipSignal.channel is in backend schema",
  hasLine(signalSchema, "channel: AffiliateMessageChannel"),
);
addCheck(
  "AffiliateRelationshipSignal.channel is in core generated type",
  hasLine(signalGenerated, "channel?: Maybe<AffiliateMessageChannel>;"),
);
addCheck(
  "AffiliateRelationshipSignal.creatorRelationshipId is in core generated type",
  hasLine(signalGenerated, "creatorRelationshipId?: Maybe<Scalars['ID']['output']>;"),
);

const publishSignalSchema = block(schema, "input", "PublishAffiliateRelationshipSignalInput");
const publishSignalGenerated = generatedInterface("PublishAffiliateRelationshipSignalInput");
addCheck(
  "PublishAffiliateRelationshipSignalInput.channel is in backend schema",
  hasLine(publishSignalSchema, "channel: AffiliateMessageChannel"),
);
addCheck(
  "PublishAffiliateRelationshipSignalInput.channel is in core generated type",
  hasLine(publishSignalGenerated, "channel?: InputMaybe<AffiliateMessageChannel>;"),
);

const messageChannelSchema = block(schema, "enum", "AffiliateMessageChannel");
const messageChannelGenerated = generatedConst("AffiliateMessageChannel");
for (const value of ["EMAIL", "PLATFORM_CHAT", "WHATSAPP"]) {
  addCheck(
    `AffiliateMessageChannel.${value} is in backend schema`,
    hasLine(messageChannelSchema, value),
  );
}
addCheck(
  "AffiliateMessageChannel.Email is in core generated const",
  hasSnippet(messageChannelGenerated, "Email: 'EMAIL'"),
);
addCheck(
  "AffiliateMessageChannel.PlatformChat is in core generated const",
  hasSnippet(messageChannelGenerated, "PlatformChat: 'PLATFORM_CHAT'"),
);
addCheck(
  "AffiliateMessageChannel.Whatsapp is in core generated const",
  hasSnippet(messageChannelGenerated, "Whatsapp: 'WHATSAPP'"),
);

const deliveryInputSchema = block(schema, "input", "ResolveAffiliateWorkItemActionInput");
const deliveryInputGenerated = generatedInterface("ResolveAffiliateWorkItemActionInput");
addCheck(
  "ResolveAffiliateWorkItemActionInput.preferredChannel is in backend schema",
  hasLine(deliveryInputSchema, "preferredChannel: AffiliateMessageChannel"),
);
addCheck(
  "ResolveAffiliateWorkItemActionInput.preferredChannel is in core generated type",
  hasLine(deliveryInputGenerated, "preferredChannel?: InputMaybe<AffiliateMessageChannel>;"),
);
addCheck(
  "ResolveAffiliateWorkItemActionInput.emailSubject is in backend schema",
  hasLine(deliveryInputSchema, "emailSubject: String"),
);
addCheck(
  "ResolveAffiliateWorkItemActionInput.emailSubject is in core generated type",
  hasLine(deliveryInputGenerated, "emailSubject?: InputMaybe<Scalars['String']['input']>;"),
);

const workItemSchema = block(schema, "type", "AffiliateWorkItem");
const workItemGenerated = generatedInterface("AffiliateWorkItem");
for (const field of ["triggerChannel: AffiliateMessageChannel", "triggerLifecycleEventId: ID"]) {
  addCheck(`AffiliateWorkItem.${field.split(":")[0]} is in backend schema`, hasLine(workItemSchema, field));
}
addCheck(
  "AffiliateWorkItem.triggerChannel is in core generated type",
  hasLine(workItemGenerated, "triggerChannel?: Maybe<AffiliateMessageChannel>;"),
);
addCheck(
  "AffiliateWorkItem.triggerLifecycleEventId is in core generated type",
  hasLine(workItemGenerated, "triggerLifecycleEventId?: Maybe<Scalars['ID']['output']>;"),
);
addCheck(
  "Legacy affiliate final-text delivery bridge is absent",
  !schema.includes("deliverAffiliateCreatorText") &&
    !schema.includes("DeliverAffiliateCreatorTextInput") &&
    !generated.includes("DeliverAffiliateCreatorTextInput"),
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const status = check.ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${check.name}${check.details ? ` ${check.details}` : ""}`);
}

if (failed.length > 0) {
  console.error(`Affiliate outreach schema/codegen sync check failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`Affiliate outreach schema/codegen sync check passed: ${checks.length} checks.`);
