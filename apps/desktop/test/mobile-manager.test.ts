import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileManager } from "../src/mobile-manager.js";

describe("MobileManager", () => {
    let mockStorage: any;
    let manager: MobileManager;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        mockStorage = {
            mobilePairings: {
                getActivePairing: vi.fn(),
                clearPairing: vi.fn(),
            },
        };

        manager = new MobileManager(mockStorage, "http://mock-cp");

        // Mock global fetch
        originalFetch = global.fetch;
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("should generate and cache a desktop device ID", () => {
        const id1 = manager.getDesktopDeviceId();
        const id2 = manager.getDesktopDeviceId();

        expect(id1).toBeDefined();
        expect(typeof id1).toBe("string");
        expect(id1).toBe(id2); // Should return the cached instance
    });

    it("should successfully request a pairing code", async () => {
        // Setup fetch mock to return a code
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ code: "ABCDEF" }),
        };
        (global.fetch as any).mockResolvedValue(mockResponse);

        const result = await manager.requestPairingCode();

        expect(global.fetch).toHaveBeenCalledWith("http://mock-cp/api/v1/pair/generate", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ desktopDeviceId: manager.getDesktopDeviceId() })
        }));

        expect(result.code).toBe("ABCDEF");

        const activeCode = manager.getActiveCode();
        expect(activeCode?.code).toBe("ABCDEF");
        expect(activeCode?.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should proxy active pairing to storage repo", () => {
        const mockPairing = { id: "p1" };
        mockStorage.mobilePairings.getActivePairing.mockReturnValue(mockPairing);

        expect(manager.getActivePairing()).toBe(mockPairing);
        expect(mockStorage.mobilePairings.getActivePairing).toHaveBeenCalled();
    });

    it("should clear pairing and cached code on disconnect", async () => {
        // First cache a code
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ code: "123456" }),
        };
        (global.fetch as any).mockResolvedValue(mockResponse);
        await manager.requestPairingCode();

        // Disconnect
        manager.disconnectPairing();

        expect(mockStorage.mobilePairings.clearPairing).toHaveBeenCalled();
        expect(manager.getActiveCode()).toBeNull();
    });
});
