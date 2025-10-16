import React, { useState, useMemo, useCallback } from 'react';

// Number of items to render above and below the visible viewport to reduce flickering on fast scroll.
const OVERSCAN_COUNT = 5;

/**
 * A reusable hook for implementing high-performance virtual scrolling on long lists.
 * @param items The full array of items to virtualize.
 * @param itemHeight The fixed height of each item in pixels.
 * @param containerRef A ref to the scrollable container element.
 * @returns An object containing the scroll handler, the virtual items to render, and the total height for the scroll spacer.
 */
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerRef,
}: {
  items: T[];
  itemHeight: number;
  containerRef: React.RefObject<HTMLElement>;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  /**
   * Updates the scroll position state when the user scrolls the container.
   * This is wrapped in useCallback to prevent re-creation on every render.
   */
  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // The total height of the scrollable area, as if all items were rendered.
  const totalHeight = items.length * itemHeight;

  /**
   * The core logic for virtualization. This memoized calculation determines
   * which subset of items should be visible based on the current scroll position.
   */
  const virtualItems = useMemo(() => {
    if (!containerRef.current) {
      return [];
    }
    const containerHeight = containerRef.current.clientHeight;

    // Calculate the start and end indices of the visible items.
    let startIndex = Math.floor(scrollTop / itemHeight);
    let endIndex = Math.min(
      items.length - 1,
      startIndex + Math.ceil(containerHeight / itemHeight)
    );

    // Apply overscan to render a few items outside the viewport.
    startIndex = Math.max(0, startIndex - OVERSCAN_COUNT);
    endIndex = Math.min(items.length - 1, endIndex + OVERSCAN_COUNT);

    // Create the array of virtual items, including their data and positioning styles.
    const virtualized = [];
    for (let i = startIndex; i <= endIndex; i++) {
        virtualized.push({
            data: items[i],
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${itemHeight}px`,
                transform: `translateY(${i * itemHeight}px)`,
            },
        });
    }
    return virtualized;

  }, [scrollTop, items, itemHeight, containerRef]);

  return {
    handleScroll,
    virtualItems,
    totalHeight,
  };
}
