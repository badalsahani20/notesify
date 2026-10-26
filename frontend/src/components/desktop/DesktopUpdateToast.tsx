import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownToLine, ExternalLink, X } from "lucide-react";
import { useDesktopUpdateStore } from "@/store/useDesktopUpdateStore";
import { isDesktopApp } from "@/lib/desktop";
import notesifyLogo from "@/assets/notesify-favicon.svg";

export const DesktopUpdateToast: React.FC = () => {
  const {
    status,
    latestRelease,
    dismissedVersion,
    dismissUpdate,
    openDownload,
    openReleaseNotes,
  } = useDesktopUpdateStore();

  const isDesktop = isDesktopApp();
  const isAvailable = status === "available" && latestRelease;
  const isDismissed = dismissedVersion === latestRelease?.version;

  if (!isDesktop || !isAvailable || isDismissed) {
    return null;
  }

  // Format release description cleanly (avoid repeating version title redundantly)
  const rawName = latestRelease.name?.trim() || "";
  const isGenericName =
    !rawName ||
    rawName.toLowerCase() === `v${latestRelease.version}` ||
    rawName.toLowerCase() === latestRelease.version ||
    rawName.toLowerCase() === `notesify v${latestRelease.version}` ||
    rawName.toLowerCase() === `notesify ${latestRelease.version}`;

  const descriptionText = isGenericName
    ? "A new update is available with 60fps streaming, inline slash AI commands, and performance improvements."
    : rawName;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-5 right-5 z-[100] w-[350px] max-w-[calc(100vw-2.5rem)] pointer-events-auto select-none"
        aria-label="Desktop update notification"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_1px_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-2xl">
          <div className="flex items-start gap-3.5">
            {/* App Icon with emerald notification dot */}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] p-1.5 shadow-sm mt-0.5">
              <img
                src={notesifyLogo}
                alt="Notesify"
                className="w-full h-full object-contain"
              />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-zinc-900" />
              </span>
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold text-white tracking-tight">
                  Notesify Update
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white/[0.07] text-zinc-300 border border-white/[0.08]">
                  v{latestRelease.version}
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-400 leading-relaxed line-clamp-2">
                {descriptionText}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={openDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-950 bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                >
                  <ArrowDownToLine size={13} className="stroke-[2.5]" />
                  <span>Download update</span>
                </button>

                <button
                  type="button"
                  onClick={openReleaseNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="View GitHub release notes"
                >
                  <span>Changelog</span>
                  <ExternalLink size={12} className="opacity-70" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissUpdate}
              className="absolute top-3.5 right-3.5 p-1 text-zinc-400 hover:text-white rounded-md hover:bg-white/[0.08] transition-colors cursor-pointer"
              aria-label="Dismiss update notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

export default DesktopUpdateToast;
