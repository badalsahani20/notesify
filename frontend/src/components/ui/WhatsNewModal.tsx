import { motion, AnimatePresence } from "framer-motion";
import { Share2, Bot, ArrowRight, Globe, ShieldCheck, Gauge } from "lucide-react";
import { CURRENT_VERSION } from "@/hooks/user/useWhatsNew";

// ─── Feature definitions ─────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: ShieldCheck,
    iconClass: "bg-emerald-500/10 text-emerald-400",
    label: "AI Quotas & Concurrency Guard",
    description:
      "Daily token quotas with UTC midnight reset across Free (100k) and Pro tiers, paired with concurrency limits to prevent lockups.",
    badge: "New",
    badgeClass: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
  },
  {
    icon: Gauge,
    iconClass: "bg-amber-500/10 text-amber-400",
    label: "Token Usage & Tier Badges",
    description:
      "Monitor your token usage in real-time with compact shorthand metrics and dynamic plan badges on your profile and composer.",
    badge: "New",
    badgeClass: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
  },
  {
    icon: Bot,
    iconClass: "bg-purple-500/10 text-purple-400",
    label: "Context Window Optimization",
    description:
      "Sliding 16-message conversation window with intelligent automated background summarization to eliminate token bloat.",
    badge: "Improved",
    badgeClass: "text-purple-400 bg-purple-500/10 border border-purple-500/20",
  },
  {
    icon: Share2,
    iconClass: "bg-blue-500/10 text-blue-400",
    label: "Native LaTeX Mathematics",
    description:
      "Iris now natively formats equations with inline and block LaTeX syntax, rendered crisply with KaTeX.",
    badge: "Improved",
    badgeClass: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
  },
  {
    icon: Globe,
    iconClass: "bg-indigo-500/10 text-indigo-400",
    label: "Stutter-Free Iris Drawer",
    description:
      "Responsive layout collapse guards and stabilized session routing deliver a silky-smooth global chat drawer transition.",
    badge: "Polished",
    badgeClass: "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
interface WhatsNewModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export const WhatsNewModal = ({ isOpen, onDismiss }: WhatsNewModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="wn-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200] bg-black/65"
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="wn-card"
              initial={{ opacity: 0, scale: 0.95, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-md"
              role="dialog"
              aria-modal="true"
              aria-labelledby="whats-new-title"
            >
              {/* ── Card shell — matches DownloadPage ── */}
              <div className="text-left bg-[#161618] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm relative">
                {/* Removed top accent to match DownloadPage */}

                {/* ── Header ── */}
                <div className="px-6 pt-6 pb-5 relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                      ✦ What's New
                    </span>
                    <span className="text-[11px] text-white/20 font-medium">
                      v{CURRENT_VERSION} · October 2026
                    </span>
                  </div>

                  <h2
                    id="whats-new-title"
                    className="text-[1.75rem] font-black tracking-[-0.04em] text-white leading-[1.12]"
                  >
                    Your notes just got
                    <br />
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                      superpowers.
                    </span>
                  </h2>
                </div>

                {/* ── Feature list ── */}
                <div className="px-3 pb-2 relative z-10">
                  {FEATURES.map((feature, i) => {
                    const Icon = feature.icon;
                    return (
                      <motion.div
                        key={feature.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.18 + i * 0.07, duration: 0.28, ease: "easeOut" }}
                        className="flex items-start gap-3.5 px-3 py-3.5 rounded-xl hover:bg-white/[0.03] transition-colors"
                      >
                        {/* Icon badge */}
                        <div
                          className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${feature.iconClass}`}
                        >
                          <Icon size={15} strokeWidth={2} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[13.5px] font-semibold text-white tracking-tight">
                              {feature.label}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full ${feature.badgeClass}`}
                            >
                              {feature.badge}
                            </span>
                          </div>
                          <p className="text-[12px] text-white/35 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 pt-3 pb-4 border-t border-white/[0.05] mt-1 relative z-10">
                  <button
                    id="whats-new-continue"
                    onClick={onDismiss}
                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[13.5px] font-bold tracking-tight flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/20"
                  >
                    Continue to Notesify
                    <ArrowRight size={15} />
                  </button>
                  <p className="text-center text-[11px] text-white/18 mt-2.5">
                    Press <kbd className="font-mono bg-white/5 px-1 rounded text-[10px]">Esc</kbd> or click Continue to close
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
