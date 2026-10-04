export const isDesktopApp = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).electronAPI ||
      navigator.userAgent.toLowerCase().includes("electron") ||
      window.location.protocol === "file:" ||
      document.documentElement.classList.contains("is-electron")
  );
};
