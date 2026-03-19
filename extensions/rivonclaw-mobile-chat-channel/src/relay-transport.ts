/**
 * Shared WebSocket transport for multiplexed relay connections (Node.js / desktop).
 * One transport manages a single WebSocket connection, with multiple
 * pairings multiplexed by pairingId.
 */

import { WebSocket } from 'ws';

export type TransportStatus = 'connecting' | 'online' | 'offline';
export type MessageHandler = (msg: any) => void;

interface PendingJoin {
    resolve: (result: { pairingId: string; peerOnline: boolean }) => void;
    reject: (err: Error) => void;
    accessToken: string;
}

export class RelayTransport {
    private ws: WebSocket | null = null;
    private status: TransportStatus = 'offline';
    private handlers: Map<string, MessageHandler> = new Map();       // pairingId -> handler
    private pairingTokens: Map<string, string> = new Map();          // pairingId -> accessToken
    private statusSubscribers: Set<(status: TransportStatus) => void> = new Set();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private stopped = false;
    private relayUrl: string = '';
    private pendingJoins: Map<string, PendingJoin> = new Map();      // accessToken -> pending
    private rejoinPending = false;
    private authFailCount = 0;

    /**
     * Start the transport with the initial pairing credentials.
     */
    start(relayUrl: string, accessToken: string, pairingId: string): void {
        this.stopped = false;
        this.relayUrl = relayUrl;
        this.pairingTokens.set(pairingId, accessToken);
        this.connect();
    }

    /**
     * Add a new pairing to this transport.
     */
    async joinPairing(pairingId: string, accessToken: string): Promise<{ pairingId: string; peerOnline: boolean }> {
        this.pairingTokens.set(pairingId, accessToken);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return new Promise((resolve, reject) => {
                this.pendingJoins.set(accessToken, { resolve, reject, accessToken });
                this.ws!.send(JSON.stringify({ type: 'join', accessToken }));

                setTimeout(() => {
                    if (this.pendingJoins.has(accessToken)) {
                        this.pendingJoins.delete(accessToken);
                        reject(new Error('join timeout'));
                    }
                }, 10_000);
            });
        }

