import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  OfficeHost,
  createIframeFrame,
  type SceneAssetBundle,
} from "@rivonclaw/pixel-agents-bridge";
import { SCENE_ROOM_LABEL_KEYS, type SceneSnapshot } from "@rivonclaw/scene-contract";
import { activityCaptionKey, isReadingTool } from "../../lib/office-activity.js";
import { useOfficeScene } from "./useOfficeScene.js";

/**
 * Served from the Panel's static root; staged by scripts/setup-pixel-agents.sh.
 *
 * Root-absolute on purpose. The overlay mounts over whatever route is open,
 * and a relative `./office/...` resolves against that route - fine on `/`,
 * `/ecommerce/office/...` and a 404 on `/ecommerce/shops`, which read as "this
 * build has no office". Same convention as `/icon.png` in the sidebar.
 */
const OFFICE_URL = "/office/index.html";
const ASSETS_URL = "/office/scene-assets.json";

/** Sprite pixels per tile, fixed by the renderer's own asset grid. */
const TILE_SIZE = 16;
/** The renderer clamps zoom to this range; anything outside it is ignored. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 10;

/**
 * Largest integer zoom at which the whole office still fits the viewport.
 *
 * Two constraints pull against each other here.
 *
 * Zoom must be an integer - the renderer rasterises every sprite at the chosen
 * zoom, and a fractional one blurs pixel art - so the fit quantises in steps of
 * roughly 1/zoom, around 15% at the sizes this runs at. Nothing can both fill
 * the screen exactly and stay crisp.
 *
 * Given that, this fits rather than fills: overshooting to cover the viewport
 * crops the outer columns, and the desks nearest the walls are real seats that
 * real characters occupy. An office that hides a working agent to avoid a
 * margin has lost the argument. The remaining margin is drawn in the Panel's
 * own background, so it reads as a frame rather than as a gap.
 *
 * Zoom counts DEVICE pixels per sprite pixel, not CSS pixels - the renderer's
 * own default is `round(2 * devicePixelRatio)`. Computing against CSS pixels on
 * a retina display asks for half the zoom actually needed.
 */
function fitZoom(layout: SceneAssetBundle["layout"], width: number, height: number): number {
  const cols = (layout as { cols?: number } | null)?.cols;
  const rows = (layout as { rows?: number } | null)?.rows;
  if (!cols || !rows || width <= 0 || height <= 0) return ZOOM_MIN;
  const dpr = window.devicePixelRatio || 1;
  const affordable = Math.min(
    (width * dpr) / (cols * TILE_SIZE),
    (height * dpr) / (rows * TILE_SIZE),
  );
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.floor(affordable)));
}

/**
 * What an idle character can be captioned with.
 *
 * A free desk is the office's ordinary state, so this is the caption a viewer
 * sees most of, on most characters, at once - and one identical word repeated
 * down every desk reads as a rendering fault rather than as a room of people.
 * The renderer picks one of these per character; the Panel only decides what
 * the choices are.
 *
 * Text, not bubble sprites: the office draws three bubble sprites and none of
 * them is a music note, so a pictorial idle state would be new pixel art. The
 * text may carry a symbol, though. The office font (FS Pixel Sans Unicode) has
 * no glyph for U+266A, so a note is drawn by the system fallback font - but the
 * same font has no CJK or Thai glyphs either, so in those locales every label is
 * already fallback-drawn and a note changes nothing. In the Latin locales it is
 * one system-font glyph among pixel text, which was judged worth it: a note is
 * the one idle caption that needs no translation, and it is what was asked for.
 */
const IDLE_LABEL_KEYS = [
  "office.label.idle",
  "office.label.idleSlacking",
  "office.label.idleHumming",
  "office.label.idleSnoozing",
] as const;

/**
 * Embedding controls, passed on the iframe URL.
 *
 * They must exist before the renderer's first frame, which is earlier than any
 * message can arrive, so the query string is the only channel available. The
 * bootstrap shim reads them; the vendor patches in vendor-patches/pixel-agents/
 * make the renderer consult them, each falling back to its own default.
 */
function officeFrameParams(
  t: (key: string) => string,
  zoom: number,
  roomNames: Record<string, string>,
): string {
  return new URLSearchParams({
    labels: JSON.stringify({
      // A list, which the renderer spreads across characters. Every other label
      // names a state the viewer is meant to read and act on, so those stay one
      // fixed string.
      idle: IDLE_LABEL_KEYS.map((key) => t(key)),
      needsApproval: t("office.label.needsApproval"),
      waitingForInput: t("office.label.waitingForInput"),
      subtask: t("office.label.subtask"),
      // The department line under a character's caption. The renderer routes
      // characters to rooms by the room id and would otherwise print that id;
      // these entries give it the viewer's name for each id instead, keyed the
      // way its label lookup expects (`folder.<id>`).
      ...Object.fromEntries(
        Object.entries(roomNames).map(([roomId, name]) => [`folder.${roomId}`, name]),
      ),
    }),
    // The office is being looked at, not worked in: its own toolbar, zoom
    // controls and version chrome would act on a workspace the viewer is not in.
    kiosk: "1",
    zoom: String(zoom),
  }).toString();
}

type LayoutArea = { label?: unknown };

/**
 * Room routing table, read from the layout the renderer is about to load.
 *
 * Derived rather than declared so the Panel cannot drift from the map: the
 * renderer seats a character by looking up its room id in this table and
 * preferring seats inside the Areas it names, and an entry naming an Area the
 * layout does not define silently drops that department into the unzoned pool.
 */
