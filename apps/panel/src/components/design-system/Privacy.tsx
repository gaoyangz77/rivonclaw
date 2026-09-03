import { createElement, type ElementType, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useRuntimeStatus } from "../../store/RuntimeStatusProvider.js";
import "./tk-v1.css";

/**
 * Whether the Panel-wide privacy mode is on.
 *
 * The hook only reads the value; the component that calls it must be wrapped
 * in `observer()` to re-render when the setting flips (the same contract as
 * every other `useRuntimeStatus()` consumer).
 */
export function usePrivacyMode(): boolean {
  return useRuntimeStatus().appSettings.privacyMode;
}

export interface TkPrivateProps {
  children: ReactNode;
  /** Element to render. Defaults to `span`. */
  as?: ElementType;
  className?: string;
  /**
   * Whether these children are sensitive. Defaults to `true`, so wrapping
   * something in TkPrivate marks it by default.
   *
   * Pass `false` for the branch of a resolver that produced non-sensitive text
   * — a shop alias, an id — so one call site shape covers both cases instead
   * of a ternary per site. `false` renders an ordinary passthrough: no
   * marking, and the tooltip is kept. It never opts a node back in, so
   * privacy mode has no effect on it.
   */
  sensitive?: boolean;
  /**
   * Native tooltip text. Suppressed while this node is masked — a blurred name
   * whose tooltip still spells it out is not masked at all.
   */
  title?: string;
}

/**
 * Marks its children as sensitive text. The blur itself lives in
 * `styles/privacy.css` and is driven by `html[data-privacy="on"]`, so toggling
 * privacy mode costs one attribute write rather than a re-render per node.
 *
 * Note the default differs from `RemoteMediaImage`'s `sensitive` prop, which
 * is opt-in (`false`): that component renders every kind of remote image, so
 * masking is the exception there, whereas marking is this component's whole
 * purpose.
 */
export const TkPrivate = observer(function TkPrivate({
  children,
  as = "span",
  className,
  sensitive = true,
  title,
}: TkPrivateProps) {
  const privacyMode = usePrivacyMode();
  const masked = sensitive && privacyMode;
  return createElement(
    as,
    {
      className,
      "data-tk-private": sensitive ? "text" : undefined,
      title: masked ? undefined : title,
    },
    children,
  );
});
