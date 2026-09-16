import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff, Wifi, HardDrive, RefreshCw, ChevronRight, CheckCircle2, Laptop } from 'lucide-react';
import { FadeIn } from '../ui/FadeIn';

export const OfflineShowcase = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "1. Keep working",
      subtitle: "Your notes remain available locally",
      icon: <WifiOff className="size-5 text-amber-400" />,
      tag: "Offline Available",
      description:
        "Lose your Wi-Fi or go off-grid? Notesify doesn't lock you out. Read, create, edit, and organize your notes seamlessly without waiting for a server.",
      detail: "Full local read/write access ensures your productivity never pauses.",
    },
    {
      title: "2. Changes are queued",
      subtitle: "Offline mutations wait safely on your device",
      icon: <HardDrive className="size-5 text-blue-400" />,
      tag: "Persistent Local Storage",
      description:
        "Every change is written locally to your device storage and held in an intelligent, ordered mutation queue.",
      detail: "Edits persist on disk even if you close the application or restart your machine.",
    },
    {
      title: "3. Reconnect",
      subtitle: "Notesify detects the connection automatically",
      icon: <Wifi className="size-5 text-emerald-400" />,
      tag: "Auto-Detection",
      description:
        "The moment network connectivity returns, Notesify's sync manager awakens in the background to initiate synchronization.",
      detail: "Synchronization starts automatically when connectivity returns.",
    },
    {
      title: "4. Synchronize",
      subtitle: "Queued changes are pushed and reconciled",
      icon: <RefreshCw className="size-5 text-indigo-400" />,
      tag: "Conflict-Aware",
      description:
        "Queued changes are pushed and reconciled with the cloud. Version-based conflict detection prevents stale updates from silently overwriting newer server state.",
      detail: "Optimistic concurrency control resolves state safely across web and desktop.",
    },
  ];

  return (
    <section id="offline" className="relative py-28 bg-[#050505] border-t border-white/5 overflow-hidden">
      {/* Subtle Glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
              <Laptop className="size-3.5" />
              <span>Offline-First Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight mb-5">
              Your workspace doesn't stop <br className="hidden sm:inline" />
              when your connection does.
            </h2>
            <p className="text-base sm:text-lg text-stone-400 leading-relaxed">
              Notesify keeps your notes available locally, letting you read, create, edit, and organize your workspace offline.
              When you're back online, your changes are synchronized automatically.
            </p>
          </div>
        </FadeIn>

        {/* Interactive Pipeline & Step Explorer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-10">
          {/* Step Selector (Left) */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-3">
            {steps.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <FadeIn key={idx} delay={100 * (idx + 1)}>
                  <div
                    onClick={() => setActiveStep(idx)}
                    className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? "bg-white/[0.05] border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
                          {step.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-white tracking-tight">
                              {step.title}
                            </h3>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                              {step.tag}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5 font-medium">
                            {step.subtitle}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`size-5 transition-transform duration-300 shrink-0 mt-1 ${
                          isActive ? "text-indigo-400 rotate-90" : "text-stone-600"
                        }`}
                      />
                    </div>

                    {isActive && (
                      <div className="mt-4 pt-3.5 border-t border-white/10 animate-in fade-in duration-300">
                        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                          {step.description}
                        </p>
                        <p className="mt-2 text-[11px] text-stone-500 font-mono">
                          ↳ {step.detail}
                        </p>
                      </div>
                    )}
                  </div>
                </FadeIn>
              );
            })}
          </div>

          {/* Visual Sync Simulator Box (Right) */}
          <div className="lg:col-span-6 flex">
            <FadeIn delay={300} className="w-full flex">
              <div className="w-full rounded-2xl bg-zinc-950/90 border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="size-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-mono text-stone-400 uppercase tracking-wider">
                      Sync Architecture Flow
                    </span>
                  </div>
                  <div>
                    {activeStep < 2 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <WifiOff className="size-3.5" />
                        Offline Mode
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <Wifi className="size-3.5" />
                        Cloud Reconciling
                      </span>
                    )}
                  </div>
                </div>

                {/* Animated Pipeline Diagram */}
                <div className="space-y-3 font-mono text-xs my-auto">
                  {/* Step 1: User Edit */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all duration-300 ${
                      activeStep === 0
                        ? "bg-indigo-500/15 border-indigo-500/50 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                        : "bg-white/[0.02] border-white/5 text-stone-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">✍️</span>
                        <span className="font-semibold text-white">1. You Edit Note</span>
                      </div>
                      <span className="text-[10px] text-stone-400">Zero Network Lag</span>
                    </div>
                  </div>

                  <div className="text-center text-stone-700 text-xs">↓</div>

                  {/* Step 2: Local Workspace */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all duration-300 ${
                      activeStep === 1
                        ? "bg-blue-500/15 border-blue-500/50 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                        : "bg-white/[0.02] border-white/5 text-stone-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">💻</span>
                        <span className="font-semibold text-white">2. Local Workspace (Offline)</span>
                      </div>
                      <span className="text-[10px] text-blue-300">Disk Persistence</span>
                    </div>
                  </div>

                  <div className="text-center text-stone-700 text-xs">↓</div>

                  {/* Step 3: Mutation Queue */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all duration-300 ${
                      activeStep === 2
                        ? "bg-amber-500/15 border-amber-500/50 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        : "bg-white/[0.02] border-white/5 text-stone-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">📋</span>
                        <span className="font-semibold text-white">3. Local Mutation Queue</span>
                      </div>
                      <span className="text-[10px] text-amber-300">Ordered & Persistent</span>
                    </div>
                  </div>

                  <div className="text-center text-stone-700 text-xs">↓</div>

                  {/* Step 4: Cloud Sync */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all duration-300 ${
                      activeStep === 3
                        ? "bg-emerald-500/15 border-emerald-500/50 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        : "bg-white/[0.02] border-white/5 text-stone-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">☁️</span>
                        <span className="font-semibold text-white">4. Cloud Synchronization</span>
                      </div>
                      <span className="text-[10px] text-emerald-300">Conflict-Aware Merge</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-indigo-400" />
                    <span>Active Stage: <strong className="text-white">{steps[activeStep].title}</strong></span>
                  </div>
                  <Link
                    to="/download/windows"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                  >
                    Download for Windows →
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
};
