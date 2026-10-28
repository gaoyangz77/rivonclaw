import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { TkButton } from "../design-system/index.js";
import "./LoadedListBackToTop.css";

/** Mount inside the list's vertical scroll region; enable after a successful append. */
export function LoadedListBackToTop({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const [target, setTarget] = useState<{ root: HTMLElement; modal: boolean } | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!enabled || !anchor) {
      setScrolled(false);
      setTarget(null);
      return;
    }
    const documentRoot = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    const candidates: HTMLElement[] = [];
    for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
      if (/^(auto|scroll)$/.test(getComputedStyle(parent).overflowY) && parent !== documentRoot) {
        candidates.push(parent);
      }
    }
    candidates.push(documentRoot);
    let currentRoot: HTMLElement | null = null;
    const update = () => {
      const root =
        candidates.find(
          (candidate) => candidate.scrollHeight > candidate.clientHeight || candidate.scrollTop > 0,
        ) ?? documentRoot;
      if (root !== currentRoot) {
        currentRoot = root;
        scrollRootRef.current = root;
        setTarget({ root, modal: Boolean(anchor.closest('[role="dialog"]')) });
      }
      setScrolled(root.scrollTop > 200);
    };
    update();
    // Watch every candidate: a previously short list may overflow after another append.
    const scrollTargets = candidates.map((root) => (root === documentRoot ? window : root));
    for (const root of scrollTargets) root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    for (const root of candidates) observer.observe(root);
    return () => {
      for (const root of scrollTargets) root.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
      scrollRootRef.current = null;
    };
  }, [enabled]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {enabled && scrolled && target
        ? createPortal(
            <div
              className={`loaded-list-back-to-top${target.modal ? " loaded-list-back-to-top-modal" : ""}`}
            >
              <TkButton
                className="loaded-list-back-to-top-button"
                variant="secondary"
                onClick={() => {
                  const root = scrollRootRef.current;
                  if (!root) return;
                  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "instant"
                    : "smooth";
                  if (root === (document.scrollingElement ?? document.documentElement)) {
                    window.scrollTo({ top: 0, behavior });
                  } else {
                    root.scrollTo({ top: 0, behavior });
                  }
                }}
                leadingIcon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M5 5h14M12 20V8m-6 6 6-6 6 6" />
                  </svg>
                }
              >
                {t("common.backToTop")}
              </TkButton>
            </div>,
            target.root === (document.scrollingElement ?? document.documentElement)
              ? document.body
              : target.root,
          )
        : null}
    </>
  );
}
