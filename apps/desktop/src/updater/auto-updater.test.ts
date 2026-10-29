import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoUpdater: {
    setFeedURL: vi.fn(),
    on: vi.fn(),
    quitAndInstall: vi.fn(),
  },
  exit: vi.fn(),
  spawn: vi.fn(),
  unref: vi.fn(),
  notify: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getVersion: () => "1.9.39", exit: mocks.exit },
  Notification: class {
    show = mocks.notify;
  },
}));
vi.mock("electron-updater", () => ({ autoUpdater: mocks.autoUpdater }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  mkdirSync: mocks.mkdirSync,
  writeFileSync: mocks.writeFileSync,
}));
vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { createAutoUpdater } from "./auto-updater.js";

const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
const installerPath = "C:\\updates\\TK-Copilot.Setup.1.9.40.exe";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createReadyUpdater() {
  const updater = createAutoUpdater({
    locale: "zh",
    systemLocale: "zh",
    getMainWindow: () => null,
    showMainWindow: vi.fn(),
    setIsQuitting: vi.fn(),
    updateTray: vi.fn(),
  });
  updater.setDownloadState({ status: "ready", filePath: installerPath });
  return updater;
}

describe("update installation state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, "platform", { value: "win32" });
    mocks.spawn.mockReturnValue({ unref: mocks.unref });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", platformDescriptor);
  });

  it("reports installing throughout cleanup and ignores repeated install requests", async () => {
    const updater = createReadyUpdater();
    const cleanup = deferred<boolean>();
    const runCleanup = vi.fn(() => cleanup.promise);
    updater.setRunFullCleanup(runCleanup);

    const installation = updater.install();

    // This is the state polled by the Panel while shutdown is still pending.
    expect(updater.getDownloadState()).toEqual({ status: "installing" });
    await expect(updater.install()).resolves.toBeUndefined();
    expect(runCleanup).toHaveBeenCalledTimes(1);
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    cleanup.resolve(true);
    await installation;

    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.spawn).toHaveBeenCalledWith(installerPath, ["--updated", "--force-run"], {
      detached: true,
      stdio: "ignore",
    });
    expect(mocks.exit).toHaveBeenCalledWith(0);
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(updater.getDownloadState()).toEqual({ status: "installing" });
  });

  it("restores the downloaded installer when quitting is cancelled, allowing a retry", async () => {
    const updater = createReadyUpdater();
    const cleanup = deferred<boolean>();
    const runCleanup = vi.fn().mockReturnValueOnce(cleanup.promise).mockResolvedValue(true);
    updater.setRunFullCleanup(runCleanup);

    const installation = updater.install();
    expect(updater.getDownloadState()).toEqual({ status: "installing" });
    cleanup.resolve(false);
    await installation;

    expect(updater.getDownloadState()).toEqual({ status: "ready", filePath: installerPath });
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.writeFileSync).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();

    await updater.install();
    expect(runCleanup).toHaveBeenCalledTimes(2);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
  });

  it.each(["darwin", "linux"])("keeps one install in progress on %s", async (platform) => {
    Object.defineProperty(process, "platform", { value: platform });
    const updater = createReadyUpdater();
    const cleanup = deferred<boolean>();
    const runCleanup = vi.fn(() => cleanup.promise);
    updater.setRunFullCleanup(runCleanup);

    const installation = updater.install();
    expect(updater.getDownloadState()).toEqual({ status: "installing" });
    await expect(updater.install()).resolves.toBeUndefined();
    expect(runCleanup).toHaveBeenCalledTimes(1);
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    cleanup.resolve(true);
    await installation;
    expect(mocks.autoUpdater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true);
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.exit).not.toHaveBeenCalled();
  });
});
