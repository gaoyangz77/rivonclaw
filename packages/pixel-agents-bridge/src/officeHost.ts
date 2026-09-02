import type { SceneCue, SceneSnapshot } from "@rivonclaw/scene-contract";
import { buildBootstrapMessages, type BootstrapOptions, type SceneAssetBundle } from "./assetBootstrap.js";
import { ScenePacer, type ScenePacerTiming } from "./scenePacer.js";
import { PixelAgentsTranslator, type TranslatorOptions } from "./translator.js";

/**
 * Two-way channel to an embedded renderer.
 *
 * Abstracted so the host logic is testable without a DOM, and so a different
 * embedding - another iframe, a separate window, an Electron view - is one
 * adapter rather than a rewrite. `createIframeFrame` is the browser one.
 */
export interface OfficeFrame {
  post(message: unknown): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (message: unknown) => void): () => void;
}

export type OfficeHostOptions = {
  assets: SceneAssetBundle;
  bootstrap: BootstrapOptions;
  translator?: TranslatorOptions;
  /** Clock and scheduler seams for the pacer. Tests only; see `ScenePacer`. */
  pacer?: ScenePacerTiming;
};

/**
 * Drives a Pixel Agents renderer from our scene state.
 *
 * The renderer announces itself with `webviewReady` and expects the host to
 * push everything from there. That handshake is also the reload signal: an
 * iframe that navigates or crashes and comes back sends `webviewReady` again,
 * with none of the state it previously held. So readiness is treated as
 * "start over" rather than "start once" - bootstrap is re-sent and the
 * translator is reset, which makes recovery from a renderer reload identical to
 * first load and removes any need to detect the difference.
 *
 * The pacer, however, is NOT reset on that handshake, and the scene replayed
 * into the reset translator is the one the pacer currently has on screen rather
 * than the newest authoritative one. A reload is a renderer problem; the office
 * itself was mid-story, and jumping it to the runtime's present would discard
 * every beat still queued. The renderer comes back showing what it was showing.
 */
export class OfficeHost {
  private readonly frame: OfficeFrame;
  private readonly options: OfficeHostOptions;
  private readonly translator: PixelAgentsTranslator;
  private readonly pacer: ScenePacer;
  private unsubscribe: (() => void) | null = null;
  private latest: SceneSnapshot | null = null;
  private ready = false;

  constructor(frame: OfficeFrame, options: OfficeHostOptions) {
    this.frame = frame;
    this.options = options;
    this.translator = new PixelAgentsTranslator(options.translator);
    this.pacer = new ScenePacer({
      ...options.pacer,
      onPresent: (presented) => this.deliver(presented),
    });
  }

  /** Begin listening. Nothing is sent until the renderer reports ready. */
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.frame.subscribe((message) => this.handleIncoming(message));
  }

  /**
   * Hand the host a new authoritative scene, and the cues that led to it.
   *
   * Safe to call before the renderer is ready: the snapshot is held and
   * delivered on the handshake, so the host never has to be sequenced against
   * iframe load timing. Only the snapshot is held - cues are droppable by
   * contract, and a snapshot alone is enough to draw a correct frame, so the
   * one that survives the wait is the state, not the transitions into it.
   */
  applyScene(snapshot: SceneSnapshot, cues: readonly SceneCue[] = []): void {
    this.latest = snapshot;
    if (!this.ready) return;
    this.pacer.push(snapshot, cues);
  }

  /** Queue depth per room, for host chrome drawn outside the renderer. */
  queuedByRoom(): ReadonlyMap<string, number> {
    return this.translator.queuedByRoom();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ready = false;
    this.pacer.dispose();
  }

  private handleIncoming(message: unknown): void {
    if (!isReadyMessage(message)) return;
    this.ready = true;
    for (const bootstrapMessage of buildBootstrapMessages(
      this.options.assets,
      this.options.bootstrap,
    )) {
      this.frame.post(bootstrapMessage);
    }
    this.translator.reset();
    const presented = this.pacer.presentedScene();
    if (presented) {
      this.deliver(presented);
      return;
    }
    // Nothing has been presented yet, so this is the first handshake and the
    // pacer is still holding the scene that arrived before it.
    if (this.latest) this.pacer.push(this.latest);
  }

  private deliver(snapshot: SceneSnapshot): void {
    if (!this.ready) return;
    for (const message of this.translator.apply(snapshot)) {
      this.frame.post(message);
    }
  }
}

function isReadyMessage(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "webviewReady"
  );
}

/**
 * Browser adapter over an iframe.
 *
 * Both directions are pinned to `origin`: outgoing posts name it explicitly
 * rather than using `"*"`, and incoming messages are dropped unless they came
 * from this iframe's own window at that origin. The renderer runs third-party
 * code and a page may host other frames, so neither side is left open.
 */
export function createIframeFrame(iframe: HTMLIFrameElement, origin: string): OfficeFrame {
  return {
    post(message) {
      iframe.contentWindow?.postMessage(message, origin);
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) return;
        if (event.origin !== origin) return;
        handler(event.data);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
  };
}
