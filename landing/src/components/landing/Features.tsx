import { FadeIn } from '../ui/FadeIn';
import { SpotlightCard } from '../ui/SpotlightCard';

const FeatureIcon = ({ title }: { title: string }) => {
  if (title === "An Assistant That Researches") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-indigo-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
           <div className="iris-shape scale-75 origin-center group-hover:scale-90 transition-all duration-500 shadow-glow" />
        </div>
      </div>
    );
  }

  if (title === "The Right Tool For The Job") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-purple-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
          {/* Paths */}
          <div className="absolute left-2 top-1/2 w-3 h-[1.5px] bg-white/20 -translate-y-1/2" />
          <div className="absolute left-5 top-3 w-[1.5px] h-3 bg-white/20 rotate-45 origin-bottom-left" />
          <div className="absolute left-5 bottom-3 w-[1.5px] h-3 bg-white/20 -rotate-45 origin-top-left" />
          
          {/* Destination Nodes */}
          <div className="absolute right-2 top-2.5 w-2 h-2 rounded-full border border-white/20 transition-all duration-300" />
          <div className="absolute right-2 bottom-2.5 w-2 h-2 rounded-full border border-white/20 transition-all duration-300" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/20 transition-all duration-300 group-hover:border-purple-400 group-hover:bg-purple-500/50 group-hover:shadow-[0_0_10px_rgba(168,85,247,0.8)]" />

          {/* Active Path glowing line */}
          <div className="absolute left-2 top-1/2 w-6 h-[1.5px] bg-purple-400 -translate-y-1/2 shadow-[0_0_5px_rgba(168,85,247,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-[-100%] group-hover:translate-x-0" />
        </div>
      </div>
    );
  }

  if (title === "Never Leave Your Editor") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-blue-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
          {/* Main Editor window */}
          <div className="absolute inset-2 border border-white/10 rounded overflow-hidden transition-all duration-500 group-hover:pr-3">
             <div className="w-full h-1 bg-white/5 border-b border-white/10" />
             <div className="p-1 space-y-1">
               <div className="w-full h-[1.5px] bg-white/20 rounded-full" />
               <div className="w-4/5 h-[1.5px] bg-white/20 rounded-full" />
             </div>
             {/* Slide-out side panel (Iris) */}
             <div className="absolute right-0 top-1 bottom-0 w-3 bg-blue-500/10 border-l border-blue-500/30 translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out flex items-center justify-center">
               <div className="w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_4px_rgba(96,165,250,0.8)] animate-pulse" />
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (title === "Write Together, Not Alone") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-indigo-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
          {/* Magic Wand / Sparkle */}
          <svg className="absolute w-4 h-4 text-indigo-400 opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 -translate-y-1 group-hover:-translate-y-2 group-hover:translate-x-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" className="origin-center animate-[spin_3s_linear_infinite]" />
          </svg>
          
          {/* Paragraph Lines changing color */}
          <div className="flex flex-col gap-1 w-6 transition-all duration-500 group-hover:translate-y-1 group-hover:-translate-x-1">
            <div className="h-[2px] w-full bg-white/30 rounded-full transition-colors duration-500 group-hover:bg-indigo-400/80 group-hover:shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
            <div className="h-[2px] w-5/6 bg-white/30 rounded-full transition-colors duration-500 delay-75 group-hover:bg-indigo-400/80 group-hover:shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
            <div className="h-[2px] w-4/6 bg-white/30 rounded-full transition-colors duration-500 delay-150 group-hover:bg-indigo-400/80 group-hover:shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
          </div>
        </div>
      </div>
    );
  }

  if (title === "AI Learning Tools") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-emerald-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
           <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-1.54-2.44 2.5 2.5 0 0 1 2-2.45V4.5A2.5 2.5 0 0 1 9.5 2z" />
             <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 1.54-2.44 2.5 2.5 0 0 0-2-2.45V4.5A2.5 2.5 0 0 0 14.5 2z" />
           </svg>
           <div className="absolute inset-0 bg-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
        </div>
      </div>
    );
  }

  if (title === "Share With Confidence") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-rose-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-rose-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
           {/* Link Base */}
           <svg className="w-5 h-5 text-white/40 transition-all duration-500 group-hover:-translate-x-1 group-hover:opacity-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
             <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
           </svg>
           {/* Lock snaps into place */}
           <svg className="absolute w-5 h-5 text-rose-400 scale-50 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100 group-hover:shadow-[0_0_10px_rgba(244,63,94,0.5)] rounded-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
             <path d="M7 11V7a5 5 0 0 1 10 0v4" className="group-hover:stroke-rose-300" />
           </svg>
           {/* Ripple wave */}
           <div className="absolute inset-0 rounded-full border border-rose-400/50 scale-0 opacity-0 group-hover:animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
        </div>
      </div>
    );
  }

  if (title === "Offline-First Reliability") {
    return (
      <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-emerald-500/40 group-hover:blur-xl" />
        <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
        </div>
      </div>
    );
  }

  // Grows With Your Thoughts
  return (
    <div className="relative mb-5 group h-12 w-12 shrink-0 perspective-1000">
      <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-md transition-all duration-500 group-hover:bg-indigo-500/40 group-hover:blur-xl" />
      <div className="relative h-full w-full rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105">
        {/* Iso Stack Layers */}
        <div className="absolute w-6 h-6 border border-indigo-400/20 rounded bg-indigo-500/5 transition-all duration-500 group-hover:translate-y-[-6px] group-hover:-translate-x-1 group-hover:rotate-12 group-hover:border-indigo-400/80 group-hover:shadow-[0_0_10px_rgba(129,140,248,0.5)] z-30" />
        <div className="absolute w-6 h-6 border border-indigo-400/20 rounded bg-indigo-500/5 transition-all duration-500 group-hover:translate-y-[0px] group-hover:rotate-6 group-hover:border-indigo-400/50 z-20" />
        <div className="absolute w-6 h-6 border border-indigo-400/20 rounded bg-indigo-500/5 transition-all duration-500 group-hover:translate-y-[6px] group-hover:translate-x-1 group-hover:border-indigo-400/30 z-10" />
      </div>
    </div>
  );
};

