import type { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

export interface MobilePairing {
    id: string;
    pairingId?: string;
    deviceId: string;
    accessToken: string;
    relayUrl: string;
    createdAt: string;
    expiresAt?: string;
    mobileDeviceId?: string;
    name?: string;
    status?: 'active' | 'stale';
}

export class RepoMobilePairings {
    constructor(private db: Database) { }

    public getActivePairing(): MobilePairing | undefined {
        const row = this.db.prepare(`
      SELECT * FROM mobile_pairings
      ORDER BY created_at DESC
      LIMIT 1
    `).get() as any;

        if (!row) return undefined;
        return this.toEntity(row);
    }

    public getAllPairings(): MobilePairing[] {
        const rows = this.db.prepare(`
      SELECT * FROM mobile_pairings
      ORDER BY created_at DESC
    `).all() as any[];

        return rows.map(r => this.toEntity(r));
    }

    public setPairing(pairing: Omit<MobilePairing, "id" | "createdAt">): MobilePairing {
        const createdAt = new Date().toISOString();

        // Upsert: if same pairingId exists, update it; otherwise insert new
        if (pairing.pairingId) {
            const existing = this.db.prepare(
                `SELECT id FROM mobile_pairings WHERE pairing_id = ?`
            ).get(pairing.pairingId) as any;

            if (existing) {
                this.db.prepare(`
          UPDATE mobile_pairings
          SET device_id = ?, access_token = ?, relay_url = ?, expires_at = ?, name = ?, mobile_device_id = ?, status = 'active'
          WHERE id = ?
        `).run(
                    pairing.deviceId,
                    pairing.accessToken,
                    pairing.relayUrl,
                    pairing.expiresAt || null,
                    pairing.name || null,
                    pairing.mobileDeviceId || null,
                    existing.id,
                );

                return { ...pairing, id: existing.id, createdAt };
            }
        }

        const id = uuidv4();

        this.db.prepare(`
      INSERT INTO mobile_pairings (id, device_id, access_token, relay_url, created_at, expires_at, mobile_device_id, name, pairing_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            pairing.deviceId,
            pairing.accessToken,
            pairing.relayUrl,
            createdAt,
            pairing.expiresAt || null,
            pairing.mobileDeviceId || null,
            pairing.name || null,
            pairing.pairingId || null,
        );

        return { ...pairing, id, createdAt };
    }

    public markPairingStale(id: string): void {
        this.db.prepare("UPDATE mobile_pairings SET status = 'stale' WHERE id = ?").run(id);
    }

    public removePairingById(id: string): void {
        this.db.prepare("DELETE FROM mobile_pairings WHERE id = ?").run(id);
    }

    public clearPairing(): void {
        this.db.prepare("DELETE FROM mobile_pairings").run();
    }

    private toEntity(row: any): MobilePairing {
        return {
            id: row.id,
            pairingId: row.pairing_id || undefined,
            deviceId: row.device_id,
            accessToken: row.access_token,
            relayUrl: row.relay_url,
            createdAt: row.created_at,
            expiresAt: row.expires_at || undefined,
            mobileDeviceId: row.mobile_device_id || undefined,
            name: row.name || undefined,
            status: row.status || 'active',
        };
    }
}
