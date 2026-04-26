import type Database from "better-sqlite3";
import { openDatabase, closeDatabase } from "./db/database.js";
import { ChannelsRepository } from "./repositories/repo-channels.js";
import { PermissionsRepository } from "./repositories/repo-permissions.js";
import { SettingsRepository } from "./repositories/repo-settings.js";
import { ProviderKeysRepository } from "./repositories/repo-provider-keys.js";
import { UsageSnapshotsRepository } from "./repositories/repo-usage-snapshots.js";
import { KeyUsageHistoryRepository } from "./repositories/repo-key-usage-history.js";
import { ChatSessionsRepository } from "./repositories/repo-chat-sessions.js";
import { ChannelRecipientsRepository } from "./repositories/repo-channel-recipients.js";
import { RepoMobilePairings } from "./repositories/repo-mobile-pairings.js";
import { ToolSelectionsRepository } from "./repositories/repo-tool-selections.js";
import { ChannelAccountsRepository } from "./repositories/repo-channel-accounts.js";
import { CsEscalationsRepository } from "./repositories/repo-cs-escalations.js";
export interface Storage {
  db: Database.Database;
  channels: ChannelsRepository;
  permissions: PermissionsRepository;
  settings: SettingsRepository;
  providerKeys: ProviderKeysRepository;
  usageSnapshots: UsageSnapshotsRepository;
  keyUsageHistory: KeyUsageHistoryRepository;
  chatSessions: ChatSessionsRepository;
  channelRecipients: ChannelRecipientsRepository;
  mobilePairings: RepoMobilePairings;
  toolSelections: ToolSelectionsRepository;
  channelAccounts: ChannelAccountsRepository;
  csEscalations: CsEscalationsRepository;
  close(): void;
}

export function createStorage(dbPath?: string): Storage {
  const db = openDatabase(dbPath);

  return {
    db,
    channels: new ChannelsRepository(db),
    permissions: new PermissionsRepository(db),
    settings: new SettingsRepository(db),
    providerKeys: new ProviderKeysRepository(db),
    usageSnapshots: new UsageSnapshotsRepository(db),
    keyUsageHistory: new KeyUsageHistoryRepository(db),
    chatSessions: new ChatSessionsRepository(db),
    channelRecipients: new ChannelRecipientsRepository(db),
    mobilePairings: new RepoMobilePairings(db),
    toolSelections: new ToolSelectionsRepository(db),
    channelAccounts: new ChannelAccountsRepository(db),
    csEscalations: new CsEscalationsRepository(db),
    close() {
      closeDatabase(db);
    },
  };
}

export { openDatabase, closeDatabase } from "./db/database.js";
export { ChannelsRepository } from "./repositories/repo-channels.js";
export { PermissionsRepository } from "./repositories/repo-permissions.js";
export { SettingsRepository } from "./repositories/repo-settings.js";
export { ProviderKeysRepository } from "./repositories/repo-provider-keys.js";
export { UsageSnapshotsRepository } from "./repositories/repo-usage-snapshots.js";
export { KeyUsageHistoryRepository } from "./repositories/repo-key-usage-history.js";
export { ChatSessionsRepository } from "./repositories/repo-chat-sessions.js";
export { ChannelRecipientsRepository } from "./repositories/repo-channel-recipients.js";
export { RepoMobilePairings } from "./repositories/repo-mobile-pairings.js";
export { ToolSelectionsRepository } from "./repositories/repo-tool-selections.js";
export { ChannelAccountsRepository } from "./repositories/repo-channel-accounts.js";
export { CsEscalationsRepository } from "./repositories/repo-cs-escalations.js";
export type { MobilePairing } from "./repositories/repo-mobile-pairings.js";
export type { ChatSession } from "./repositories/repo-chat-sessions.js";
export type { ChannelRecipient } from "./repositories/repo-channel-recipients.js";
export type { ChannelAccount } from "./repositories/repo-channel-accounts.js";
export type { CsEscalation } from "./repositories/repo-cs-escalations.js";
export type { Migration } from "./db/migrations.js";
