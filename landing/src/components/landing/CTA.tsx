import { ArrowRight } from 'lucide-react';
import { FadeIn } from '../ui/FadeIn';

export const CTA = () => {
  return (
    <section className="relative py-24 md:py-32 z-20 overflow-hidden">
      <div className="container mx-auto px-6">
        <FadeIn className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white">
            Stop losing your <span className="text-indigo-300">half-thoughts.</span>
          </h2>
          <p className="mt-5 text-stone-400 text-base sm:text-lg max-w-xl mx-auto">
            Transform your scattered thoughts into structured knowledge. Master any topic with AI-powered active learning tools.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4">
            <a 
              href="https://app.notesify.in"
              className="group relative flex items-center justify-center bg-white text-black hover:bg-stone-200 px-10 py-5 rounded-2xl text-base sm:text-lg font-bold transition-all duration-300 w-full sm:w-auto shadow-2xl shadow-white/10 overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                <span className="transition-transform duration-300 group-hover:-translate-x-1">Start writing free</span>
                <div className="relative ml-2 size-5 overflow-hidden">
                  <ArrowRight className="absolute inset-0 size-full transition duration-300 group-hover:translate-x-full group-hover:opacity-0 group-hover:blur-sm" />
                  <ArrowRight className="absolute inset-0 size-full -translate-x-full opacity-0 blur-sm transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-hover:blur-none group-hover:delay-75" />
                </div>
              </span>
            </a>
            <p className="text-xs text-stone-500">
              On public preview · No payment required · <br /> Sign in with Google
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
