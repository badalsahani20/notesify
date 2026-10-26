import { useEffect } from "react";
import { FileText, Shield, ChevronRight, RefreshCw, CheckCircle2, Download } from "lucide-react";
import { SectionLabel } from "./SettingsShared";
import notesifyLogo from "@/assets/notesify-favicon.svg";
import { CURRENT_VERSION } from "@/hooks/user/useWhatsNew";
import { useDesktopUpdateStore } from "@/store/useDesktopUpdateStore";

export const AboutTab = () => {
  const { status, latestRelease, currentVersion, checkForUpdates, openDownload } = useDesktopUpdateStore();
  const displayVersion = currentVersion || CURRENT_VERSION;

  useEffect(() => {
    if (status === "idle") {
      void checkForUpdates(false);
    }
  }, [status, checkForUpdates]);

  return (
    <div className="space-y-1">
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <img src={notesifyLogo} alt="Notesify" className="h-14 w-14 rounded-2xl shadow-lg" />
        <div>
          <p className="text-xl font-bold text-white tracking-tight">Notesify</p>
          <p className="text-sm text-zinc-500 mt-1">The AI-powered notes workspace</p>
        </div>
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-white/80 text-xs font-mono font-medium border border-white/[0.08]">
              v{displayVersion}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
              Release
            </span>
          </div>

          <div className="mt-2">
            {status === "checking" ? (
              <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <RefreshCw size={13} className="animate-spin text-zinc-400" />
                <span>Checking for updates...</span>
              </div>
            ) : status === "available" && latestRelease ? (
              <button
                type="button"
                onClick={openDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-950 bg-white hover:bg-zinc-200 active:scale-[0.98] transition-colors shadow-sm cursor-pointer"
              >
                <Download size={13} />
                <span>Update to v{latestRelease.version}</span>
              </button>
            ) : status === "up-to-date" ? (
              <button
                type="button"
                onClick={() => void checkForUpdates(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-emerald-400/90 hover:bg-white/5 transition"
                title="Click to check again"
              >
                <CheckCircle2 size={13} />
                <span>Up to date (v{displayVersion})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void checkForUpdates(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition border border-white/5"
              >
                <RefreshCw size={12} />
                <span>Check for updates</span>
              </button>
            )}
          </div>
        </div>
      </div>

    <SectionLabel>Legal</SectionLabel>
    <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden divide-y divide-white/5">
      <a
        href="https://notesify.in/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
      >
        <span className="flex items-center gap-2.5 text-sm text-zinc-300">
          <FileText size={15} className="text-indigo-400" />
          Terms of Service
        </span>
        <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </a>
      <a
        href="https://notesify.in/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
      >
        <span className="flex items-center gap-2.5 text-sm text-zinc-300">
          <Shield size={15} className="text-indigo-400" />
          Privacy Policy
        </span>
        <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </a>
    </div>

    <SectionLabel>Tech Stack</SectionLabel>
    <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden divide-y divide-white/5">
      {[
        ["Frontend", "React 18 + TypeScript + Vite"],
        ["Editor", "TipTap / ProseMirror"],
        ["Backend", "Node.js + Express"],
        ["Database", "MongoDB Atlas"],
        ["Cache", "Upstash Redis"],
        ["AI", "Google Gemini API"],
      ].map(([key, val]) => (
        <div key={key} className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-zinc-500">{key}</span>
          <span className="text-sm text-zinc-300 font-mono">{val}</span>
        </div>
      ))}
    </div>

    <div className="pt-6 text-center text-xs text-zinc-600">
      © {new Date().getFullYear()} Notesify · Crafted with care by{" "}
      <a
        href="https://github.com/badalsahani20"
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        badalsahani20
      </a>
    </div>
  </div>
  );
};
