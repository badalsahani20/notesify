import { Star, Cpu } from 'lucide-react';

export const SocialProof = () => {
  return (
    <section className="relative py-12 z-20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="group flex items-center gap-2 cursor-default">
              <div className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star 
                    key={i} 
                    className="h-4 w-4 fill-amber-400 text-amber-400 transition-colors"
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-white">4.9/5</span>
              <span className="text-xs text-stone-400">from early users</span>
            </div>

            <div className="hidden sm:block h-5 w-px bg-white/10" />

            <div className="group flex items-center gap-2 text-sm text-stone-300 cursor-default">
              <div className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Cpu className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium text-white">OpenRouter</span>
              <span className="text-xs text-stone-400 font-mono">AI Provider</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
