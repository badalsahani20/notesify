import { FadeIn } from '../ui/FadeIn';
import { EditorPreview } from './EditorPreview';

const HighlightIcon = ({ title }: { title: string }) => {
  if (title === "Multimodal & Document Analysis") {
    return (
      <div className="relative h-12 w-12 shrink-0 group perspective-1000">
        <div className="relative h-full w-full rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center overflow-hidden transition-colors group-hover:border-white/20">
          {/* Document Base */}
          <div className="absolute w-5 h-6 bg-white/5 border border-white/10 rounded overflow-hidden transition-all duration-500 group-hover:-translate-x-2 group-hover:rotate-[-10deg]">
            <div className="absolute top-1 left-1 right-2 h-[1.5px] bg-white/20 rounded-full" />
            <div className="absolute top-2.5 left-1 right-1 h-[1.5px] bg-white/20 rounded-full" />
            <div className="absolute top-4 left-1 right-3 h-[1.5px] bg-white/20 rounded-full" />
          </div>
          {/* Image/Orb (Multimodal) */}
          <div className="absolute w-5 h-6 bg-indigo-500/10 border border-indigo-500/30 rounded overflow-hidden transition-all duration-500 translate-x-1.5 translate-y-1.5 group-hover:translate-x-2.5 group-hover:translate-y-2.5 group-hover:rotate-[10deg] group-hover:border-indigo-400/50 group-hover:bg-indigo-500/20">
            <div className="absolute bottom-0 left-0 right-0 h-2.5 bg-indigo-500/30 rounded-t-full" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-300 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (title === "Transparent Reasoning") {
    return (
      <div className="relative h-12 w-12 shrink-0 group perspective-1000">
        <div className="relative h-full w-full rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center overflow-hidden transition-colors group-hover:border-white/20">
          {/* Outer Pulse Rings */}
          <div className="absolute inset-2 border border-purple-500/30 rounded-full transition-all duration-700 group-hover:scale-[1.8] group-hover:opacity-0" />
          <div className="absolute inset-2 border border-purple-500/30 rounded-full opacity-0 transition-all duration-700 delay-150 group-hover:scale-[1.8] group-hover:opacity-0" />
          
          {/* Central Brain/Core */}
          <div className="relative w-4 h-4 bg-purple-500 rounded-full transition-all duration-500 flex items-center justify-center z-10">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>

          {/* Neural Links */}
          <div className="absolute top-1/2 left-1/2 w-8 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400 to-transparent -translate-x-1/2 -translate-y-1/2 rotate-45 opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <div className="absolute top-1/2 left-1/2 w-8 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400 to-transparent -translate-x-1/2 -translate-y-1/2 -rotate-45 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-75" />
        </div>
      </div>
    );
  }

  // Inline Editor Integration
  return (
    <div className="relative h-12 w-12 shrink-0 group perspective-1000">
      <div className="relative h-full w-full rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-start justify-center p-2.5 overflow-hidden transition-colors group-hover:border-white/20">
        {/* Base Text */}
        <div className="w-4 h-1 bg-white/20 rounded-full mb-1.5 transition-colors duration-300 group-hover:bg-white/40" />
        
        {/* Active Line with Cursor & Ghost Text */}
        <div className="flex items-center gap-1 w-full">
          <div className="w-2 h-1 bg-white/40 rounded-full" />
          <div className="w-[1.5px] h-3 bg-blue-400 animate-pulse" />
          
          {/* Ghost text that slides out on hover */}
          <div className="flex gap-0.5 overflow-hidden w-0 opacity-0 group-hover:w-full group-hover:opacity-100 transition-all duration-500 ease-out">
            <div className="w-2 h-1 bg-blue-400/60 rounded-full" />
            <div className="w-3 h-1 bg-blue-400/60 rounded-full" />
          </div>
        </div>
        
        {/* Bottom Text */}
        <div className="w-5 h-1 bg-white/20 rounded-full mt-1.5 transition-colors duration-300 group-hover:bg-white/40" />
      </div>
    </div>
  );
};

export const AIExperience = () => {
  const highlights = [
    { title: "Multimodal & Document Analysis", desc: "Drag and drop 50-page PDF textbooks or complex diagrams. Iris parses them instantly and injects them into its context." },
    { title: "Transparent Reasoning", desc: "Watch Iris think in real-time. Advanced reasoning models expose their internal logic before delivering the final answer." },
    { title: "Inline Editor Integration", desc: "No more tab switching. Select text, click 'Improve', and review AI ghost-text suggestions directly in your note." },
  ];

  return (
    <section id="ai" className="relative py-24 md:py-32 overflow-hidden z-20 border-t border-white/5 bg-[#050505]">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-14 items-start relative">
          {/* Left: copy + bullets */}
          <FadeIn>
            <div>
              <span className="inline-block text-xs font-medium tracking-widest text-indigo-500 uppercase mb-3">
                The AI Experience
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                An assistant that actually <span className="text-indigo-300">understands your notes</span>
              </h2>
              <p className="mt-5 text-stone-400 text-base sm:text-lg leading-relaxed">
                Iris helps you understand complex topics and notes with surgical efficiency. 
                From real-time research to generating visual diagrams, it provides the depth you need to master any subject instantly.
              </p>

              <div className="mt-10 space-y-8">
                {highlights.map((h) => (
                  <div key={h.title} className="flex items-start gap-5 group cursor-default">
                    <HighlightIcon title={h.title} />
                    <div>
                      <h3 className="text-lg font-bold text-white transition-colors group-hover:text-indigo-400">{h.title}</h3>
                      <p className="text-sm text-stone-400 leading-relaxed font-medium">{h.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Right: sticky editor/chat preview */}
          <FadeIn delay={200} className="relative lg:sticky lg:top-32 h-fit">
            <EditorPreview />
          </FadeIn>
        </div>
      </div>
    </section>
  );
};
