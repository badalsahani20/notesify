import { useState } from "react";

export const CURRENT_VERSION = "1.3.1";
const LS_KEY = "notesify_last_seen_version";

export const useWhatsNew = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) !== CURRENT_VERSION;
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(LS_KEY, CURRENT_VERSION);
    } catch { /* localStorage may be blocked (private browsing) */ }
    setIsOpen(false);
  };

  return { isOpen, dismiss };
};
