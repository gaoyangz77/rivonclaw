import type { Database } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

export interface MobilePairing {
    id: string;
    deviceId: string;
    accessToken: string;
    relayUrl: string;
    createdAt: string;
    expiresAt?: string;
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

    public setPairing(pairing: Omit<MobilePairing, "id" | "createdAt">): MobilePairing {
        // In V0, we only support one active pairing at a time
        this.db.prepare("DELETE FROM mobile_pairings").run();

        const id = uuidv4();
        const createdAt = new Date().toISOString();

        this.db.prepare(`
      INSERT INTO mobile_pairings (id, device_id, access_token, relay_url, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
            id,
            pairing.deviceId,
            pairing.accessToken,
            pairing.relayUrl,
            createdAt,
            pairing.expiresAt || null
        );

        return { ...pairing, id, createdAt };
    }

    public clearPairing(): void {
        this.db.prepare("DELETE FROM mobile_pairings").run();
    }

    private toEntity(row: any): MobilePairing {
        return {
            id: row.id,
            deviceId: row.device_id,
            accessToken: row.access_token,
            relayUrl: row.relay_url,
            createdAt: row.created_at,
            expiresAt: row.expires_at || undefined,
        };
    }
}
