import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ExternalLink, X, Sparkles } from "lucide-react";
import { useDesktopUpdateStore } from "@/store/useDesktopUpdateStore";
import { isDesktopApp } from "@/lib/desktop";

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-5 right-5 z-[100] max-w-sm w-full pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
          {/* Subtle ambient gradient flare */}
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-violet-500/15 blur-2xl pointer-events-none" />

          <div className="relative flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles size={18} className="animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  Update Available
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v{latestRelease.version}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-300 leading-relaxed truncate">
                {latestRelease.name || "A new version of Notesify is ready."}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={openDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition shadow-sm"
                >
                  <Download size={13} />
                  <span>Download Update</span>
                </button>

                <button
                  type="button"
                  onClick={openReleaseNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition"
                  title="View GitHub release notes"
                >
                  <span>Notes</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissUpdate}
              className="absolute top-0 right-0 p-1 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-white/5 transition"
              aria-label="Dismiss update notification"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
export default DesktopUpdateToast;
