import React, { useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { Message } from '../types';

const INITIAL_MESSAGES_COUNT = 20;
const MESSAGES_BATCH_SIZE = 20;

/**
 * A hook to manage pagination for a list of messages, improving performance for long chats.
 * @param messages The full array of messages for the session.
 * @param scrollContainerRef A ref to the scrollable container element.
 * @returns An object containing the messages to display, whether more can be loaded, and the function to load them.
 */
export const usePaginatedMessages = (messages: Message[], scrollContainerRef: React.RefObject<HTMLDivElement>) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_MESSAGES_COUNT);
  const oldScrollHeightRef = useRef<number | null>(null);

  // Memoize the sliced array of messages to prevent re-computation on every render.
  const displayedMessages = useMemo(() => {
    return messages.slice(-visibleCount);
  }, [messages, visibleCount]);

  // A simple boolean to determine if the "Show More" button should be visible.
  const hasMore = messages.length > visibleCount;

  /**
   * Increases the number of visible messages, triggering a re-render.
   * It captures the current scroll height *before* the state update to allow for scroll position preservation.
   */
  const loadMore = useCallback(() => {
    if (scrollContainerRef.current) {
      oldScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }
    setVisibleCount(prev => Math.min(prev + MESSAGES_BATCH_SIZE, messages.length));
  }, [messages.length, scrollContainerRef]);

  /**
   * This effect runs after the DOM has been updated but before the browser paints.
   * It's used to adjust the scroll position seamlessly after new messages are rendered at the top.
   */
  useLayoutEffect(() => {
    // If we have a stored old scroll height, it means we've just loaded more messages.
    if (oldScrollHeightRef.current && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      // The new scroll top is the difference in height plus the old scroll top.
      scrollContainerRef.current.scrollTop += newScrollHeight - oldScrollHeightRef.current;
      oldScrollHeightRef.current = null; // Reset ref after use to prevent incorrect adjustments.
    }
  }, [visibleCount, scrollContainerRef]); // This effect depends on the count of visible messages.

  return { displayedMessages, hasMore, loadMore };
};