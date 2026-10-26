import { FadeIn } from '../ui/FadeIn';
import studyScreenshot from '../../assets/study-screenshot.png';

export const StudyTools = () => {
  return (
    <section id="study" className="relative py-24 md:py-32 z-20 bg-[#050505] overflow-hidden border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="w-full lg:w-1/2">
            <FadeIn>
              <span className="inline-block text-xs font-medium tracking-widest text-emerald-500 uppercase mb-3">
                Active Recall
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
                Turn your notes into <br className="hidden sm:block" />
                <span className="text-emerald-400">interactive study sessions.</span>
              </h2>
              <p className="text-stone-400 text-base sm:text-lg mb-10 max-w-xl leading-relaxed">
                Don't just read your notes. Notesify's AI instantly generates quizzes and spaced-repetition flashcards directly from your documents to help you retain more.
              </p>
              
              <div className="space-y-6">
                 <div className="flex items-start gap-4 group">
                   <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 transition-colors group-hover:border-emerald-500/40">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                   </div>
                   <div>
                     <h3 className="text-lg font-bold text-white mb-1 transition-colors group-hover:text-emerald-400">Instant Flashcards</h3>
                     <p className="text-sm text-stone-400 leading-relaxed font-medium">Automatically extracts key concepts into flashcard decks so you can review on the go.</p>
                   </div>
                 </div>

                 <div className="flex items-start gap-4 group">
                   <div className="w-12 h-12 shrink-0 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20 transition-colors group-hover:border-teal-500/40">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                   </div>
                   <div>
                     <h3 className="text-lg font-bold text-white mb-1 transition-colors group-hover:text-teal-400">MCQ Quizzes</h3>
                     <p className="text-sm text-stone-400 leading-relaxed font-medium">Test your knowledge with AI-generated multiple choice questions embedded in your workflow.</p>
                   </div>
                 </div>
              </div>
            </FadeIn>
          </div>

          <div className="w-full lg:w-1/2 relative">
            <FadeIn delay={200} className="relative">
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-1 shadow-2xl shadow-black/80 backdrop-blur-3xl group transition-all duration-500 ease-out hover:-translate-y-1">
                <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-[#0a0a0a] border border-white/5">
                  <img src={studyScreenshot} alt="Notesify Study Mode Flashcards and Quizzes" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-20 pointer-events-none" />
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
};
