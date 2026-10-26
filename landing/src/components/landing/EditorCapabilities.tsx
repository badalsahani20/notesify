import { FadeIn } from '../ui/FadeIn';
import { SpotlightCard } from '../ui/SpotlightCard';
import editorPreview from '../../assets/editor-preview.png';

const CapabilityIcon = ({ title }: { title: string }) => {
  const baseClasses = "relative shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-all duration-500 group-hover:scale-110 overflow-hidden shadow-sm group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]";

  if (title === "Real-Time Code Blocks") {
    return (
      <div className={baseClasses}>
        <div className="flex items-center gap-1 font-mono text-indigo-400 font-bold text-xs">
          <span className="transition-transform duration-500 group-hover:-translate-x-1 opacity-70 group-hover:opacity-100">&lt;</span>
          <span className="w-[1.5px] h-3.5 bg-indigo-400 shadow-[0_0_4px_rgba(129,140,248,0.8)] animate-pulse group-hover:scale-y-110" />
          <span className="transition-transform duration-500 group-hover:translate-x-1 opacity-70 group-hover:opacity-100">&gt;</span>
        </div>
      </div>
    );
  }

  if (title === "Drag & Drop Images") {
    return (
      <div className={baseClasses}>
        {/* Dropzone border */}
        <div className="absolute inset-2 border border-dashed border-indigo-400/40 rounded transition-all duration-500 group-hover:border-solid group-hover:border-indigo-400/80 group-hover:bg-indigo-500/20" />
        {/* Floating Image */}
        <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-indigo-500/40 backdrop-blur-md border border-indigo-400/60 rounded-sm transition-all duration-500 group-hover:top-1/2 group-hover:right-1/2 group-hover:-translate-y-1/2 group-hover:translate-x-1/2 flex items-center justify-center overflow-hidden shadow-lg">
           <div className="absolute bottom-0 w-full h-[1.5px] bg-indigo-300" />
           <div className="absolute top-[2px] right-[2px] w-[2px] h-[2px] bg-white rounded-full shadow-[0_0_2px_rgba(255,255,255,0.8)]" />
        </div>
      </div>
    );
  }

  if (title === "Structure-Preserving Tables") {
    return (
      <div className={baseClasses}>
        <div className="grid grid-cols-2 gap-[1px] bg-indigo-400/20 border border-indigo-400/30 rounded-sm p-[1px] transition-all duration-500 group-hover:gap-[2px] group-hover:scale-110 group-hover:bg-indigo-400/40">
          <div className="w-2.5 h-1.5 bg-indigo-400/40 rounded-[1px] transition-colors duration-300 group-hover:bg-white" />
          <div className="w-2.5 h-1.5 bg-indigo-400/40 rounded-[1px] transition-colors duration-300 delay-75 group-hover:bg-indigo-200" />
          <div className="w-2.5 h-1.5 bg-indigo-400/40 rounded-[1px] transition-colors duration-300 delay-75 group-hover:bg-indigo-300" />
          <div className="w-2.5 h-1.5 bg-indigo-400/40 rounded-[1px] transition-colors duration-300 delay-150 group-hover:bg-indigo-400/80" />
        </div>
      </div>
    );
  }

  if (title === "Markdown-Style Speed") {
    return (
      <div className={baseClasses}>
        <div className="flex flex-col items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
           <div className="flex gap-[2px] mb-[2px]">
             <div className="w-1.5 h-3.5 bg-indigo-400/40 rounded-sm group-hover:bg-indigo-400 transition-colors duration-300 skew-x-[-15deg]" />
             <div className="w-1.5 h-3.5 bg-indigo-400/40 rounded-sm group-hover:bg-indigo-400 transition-colors duration-300 skew-x-[-15deg]" />
           </div>
           <div className="absolute w-4 h-1.5 bg-indigo-400/60 rounded-sm group-hover:bg-white transition-colors duration-300 rotate-12 top-2 shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
           <div className="absolute w-4 h-1.5 bg-indigo-400/60 rounded-sm group-hover:bg-indigo-200 transition-colors duration-300 -rotate-12 bottom-2 shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
        </div>
      </div>
    );
  }

  if (title === "Color-Coded Highlights") {
    return (
      <div className={baseClasses}>
        <div className="flex flex-col gap-1 w-5">
           <div className="h-1 w-full bg-indigo-400/20 rounded-full" />
           <div className="relative h-1.5 w-full bg-indigo-400/20 rounded-full overflow-hidden">
             {/* Highlighter swipe */}
             <div className="absolute inset-0 bg-indigo-400 -translate-x-full transition-transform duration-700 ease-out group-hover:translate-x-0 shadow-[0_0_8px_rgba(129,140,248,1)]" />
           </div>
           <div className="h-1 w-4/5 bg-indigo-400/20 rounded-full" />
        </div>
      </div>
    );
  }

  // Auto-Generating Titles
  return (
    <div className={baseClasses}>
      <div className="relative w-5 h-3 border-b-2 border-indigo-400/30 flex items-end justify-center transition-all duration-500 group-hover:border-indigo-400 group-hover:scale-110">
         {/* Sparkles */}
         <div className="absolute -top-1.5 right-0 w-1 h-1 bg-white rounded-full opacity-0 scale-0 transition-all duration-500 delay-100 group-hover:opacity-100 group-hover:scale-100 shadow-[0_0_4px_rgba(255,255,255,1)]" />
         <div className="absolute top-0 left-0 w-[3px] h-[3px] bg-indigo-300 rounded-full opacity-0 scale-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-100 shadow-[0_0_4px_rgba(165,180,252,1)]" />
         {/* Title block growing */}
         <div className="w-0 h-1.5 bg-indigo-400 rounded-t-sm transition-all duration-700 ease-out group-hover:w-full shadow-[0_-2px_6px_rgba(129,140,248,0.8)]" />
      </div>
    </div>
  );
};

