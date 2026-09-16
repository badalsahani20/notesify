import { FileText, Shield, ChevronRight } from "lucide-react";
import { SectionLabel } from "./SettingsShared";

export const AboutTab = () => (
  <div className="space-y-1">
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <img src="./notesify-favicon.png" alt="Notesify" className="h-14 w-14 rounded-2xl shadow-lg" />
      <div>
        <p className="text-xl font-bold text-white tracking-tight">Notesify</p>
        <p className="text-sm text-zinc-500 mt-1">The AI-powered notes workspace</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          Version 1.0
        </span>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          Beta
        </span>
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
