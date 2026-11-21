import { useState, useEffect } from "react";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";

/**
 * Reads the keyboard inset written once by useCapacitorApp().
 *
 * Native and web both publish --keyboard-offset (and the
 * "notesify:keyboard-offset" event), so this hook never measures the keyboard
 * itself. That keeps one source of truth and avoids the native/web formulas
 * drifting apart.
 */
export const useKeyboardOffset = () => {
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const isMobile = useMediaQuery("(max-width: 960px)");

  useEffect(() => {
    if (!isMobile) return;

    const readOffset = () => {
      const offset = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--keyboard-offset")
      );
      setKeyboardOffset(Number.isFinite(offset) ? offset : 0);
    };
    const handleOffset = (event: Event) => {
      setKeyboardOffset((event as CustomEvent<number>).detail ?? 0);
    };

    readOffset();
    window.addEventListener("notesify:keyboard-offset", handleOffset);
    return () => window.removeEventListener("notesify:keyboard-offset", handleOffset);
  }, [isMobile]);

  return keyboardOffset;
};
