import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";

export const useKeyboardOffset = () => {
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const isMobile = useMediaQuery("(max-width: 960px)");

  useEffect(() => {
    if (!isMobile) return;

    if (Capacitor.isNativePlatform()) {
      const readOffset = () => {
        const offset = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--keyboard-offset")
        );
        setKeyboardOffset(Number.isFinite(offset) ? offset : 0);
      };
      const handleNativeOffset = (event: Event) => {
        setKeyboardOffset((event as CustomEvent<number>).detail ?? 0);
      };

      readOffset();
      window.addEventListener("notesify:keyboard-offset", handleNativeOffset);
      return () => window.removeEventListener("notesify:keyboard-offset", handleNativeOffset);
    }

    if (!window.visualViewport) return;

    const handler = () => {
      if (!window.visualViewport) return;
      const viewport = window.visualViewport;
      // Calculate how much the bottom is obscured by the keyboard
      const offset = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardOffset(Math.max(0, offset));
    };

    window.visualViewport.addEventListener("resize", handler);
    window.visualViewport.addEventListener("scroll", handler);
    return () => {
      window.visualViewport?.removeEventListener("resize", handler);
      window.visualViewport?.removeEventListener("scroll", handler);
    };
  }, [isMobile]);

  return keyboardOffset;
};