export const EditorCapabilities = () => {
  const capabilities = [
    {
      title: "Real-Time Code Blocks",
      desc: "Automatic syntax highlighting for dozens of languages. Just type ``` and start coding.",
    },
    {
      title: "Drag & Drop Images",
      desc: "Drop images directly into your note. They are instantly uploaded and securely hosted.",
    },
    {
      title: "Structure-Preserving Tables",
      desc: "Native markdown tables that actually work. Easy to resize, edit, and keep readable.",
    },
    {
      title: "Markdown-Style Speed",
      desc: "Keep your hands on the keyboard. Use familiar markdown shortcuts for instant formatting.",
    },
    {
      title: "Color-Coded Highlights",
      desc: "Mark what matters with visual priority highlights, keeping long documents easily scannable.",
    },
    {
      title: "Auto-Generating Titles",
      desc: "Iris reads your note and names it for you. Your library stays organized without the busywork.",
    }
  ];

  return (
    <section className="relative py-24 md:py-32 z-20 bg-[#050505] overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <FadeIn>
              <span className="inline-block text-xs font-medium tracking-widest text-indigo-500 uppercase mb-3">
                The Foundation
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                A precision tool for <br />
                <span className="text-indigo-300">focused writing.</span>
              </h2>
              <p className="text-stone-400 text-base sm:text-lg mb-10 max-w-xl">
                Built for precision — fast, predictable, and designed to stay out of your way.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-8">
                {capabilities.map((cap) => (
                  <SpotlightCard key={cap.title} className="group cursor-default p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <CapabilityIcon title={cap.title} />
                      <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{cap.title}</h3>
                    </div>
                    <p className="text-sm text-stone-400 leading-relaxed font-medium">
                      {cap.desc}
                    </p>
                  </SpotlightCard>
                ))}
              </div>
            </FadeIn>
          </div>

          <div className="w-full lg:w-1/2 relative">
            <FadeIn delay={200} className="relative">
              {/* Premium Screenshot Frame */}
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-1 shadow-2xl shadow-black/80 backdrop-blur-3xl group transition-all duration-500 ease-out hover:-translate-y-1">
                <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-[#0a0a0a] border border-white/5">
                  <img 
                    src={editorPreview} 
                    alt="Notesify Editor Preview" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                  />
                  
                  {/* Static reflection */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-20 pointer-events-none"></div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
};
