import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileSyncEngine } from './sync-engine';

describe('MobileSyncEngine', () => {
    let api: any;
    let engine: MobileSyncEngine;

    beforeEach(() => {
        api = {
            gatewayRpc: {
                request: vi.fn().mockResolvedValue({ runId: 'test-run-123' })
            }
        };

        engine = new MobileSyncEngine(
            api,
            'test-token',
            'ws://localhost:4200/mobile-chat',
            'desktop-xyz'
        );
    });

    it('should initialize without connecting until start() is called', () => {
        expect((engine as any).isRunning).toBe(false);
        expect((engine as any).ws).toBeNull();
    });

    it('should queue outbound messages and cache them', () => {
        const id = engine.queueOutbound('mobile-123', { type: 'text', text: 'Hello' });

        expect(id).toBeDefined();
        const cached = (engine as any).outbox.get(id);
        expect(cached).toBeDefined();
        expect(cached.payload.text).toBe('Hello');
        expect(cached.sender).toBe('desktop');
    });

    it('should delete from outbox when receiving an ACK', async () => {
        const id = engine.queueOutbound('mobile-123', { type: 'text', text: 'Hello' });
        expect((engine as any).outbox.has(id)).toBe(true);

        await (engine as any).handleIncoming({
            type: 'ack',
            id
        });

        expect((engine as any).outbox.has(id)).toBe(false);
    });

    it('should pass incoming complete messages to the Gateway RPC', async () => {
        const msg = {
            type: 'msg',
            id: 'msg-1',
            sender: 'mobile',
            payload: { type: 'text', text: 'Hi from phone' }
        };

        // Spy on transmit to catch the ACK
        engine['transmit'] = vi.fn();

        await (engine as any).handleIncoming(msg);

        // 1. Check if ACK was transmitted back
        expect(engine['transmit']).toHaveBeenCalledWith({ type: 'ack', id: 'msg-1' });

        // 2. Check if the message was sent to the LLM backend
        expect(api.gatewayRpc.request).toHaveBeenCalledWith('agent', {
            sessionKey: 'agent:main:main',
            channel: 'mobile',
            message: 'Hi from phone',
            attachments: [],
            idempotencyKey: 'msg-1'
        });

        // 3. Check if runId was mapped
        expect((engine as any).runIdMap.get('test-run-123')).toBe('mobile_device');
    });
});
