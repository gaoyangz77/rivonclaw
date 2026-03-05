import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileSyncEngine } from "../src/sync-engine.js";
import { WebSocket } from "ws";
import fs from "node:fs/promises";

// Mock the ws module
vi.mock("ws");

// Mock fs to avoid creating actual media directories during tests
vi.mock("node:fs/promises", () => ({
    default: {
        mkdir: vi.fn(),
        writeFile: vi.fn()
    }
}));

describe("MobileSyncEngine", () => {
    let mockApi: any;
    let engine: MobileSyncEngine;

    beforeEach(() => {
        mockApi = {
            gatewayRpc: {
                request: vi.fn().mockResolvedValue({ runId: "test-run-123" })
            }
        };

        // Clear mocks
        vi.clearAllMocks();

        engine = new MobileSyncEngine(
            mockApi,
            "fake-token",
            "wss://relay.test.com",
            "desktop-dev-id"
        );
    });

    afterEach(() => {
        engine.stop();
    });

    it("should initialize the media directory", () => {
        expect(fs.mkdir).toHaveBeenCalledWith(
            expect.stringContaining("mobile"),
            { recursive: true }
        );
    });

    it("should connect to the relay server with correct URL", () => {
        engine.start();

        expect(WebSocket).toHaveBeenCalledWith(
            "wss://relay.test.com/mobile-chat?token=fake-token&client=desktop"
        );
    });

    it("should queue outgoing messages and transmit them if WS is open", () => {
        engine.start();

        // Hack to simulate open connection
        const mockWsInstance = vi.mocked(WebSocket).mock.results[0].value;
        Object.defineProperty(mockWsInstance, 'readyState', {
            get: vi.fn(() => WebSocket.OPEN)
        });
        mockWsInstance.send = vi.fn();

        const msgId = engine.queueOutbound("mobile-id", { text: "Hello" });

        expect(msgId).toBeDefined();
        expect(mockWsInstance.send).toHaveBeenCalledWith(
            expect.stringContaining('"payload":{"text":"Hello"}')
        );
    });

    it("should route incoming text messages to the Gateway API", async () => {
        engine.start();
        const mockWsInstance = vi.mocked(WebSocket).mock.results[0].value;

        // Grab the on message handler
        const onMessage = mockWsInstance.on.mock.calls.find(
            (call: any) => call[0] === "message"
        )[1];

        const mockPayload = JSON.stringify({
            type: "msg",
            id: "msg-1",
            sender: "mobile",
            payload: {
                type: "text",
                text: "Ping from mobile"
            }
        });

        // Simulate incoming message
        await onMessage(Buffer.from(mockPayload), false);

        expect(mockApi.gatewayRpc.request).toHaveBeenCalledWith("agent", {
            sessionKey: "agent:main:main",
            channel: "mobile",
            message: "Ping from mobile",
            attachments: [],
            idempotencyKey: "msg-1"
        });
    });

    it("should parse incoming images and save them to disk", async () => {
        engine.start();
        const mockWsInstance = vi.mocked(WebSocket).mock.results[0].value;
        const onMessage = mockWsInstance.on.mock.calls.find(
            (call: any) => call[0] === "message"
        )[1];

        const mockPayload = JSON.stringify({
            type: "msg",
            id: "msg-2",
            sender: "mobile",
            payload: {
                type: "image",
                mimeType: "image/png",
                data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            }
        });

        await onMessage(Buffer.from(mockPayload), false);

        expect(fs.writeFile).toHaveBeenCalled();
        expect(mockApi.gatewayRpc.request).toHaveBeenCalledWith("agent", expect.objectContaining({
            channel: "mobile",
            attachments: expect.arrayContaining([
                expect.objectContaining({
                    type: "image",
                    mimeType: "image/png"
                })
            ])
        }));
    });
});