        return { pairingId, peerOnline: false };
    }

    leavePairing(pairingId: string): void {
        this.pairingTokens.delete(pairingId);
        this.handlers.delete(pairingId);
    }

    send(pairingId: string, message: object): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.rejoinPending) return;
        this.ws.send(JSON.stringify({ ...message, pairingId }), (err) => {
            if (err) console.error(`[DesktopRelayTransport] ws.send error:`, err);
        });
    }

    registerHandler(pairingId: string, handler: MessageHandler): void {
        this.handlers.set(pairingId, handler);
    }

    unregisterHandler(pairingId: string): void {
        this.handlers.delete(pairingId);
    }

    subscribeStatus(cb: (status: TransportStatus) => void): () => void {
        this.statusSubscribers.add(cb);
        cb(this.status);
        return () => this.statusSubscribers.delete(cb);
    }

    getStatus(): TransportStatus {
        return this.status;
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    hasPairings(): boolean {
        return this.pairingTokens.size > 0;
    }

    disconnect(): void {
        this.stopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            try { this.ws.close(); } catch (_) { /* ignore */ }
            this.ws = null;
        }
        this.updateStatus('offline');
        this.pairingTokens.clear();
        this.handlers.clear();
        for (const pending of this.pendingJoins.values()) {
            pending.reject(new Error('transport disconnected'));
        }
        this.pendingJoins.clear();
    }

    // --- Internal ---

    /**
     * If the relay returned a real pairingId that differs from our local key
     * (e.g. old DB records keyed by mobileDeviceId), re-key all internal maps.
     */
    private rekeyIfNeeded(realPairingId: string, accessToken: string): void {
        for (const [oldKey, token] of this.pairingTokens) {
            if (token === accessToken && oldKey !== realPairingId) {
                this.pairingTokens.delete(oldKey);
                this.pairingTokens.set(realPairingId, token);
                const handler = this.handlers.get(oldKey);
                if (handler) {
                    this.handlers.delete(oldKey);
                    this.handlers.set(realPairingId, handler);
                }
                break;
            }
        }
    }

    private connect(): void {
        if (this.stopped || this.pairingTokens.size === 0) return;

        if (this.ws) {
            this.ws.removeAllListeners();
            try { this.ws.close(); } catch (_) { /* ignore */ }
            this.ws = null;
        }

        this.updateStatus('connecting');

        const [_firstPairingId, firstToken] = this.pairingTokens.entries().next().value!;

        let routeUrl = this.relayUrl.endsWith('/')
            ? `${this.relayUrl}mobile-chat`
            : `${this.relayUrl}/mobile-chat`;

        const wsUrl = `${routeUrl}?token=${firstToken}&client=desktop`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                // Don't set 'online' yet — wait for rejoin_ack so pairings are registered
                // on the relay before any business messages are sent.
                this.rejoinPending = true;
                this.authFailCount = 0;

                // Send rejoin for all pairings
                const tokens = Array.from(this.pairingTokens.values());
                if (tokens.length > 0) {
                    this.ws!.send(JSON.stringify({ type: 'rejoin', tokens }));
                } else {
                    // No pairings to rejoin — go online immediately
                    this.rejoinPending = false;
                    this.updateStatus('online');
                }
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString('utf-8'));
                    this.handleIncoming(msg);
                } catch (err: any) {
                    console.error('[DesktopRelayTransport] Invalid WS payload:', err.message);
                }
            });

            this.ws.on('close', (code: number) => {
                this.ws = null;
                this.rejoinPending = false;
                this.updateStatus('offline');
                this.scheduleReconnect(code);
            });

            this.ws.on('error', (err) => {
                console.error('[DesktopRelayTransport] WebSocket error:', err.message);
                this.ws?.close();
            });

        } catch (err: any) {
            console.error('[DesktopRelayTransport] Failed to initialize WebSocket:', err.message);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(closeCode?: number): void {
        if (this.stopped) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        let delay: number;
        if (closeCode === 4001) {
            // Auth failure — exponential backoff: 3s, 6s, 12s, 24s, 60s, 60s...
            this.authFailCount++;
            delay = Math.min(3000 * Math.pow(2, this.authFailCount - 1), 60_000);
        } else {
            this.authFailCount = 0;
            delay = 3000;
        }

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    private handleIncoming(data: any): void {
        if (data.type === 'join_ack') {
            const pending = this.pendingJoins.get(data.accessToken);
            if (pending) {
                this.pendingJoins.delete(data.accessToken);
                if (data.pairingId && data.accessToken) {
                    this.rekeyIfNeeded(data.pairingId, data.accessToken);
                }
                pending.resolve({ pairingId: data.pairingId, peerOnline: data.peerOnline });
            }
            return;
        }

        if (data.type === 'join_err') {
            const pending = this.pendingJoins.get(data.accessToken);
            if (pending) {
                this.pendingJoins.delete(data.accessToken);
                pending.reject(new Error(data.error || 'join failed'));
            }
            return;
        }

        if (data.type === 'rejoin_ack') {
            if (Array.isArray(data.pairings)) {
                for (const p of data.pairings) {
                    // The relay returns the real pairingId from backend.
                    // If our local key differs (e.g. old DB record without pairingId),
                    // re-key our internal maps so future messages route correctly.
                    if (p.accessToken) {
                        this.rekeyIfNeeded(p.pairingId, p.accessToken);
                    }

                    const handler = this.handlers.get(p.pairingId);
                    if (handler) {
                        handler({ type: 'peer_status', pairingId: p.pairingId, status: p.peerOnline ? 'online' : 'offline' });
                    }
                }
            }
            // Rejoin complete — now safe for business messages
            if (this.rejoinPending) {
                this.rejoinPending = false;
                this.updateStatus('online');
            }
            return;
        }

        // Dispatch by pairingId
        const pairingId = data.pairingId;
        if (pairingId) {
            const handler = this.handlers.get(pairingId);
            if (handler) {
                handler(data);
            }
        }
    }

    private updateStatus(status: TransportStatus): void {
        if (this.status === status) return;
        this.status = status;
        for (const sub of this.statusSubscribers) {
            sub(status);
        }
    }
}
