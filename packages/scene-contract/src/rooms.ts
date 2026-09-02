/**
 * Room ids and the i18n keys that name them.
 *
 * The id is the language-free key everything routes on: the layout's Area
 * labels, the renderer's folder names, the recording's `department` column.
 * The key is how a viewer-facing name is resolved - by the Panel, in the
 * viewer's locale, at render time. The table lives in the contract because
 * both ends need it: Desktop stamps the key on every room it emits, and the
 * Panel needs a room's name before any scene has arrived, at renderer
 * bootstrap, when all it has is the layout's area labels.
 */
export const SCENE_ROOM_LABEL_KEYS = {
  cs: "office.room.customerService",
  bd: "office.room.affiliate",
  ops: "office.room.shopOperations",
} as const;

export type SceneRoomId = keyof typeof SCENE_ROOM_LABEL_KEYS;