export const Features = () => {
  const features = [
    {
      title: "Offline-First Reliability",
      desc: "Your workspace doesn't stop when your connection does. Write, edit, and organize locally; changes synchronize automatically when reconnected.",
    },
    {
      title: "An Assistant That Researches",
      desc: "Iris doesn't guess. It browses the live web to find the exact, up-to-date information you need before answering.",
    },
    {
      title: "AI Learning Tools",
      desc: "Turn any note into an interactive quiz or a deck of spaced-repetition flashcards instantly. Learn faster, not longer. (New!)",
    },
    {
      title: "The Right Tool For The Job",
      desc: "Whether you need a quick grammar fix or deep logical reasoning, Iris selects the most capable AI model behind the scenes.",
    },
    {
      title: "Never Leave Your Editor",
      desc: "Don't break your flow. Drop a link or ask a question, and Iris will summarize the answers right next to your notes.",
    },
    {
      title: "Write Together, Not Alone",
      desc: "Select a rough paragraph and let Iris polish it. Review suggestions as inline 'ghost text' and accept them with a single click.",
    },
  ];

  return (
    <section id="features" className="relative py-24 md:py-32 z-20 bg-[#050505]">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-14 md:mb-20">
          <FadeIn>
            <span className="inline-block text-xs font-medium tracking-widest text-indigo-500 uppercase mb-3">
              Core Features
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              Where writing meets <span className="gradient-text">real-time intelligence</span>
            </h2>
            <p className="mt-4 text-stone-400 text-base sm:text-lg">
              A focused set of tools that get out of the way — so writing feels effortless.
            </p>
          </FadeIn>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 100}>
              <SpotlightCard className="p-8 group h-full flex flex-col">
                <FeatureIcon title={f.title} />
                <h3 className="text-xl font-bold mb-3 text-white transition-colors group-hover:text-indigo-400">{f.title}</h3>
                <p className="text-sm text-stone-400 leading-relaxed font-medium">{f.desc}</p>
              </SpotlightCard>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};