function areaMappingsFor(assets: SceneAssetBundle): Record<string, string[]> {
  const areas = (assets.layout as { areas?: LayoutArea[] } | null)?.areas ?? [];
  const mappings: Record<string, string[]> = {};
  for (const area of areas) {
    if (typeof area.label === "string") mappings[area.label] = [area.label];
  }
  return mappings;
}

/**
 * The viewer's name for each room in the layout, by room id.
 *
 * Resolved here, at the last moment, from the shared room table: the layout is
 * language-free and the renderer prints whatever it is given. An area the
 * table does not know keeps showing its id, which is the honest fallback -
 * it is exactly what a viewer saw before names existed.
 */
function roomNamesFor(
  assets: SceneAssetBundle,
  t: (key: string) => string,
): Record<string, string> {
  const areas = (assets.layout as { areas?: LayoutArea[] } | null)?.areas ?? [];
  const names: Record<string, string> = {};
  for (const area of areas) {
    if (typeof area.label !== "string") continue;
    const key = (SCENE_ROOM_LABEL_KEYS as Record<string, string | undefined>)[area.label];
    if (key) names[area.label] = t(key);
  }
  return names;
}

/**
 * Fullscreen pixel office.
 *
 * Mounted only while the screensaver is showing. That is deliberate: the
 * renderer is a canvas animation sharing this window's process, and unmounting
 * it means it costs exactly nothing during the many hours a user is actually
 * working. While it IS showing, the work UI is covered anyway, so sharing the
 * process costs nothing visible either.
 *
 * The iframe is inert - `pointer-events: none` in CSS - which keeps the
 * renderer's own toolbar from being operable by a viewer who is only meant to
 * be looking.
 *
 * Only two things leave: the exit button and the shutter being pushed back up.
 * A stray click, scroll or keypress does not - the office is meant to be left
 * running on a screen people walk past and glance at, and a viewer who nudges
 * the mouse to look closer should not lose it.
 */
export function OfficeOverlay({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation();
  const frame = useOfficeScene(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<OfficeHost | null>(null);
  // The newest scene, kept for the moment the host comes into existence. The
  // event bus replays the last snapshot the instant the scene hook subscribes,
  // which is before the asset fetch below has resolved and therefore before
  // there is a host to hand it to. Without this the first frame is dropped and
  // the office opens empty until Desktop next has a reason to send another -
  // which, on a quiet Desktop, is never: it broadcasts on change only.
  const latestSnapshotRef = useRef<SceneSnapshot | null>(null);
  const [assets, setAssets] = useState<SceneAssetBundle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(ASSETS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`office assets ${res.status}`);
        return res.json() as Promise<SceneAssetBundle>;
      })
      .then((bundle) => {
        if (!cancelled) setAssets(bundle);
      })
      .catch(() => {
        // The office is decoration; a missing build must never take the Panel
        // down with it. Surface it and let the viewer leave.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!assets || !iframe) return;
    const host = new OfficeHost(createIframeFrame(iframe, window.location.origin), {
      assets,
      bootstrap: {
        hostVersion: "panel",
        areaMappings: areaMappingsFor(assets),
        alwaysShowLabels: true,
      },
      // Every desk keeps a character, idling when no run holds it. An empty
      // department reads as a broken product rather than as spare capacity, and
      // an idle character is exactly what a free execution slot is.
      translator: {
        mode: "staff",
        // The bridge carries raw tool identifiers so a recorded session can be
        // replayed in any language later; the caption is resolved here, at the
        // last possible moment, against the locale this viewer is watching in.
        resolveActivity: (rawToolName) => t(activityCaptionKey(rawToolName)),
        isReadingTool,
      },
    });
    host.start();
    hostRef.current = host;
    // Hand over whatever scene arrived while the assets were loading. The host
    // holds it until the renderer reports ready, so this is safe to call now.
    if (latestSnapshotRef.current) host.applyScene(latestSnapshotRef.current);
    const zoom = fitZoom(assets.layout, window.innerWidth, window.innerHeight);
    iframe.src = `${OFFICE_URL}?${officeFrameParams(t, zoom, roomNamesFor(assets, t))}`;
    return () => {
      host.dispose();
      hostRef.current = null;
    };
    // `t` is intentionally not a dependency: re-running this would tear down
    // and rebuild the renderer. A language change mid-screensaver is not worth
    // a reload; the next time the office opens it picks up the new labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  useEffect(() => {
    if (!frame) return;
    latestSnapshotRef.current = frame.snapshot;
    // Cues carry the transitions the producer's coalescing dropped - a run's
    // whole setup sequence can land in one snapshot that shows only its last
    // state - and the host paces the office from them. The ref above keeps only
    // the snapshot: cues are droppable, and by the time a late-arriving host is
    // handed the scene those transitions are long past being worth playing.
    hostRef.current?.applyScene(frame.snapshot, frame.cues);
  }, [frame]);

  return (
    <div className="office-overlay">
      {failed ? (
        <p className="office-overlay__message">{t("office.unavailable")}</p>
      ) : (
        <iframe className="office-overlay__frame" ref={iframeRef} title={t("office.title")} />
      )}
      <button type="button" className="office-overlay__exit" onClick={onExit}>
        {t("office.exit")}
      </button>
    </div>
  );
}
