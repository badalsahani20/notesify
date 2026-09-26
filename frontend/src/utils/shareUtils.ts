/**
 * Resolves the public base URL of the Notesify web application.
 *
 * In browser environments, this resolves to window.location.origin.
 * However, in desktop (Electron) packaged builds running via file:// or custom local origins,
 * window.location.origin is "file://" or "null", which would generate unroutable file:// share links.
 * This helper guarantees an absolute, valid HTTP/HTTPS URL.
 */
export const getPublicAppBaseUrl = (): string => {
  // Detect Desktop (Electron) or file protocol
  const isDesktopOrFile =
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" ||
      !window.location.origin ||
      window.location.origin === "null" ||
      window.location.origin.startsWith("file:") ||
      Boolean((window as any).electronAPI));

  // If in desktop or file protocol, we cannot use window.location.origin (which is file:// or null)
  if (isDesktopOrFile) {
    // If running in local desktop dev with hot-reloading at localhost:5173
    if (import.meta.env.DEV && window.location.origin?.startsWith("http")) {
      return window.location.origin;
    }
    // Desktop production always targets the public web app
    const envAppUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_URL;
    return (envAppUrl || "https://app.notesify.in").replace(/\/+$/, "");
  }

  // In standard browser environment, use current origin if it's a valid HTTP/HTTPS URL
  if (
    typeof window !== "undefined" &&
    window.location.origin &&
    window.location.origin.startsWith("http")
  ) {
    return window.location.origin;
  }

  // Fallback
  const envAppUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_URL;
  return (envAppUrl || "https://app.notesify.in").replace(/\/+$/, "");
};

/**
 * Builds a public, routable web link for a shared note.
 */
export const getNoteShareUrl = (shareSlug?: string | null): string => {
  if (!shareSlug) return "";
  const baseUrl = getPublicAppBaseUrl();
  return `${baseUrl}/shared/${shareSlug}`;
};
