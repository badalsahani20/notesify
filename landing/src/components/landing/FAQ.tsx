import { useState } from 'react';
import { FadeIn } from '../ui/FadeIn';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    question: "Is Notesify free to use?",
    answer: "Yes! Notesify is completely free during our public preview phase. You get full access to the markdown editor, global chat, and Iris AI without needing to enter a credit card."
  },
  {
    question: "How is Notesify different from other apps?",
    answer: "Notesify isn't just a place to store text—it's an active learning environment. While most tools focus purely on writing, we focus on understanding. We have built native, AI-generated quizzes and spaced-repetition flashcards directly into your workspace. These active study tools instantly test your recall, highlight weak spots, and help you retain exactly what you learn."
  },
  {
    question: "Will there be a paid plan later?",
    answer: "Eventually, we plan to introduce a Pro tier for heavy AI users to cover the API costs of premium models like DeepSeek. However, our core editor and standard features will always have a generous free tier."
  },
  {
    question: "How does the AI router work?",
    answer: "Iris acts as a smart traffic cop. If you ask a quick question or draft notes, it routes to a fast model (like Qwen 3.7 Flash or Llama) for instant answers. If you ask a complex reasoning question or attach research context, it routes to deep reasoning models (like DeepSeek v4 Flash or GLM 5.3) to give you the highest quality answer."
  },
  {
    question: "Are my notes private?",
    answer: "Absolutely. We don't train any AI models on your personal notes. Your workspace is private to you, and data is only sent to the AI providers when you explicitly ask Iris a question."
  },
  {
    question: "Can I use Notesify completely offline?",
    answer: "Yes! Notesify's desktop and web apps feature local-first storage. You can read, write, and organize notes completely offline without network lag. Changes queue safely on your device and synchronize automatically when you reconnect."
  }
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative py-24 bg-[#050505] border-t border-white/5 z-20">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="text-center mb-16">
          <FadeIn>
            <span className="inline-block text-xs font-medium tracking-widest text-indigo-500 uppercase mb-3">
              Clear the air
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
              Frequently Asked Questions
            </h2>
          </FadeIn>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <FadeIn key={index} delay={100 + index * 50}>
                <div 
                  className={`glass-card overflow-hidden transition-all duration-300 ${isOpen ? 'border-indigo-500/30 bg-white/5' : 'border-white/5 hover:border-white/10'}`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-5 sm:p-6 text-left outline-none"
                  >
                    <span className="text-sm sm:text-base font-semibold text-white">
                      {faq.question}
                    </span>
                    <div className={`flex shrink-0 items-center justify-center size-8 rounded-full bg-white/5 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-indigo-500/20 text-indigo-400' : 'text-stone-400'}`}>
                      <ChevronDown className="size-4" />
                    </div>
                  </button>
                  
                  <div 
                    className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="p-5 sm:p-6 pt-0 text-sm sm:text-base text-stone-400 leading-relaxed">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
};
