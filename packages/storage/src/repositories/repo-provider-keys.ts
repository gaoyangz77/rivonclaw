import type Database from "better-sqlite3";
import type { ProviderKeyEntry, ProviderKeyAuthType } from "@rivonclaw/core";

interface ProviderMetadataRow {
  id: string;
  product_provider: string;
  label: string;
  preferred_model: string;
  proxy_base_url: string | null;
  product_auth_kind: string;
  source: string;
  oauth_expires_at: number | null;
  created_at: string;
  updated_at: string;
}

export type ProviderRuntimeProjector = (entries: ProviderKeyEntry[]) => ProviderKeyEntry[];

function rowToEntry(row: ProviderMetadataRow): ProviderKeyEntry {
  return {
    id: row.id,
    provider: row.product_provider,
    label: row.label,
    model: row.preferred_model,
    isDefault: false,
    proxyBaseUrl: row.proxy_base_url,
    authType: (row.product_auth_kind as ProviderKeyAuthType) ?? "api_key",
    baseUrl: null,
    customProtocol: null,
    customModelsJson: null,
    source: (row.source as "local" | "cloud") ?? "local",
    oauthExpiresAt: row.oauth_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProviderKeysRepository {
  private runtimeProjector: ProviderRuntimeProjector | undefined;

  constructor(private db: Database.Database) {}

  /**
   * Join product-only metadata with the Vendor-owned runtime state.
   *
   * Storage deliberately has no dependency on OpenClaw. Desktop installs this
   * adapter once config/auth paths are known.
   */
  setRuntimeProjector(projector: ProviderRuntimeProjector): void {
    this.runtimeProjector = projector;
  }

  private getAllMetadata(): ProviderKeyEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM provider_metadata ORDER BY product_provider ASC, created_at ASC")
      .all() as ProviderMetadataRow[];
    return rows.map(rowToEntry);
  }

  private project(entries: ProviderKeyEntry[]): ProviderKeyEntry[] {
    return this.runtimeProjector ? this.runtimeProjector(entries) : entries;
  }

  create(entry: ProviderKeyEntry): ProviderKeyEntry {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO provider_metadata (id, product_provider, label, preferred_model, proxy_base_url, product_auth_kind, source, oauth_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        entry.id,
        entry.provider,
        entry.label,
        entry.model,
        entry.proxyBaseUrl ?? null,
        entry.authType ?? "api_key",
        entry.source ?? "local",
        entry.oauthExpiresAt ?? null,
        now,
        now,
      );

    return { ...entry, source: entry.source ?? "local", createdAt: now, updatedAt: now };
  }

  getById(id: string): ProviderKeyEntry | undefined {
    return this.getAll().find((entry) => entry.id === id);
  }

  getByProvider(provider: string): ProviderKeyEntry[] {
    return this.getAll().filter((entry) => entry.provider === provider);
  }

  getAll(): ProviderKeyEntry[] {
    return this.project(this.getAllMetadata());
  }

  getDefault(provider: string): ProviderKeyEntry | undefined {
    return this.getAll().find((entry) => entry.provider === provider && entry.isDefault);
  }

  update(
    id: string,
    fields: Partial<
      Pick<
        ProviderKeyEntry,
        | "label"
        | "model"
        | "isDefault"
        | "proxyBaseUrl"
        | "authType"
        | "baseUrl"
        | "customProtocol"
        | "customModelsJson"
        | "inputModalities"
        | "source"
        | "oauthExpiresAt"
      >
    >,
  ): ProviderKeyEntry | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const updated: ProviderKeyEntry = {
      ...existing,
      label: fields.label ?? existing.label,
      model: fields.model ?? existing.model,
      isDefault: fields.isDefault !== undefined ? fields.isDefault : existing.isDefault,
      proxyBaseUrl: fields.proxyBaseUrl !== undefined ? fields.proxyBaseUrl : existing.proxyBaseUrl,
      authType: fields.authType ?? existing.authType,
      baseUrl: fields.baseUrl !== undefined ? fields.baseUrl : existing.baseUrl,
      customProtocol:
        fields.customProtocol !== undefined ? fields.customProtocol : existing.customProtocol,
      customModelsJson:
        fields.customModelsJson !== undefined ? fields.customModelsJson : existing.customModelsJson,
      inputModalities:
        fields.inputModalities !== undefined ? fields.inputModalities : existing.inputModalities,
      source: fields.source ?? existing.source,
      oauthExpiresAt:
        fields.oauthExpiresAt !== undefined ? fields.oauthExpiresAt : existing.oauthExpiresAt,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        "UPDATE provider_metadata SET label = ?, preferred_model = ?, proxy_base_url = ?, product_auth_kind = ?, source = ?, oauth_expires_at = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        updated.label,
        updated.model,
        updated.proxyBaseUrl ?? null,
        updated.authType,
        updated.source ?? "local",
        updated.oauthExpiresAt ?? null,
        updated.updatedAt,
        id,
      );

    return updated;
  }

  /**
   * Return the single globally active key (is_default = 1).
   */
  getActive(): ProviderKeyEntry | undefined {
    return this.getAll().find((entry) => entry.isDefault);
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM provider_metadata WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
