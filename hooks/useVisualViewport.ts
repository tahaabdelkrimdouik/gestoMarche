"use client";

import { useEffect } from "react";

/**
 * Keeps CSS variables in sync with the visible area above the virtual keyboard.
 * --vvh: visible height, --vv-offset-top: offset when the browser pans the viewport.
 */
export function useVisualViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const visualViewport = window.visualViewport;

    const update = () => {
      const height = visualViewport?.height ?? window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;

      root.style.setProperty("--vvh", `${height}px`);
      root.style.setProperty("--vv-offset-top", `${offsetTop}px`);
    };

    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);

    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}
