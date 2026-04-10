import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import type { GatewayChatClient } from "../../../lib/gateway-client.js";
import type { ChatMessage, PendingImage } from "../chat-utils.js";
import { INITIAL_VISIBLE, PAGE_SIZE, FETCH_BATCH, parseRawMessages } from "../chat-utils.js";
import { restoreImages, clearImages } from "../image-cache.js";

export interface UseChatTranscriptParams {
  clientRef: React.RefObject<GatewayChatClient | null>;
  sessionKeyRef: React.RefObject<string>;
  renderTick: number;
}

export function useChatTranscript({ clientRef, sessionKeyRef, renderTick }: UseChatTranscriptParams) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [allFetched, setAllFetched] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const fetchLimitRef = useRef(FETCH_BATCH);
  const isFetchingRef = useRef(false);
  const shouldInstantScrollRef = useRef(true);
  const messagesLengthRef = useRef(messages.length);
  messagesLengthRef.current = messages.length;
  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;
  const allFetchedRef = useRef(allFetched);
  allFetchedRef.current = allFetched;

  // "Sticky to bottom" -- an explicit pinned state drives auto-scroll.
  const stickyRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
    stickyRef.current = true;
  }, []);

  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    if (shouldInstantScrollRef.current) {
      scrollToBottom();
      shouldInstantScrollRef.current = false;
    } else if (stickyRef.current) {
      scrollToBottom();
    }
  }, [messages, renderTick, scrollToBottom]);

  // Fetch more messages from gateway when user scrolled past all cached messages
  const fetchMore = useCallback(async () => {
    const client = clientRef.current;
    if (!client || allFetchedRef.current || isFetchingRef.current) return;
    isFetchingRef.current = true;
    const oldCount = messagesLengthRef.current;
    fetchLimitRef.current += FETCH_BATCH;

    try {
      const result = await client.request<{
        messages?: Array<{ role?: string; content?: unknown; timestamp?: number }>;
      }>("chat.history", {
        sessionKey: sessionKeyRef.current,
        limit: fetchLimitRef.current,
      });

      let parsed = parseRawMessages(result?.messages);
      parsed = await restoreImages(sessionKeyRef.current, parsed).catch(() => parsed);

      if (parsed.length < fetchLimitRef.current || parsed.length <= oldCount) {
        setAllFetched(true);
      }

      if (parsed.length > oldCount) {
        prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight ?? 0;
        isLoadingMoreRef.current = true;
        setMessages(parsed);
        setVisibleCount(oldCount + PAGE_SIZE);
      }
    } catch {
      // Fetch failure is non-fatal
    } finally {
      isFetchingRef.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads from refs

  // Load older messages on scroll to top; track sticky state.
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el || isLoadingMoreRef.current || isFetchingRef.current) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickyRef.current = distanceFromBottom < 30;
    setShowScrollBtn(distanceFromBottom > 150);
    if (el.scrollTop < 50) {
      // All cached messages visible -- try fetching more from gateway
      if (visibleCountRef.current >= messagesLengthRef.current) {
        if (!allFetchedRef.current) {
          fetchMore();
        }
        return;
      }
      // Reveal more from cache
      prevScrollHeightRef.current = el.scrollHeight;
      setVisibleCount((prev) => {
        if (prev >= messagesLengthRef.current) return prev;
        isLoadingMoreRef.current = true;
        return Math.min(prev + PAGE_SIZE, messagesLengthRef.current);
      });
    }
  }, [fetchMore]);

  // Preserve scroll position after revealing older messages
  useLayoutEffect(() => {
    if (!isLoadingMoreRef.current) return;
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
    }
    isLoadingMoreRef.current = false;
  }, [visibleCount]);

  // Prune stale image cache entries (older than 30 days) on mount
  useEffect(() => { clearImages().catch(() => { }); }, []);

  // Load chat history once connected
  const loadHistory = useCallback(async (client: GatewayChatClient) => {
    fetchLimitRef.current = FETCH_BATCH;
    isFetchingRef.current = true;

    try {
      const result = await client.request<{
        messages?: Array<{ role?: string; content?: unknown; timestamp?: number }>;
      }>("chat.history", {
        sessionKey: sessionKeyRef.current,
        limit: FETCH_BATCH,
      });

      let parsed = parseRawMessages(result?.messages);
      // Guard: don't wipe existing messages if gateway returns empty on reconnect
      if (parsed.length === 0 && messagesLengthRef.current > 0) return;
      parsed = await restoreImages(sessionKeyRef.current, parsed).catch(() => parsed);
      setAllFetched(parsed.length < FETCH_BATCH);
      shouldInstantScrollRef.current = true; stickyRef.current = true;
      setMessages(parsed);
      setVisibleCount(INITIAL_VISIBLE);
    } catch {
      // History load failure is non-fatal
    } finally {
      isFetchingRef.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads from refs

  /** Reset transcript state for session switching. */
  function resetForSessionSwitch(state: {
    messages: ChatMessage[];
    pendingImages: PendingImage[];
    visibleCount: number;
    allFetched: boolean;
  }) {
    setMessages(state.messages);
    setPendingImages(state.pendingImages);
    setVisibleCount(state.visibleCount);
    setAllFetched(state.allFetched);
    shouldInstantScrollRef.current = true; stickyRef.current = true;
    fetchLimitRef.current = FETCH_BATCH;
    isFetchingRef.current = false;
  }

  return {
    messages,
    setMessages,
    visibleCount,
    setVisibleCount,
    allFetched,
    setAllFetched,
    pendingImages,
    setPendingImages,
    showScrollBtn,
    messagesEndRef,
    messagesContainerRef,
    shouldInstantScrollRef,
    stickyRef,
    scrollToBottom,
    fetchMore,
    handleScroll,
    loadHistory,
    resetForSessionSwitch,
  };
}
