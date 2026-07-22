import { useEffect, useRef, useState } from 'react';

/*
 * useElementWidth — observe an element's rendered content width so SVG charts
 * can be laid out in real pixels instead of a stretched viewBox. Pixel geometry
 * keeps strokes crisp and lets HTML labels/tooltips align exactly to marks at
 * every viewport width. Returns [ref, width]; width is 0 until first measure.
 */
export default function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
