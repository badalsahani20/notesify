import { FadeIn } from '../ui/FadeIn';
import { Starfield } from '../ui/Starfield';

export const Hero = () => {
  return (
    <section className="relative w-full min-h-[110vh] flex flex-col items-center justify-center pt-32 pb-48 overflow-hidden z-10 bg-[#050505]">
      {/* Stars only in the sky of the Hero */}
      <Starfield />

      <div className="relative z-20 flex flex-col items-center max-w-4xl px-6 text-center mt-10">
        <FadeIn delay={300}>
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-10 group cursor-pointer transition-all duration-500 hover:scale-110">
            {/* The Morphing Background */}
            <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 iris-hero-blob shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all duration-700 group-hover:shadow-[0_0_60px_rgba(99,102,241,0.8)] group-hover:rotate-90`}></div>
            <div className="absolute inset-1 bg-[#050505] iris-hero-blob transition-all duration-700 group-hover:scale-90"></div>
            
            {/* The Inner Liquid */}
            <div className="absolute inset-3 bg-gradient-to-br from-indigo-400 to-purple-500 iris-hero-blob opacity-40 animate-pulse"></div>
            
            {/* The Core Nucleus */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-4 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,1)] animate-pulse"></div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={350}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/10 text-stone-300 mb-6 backdrop-blur-md hover:border-indigo-500/40 transition-all">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Offline-Ready Workspace</span>
            <span className="text-stone-600">·</span>
            <span className="text-indigo-300">Dual Sync Reconciler</span>
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.15] mb-6">
            A calm space for your <br className="hidden sm:block" />
            notes, <span className="font-serif italic text-indigo-200 font-light tracking-normal transition-all duration-700 group-hover:text-white">quizzes, and flashcards.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={500}>
          <p className="text-sm sm:text-[15px] md:text-base text-stone-400 max-w-[560px] mx-auto mb-10 leading-relaxed">
            Capture notes, generate spaced-repetition flashcards instantly, and study smarter with AI.
          </p>
        </FadeIn>

        <FadeIn delay={600}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://app.notesify.in" 
              className="group relative inline-flex items-center justify-center bg-white text-black hover:bg-stone-200 px-8 py-4 rounded-2xl text-base font-bold transition-all duration-300 w-full sm:w-auto shadow-2xl shadow-white/10 overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                <span className="transition-transform duration-300 group-hover:-translate-x-1">Start writing free</span>
                <div className="relative ml-2 size-5 overflow-hidden">
                  <svg className="absolute inset-0 size-full fill-none stroke-current stroke-2 transition duration-300 group-hover:translate-x-full group-hover:opacity-0 group-hover:blur-sm" viewBox="0 0 24 24">
                    <path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <svg className="absolute inset-0 size-full fill-none stroke-current stroke-2 -translate-x-full opacity-0 blur-sm transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-hover:blur-none group-hover:delay-75" viewBox="0 0 24 24">
                    <path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </span>
            </a>

            <a 
              href="/download/windows"
              className="group inline-flex items-center justify-center rounded-2xl px-8 py-4 text-base font-bold bg-white/5 hover:bg-white/10 transition-all duration-300 text-white border border-white/10 hover:border-white/20 w-full sm:w-auto"
            >
              <svg className="size-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download for Windows
            </a>
            
          </div>
          <p className="mt-6 text-xs text-stone-300 font-medium">Free during public preview · No credit card · Early access</p>
        </FadeIn>
      </div>

      {/* --- Solar Eclipse Horizon Effect --- */}
      <div className="absolute bottom-[-900px] sm:bottom-[-1000px] left-1/2 -translate-x-1/2 w-[250vw] sm:w-[150vw] lg:w-[120vw] h-[1200px] z-0 pointer-events-none transition-all duration-1000">
         
         {/* The radiating rays (streamers) */}
         <div className="absolute inset-0 flex items-center justify-center">
           {[...Array(12)].map((_, i) => (
             <div 
               key={i}
               className="absolute w-[2px] h-[800px] bg-gradient-to-t from-transparent via-indigo-500/20 to-transparent"
               style={{ 
                 transform: `rotate(${i * 15}deg) translateY(-200px)`,
                 opacity: 0.4 + (i % 3) * 0.2
               }}
             />
           ))}
         </div>

         {/* The glowing aura behind the moon (The Corona) */}
         <div className="absolute inset-[-5px] rounded-[100%] bg-white blur-[10px] opacity-40"></div>
         <div className="absolute inset-[-20px] rounded-[100%] bg-gradient-to-t from-indigo-600 via-indigo-400 to-purple-300 blur-[40px] opacity-60"></div>
         <div className="absolute inset-[-60px] rounded-[100%] bg-gradient-to-t from-purple-600 via-indigo-600 to-transparent blur-[80px] opacity-30"></div>
         
         {/* The solid black moon (The Horizon) */}
         {/* Extended Shadow: We make this moon blend into the section background */}
         <div className="absolute inset-0 rounded-[100%] bg-[#050505] shadow-[inset_0_20px_60px_rgba(0,0,0,1)] border-t border-indigo-500/40"></div>
         
         {/* The Diamond Ring Flare on the right edge */}
         <div className="absolute top-[2%] sm:top-[4%] right-[25%] sm:right-[30%] -translate-y-1/2 translate-x-1/2 z-20">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-white rounded-full blur-[60px] opacity-40 mix-blend-screen"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-48 sm:h-48 bg-indigo-500 rounded-full blur-[30px] opacity-90 mix-blend-screen animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-24 sm:h-24 bg-white rounded-full blur-[10px] mix-blend-screen"></div>
            
            {/* Starburst rays */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent rotate-[-15deg] blur-[1px]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-[500px] bg-gradient-to-b from-transparent via-white/80 to-transparent rotate-[-15deg] blur-[1px]"></div>
         </div>
      </div>

      {/* Bouncing Scroll Indicator */}
      <div className="absolute bottom-20 sm:bottom-36 left-1/2 -translate-x-1/2 z-30">
        <a 
          href="#features" 
          className="flex h-10 w-10 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/10 bg-[#050505]/50 backdrop-blur-sm text-stone-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all duration-300 animate-bounce cursor-pointer shadow-lg"
          aria-label="Scroll down"
        >
          <svg className="h-4 w-4 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </a>
      </div>

      {/* --- Global Atmospheric Bottom Fade --- */}
      {/* This ensures that when the user scrolls, the space content fades into solid black */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#050505] to-transparent z-10 pointer-events-none"></div>
    </section>
  );
};
