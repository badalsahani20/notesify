import { useState } from 'react';
import { FadeIn } from '../ui/FadeIn';
import { SpotlightCard } from '../ui/SpotlightCard';
import { MessageSquare, Send } from 'lucide-react';

export const Feedback = () => {
  const [feedback, setFeedback] = useState("");

  const handleSendFeedback = () => {
    if (!feedback.trim()) return;
    const subject = encodeURIComponent("Notesify Feedback & Feature Request");
    const body = encodeURIComponent(feedback);
    const to = "badalsahani233@gmail.com";
    
    // Opens Gmail in a new tab with pre-filled fields
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");
    
    setFeedback("");
  };

  return (
    <section className="relative py-24 z-20 border-t border-white/5 bg-[#050505]">
      <div className="container mx-auto px-6">
        <SpotlightCard className="max-w-4xl mx-auto p-8 md:p-12 overflow-hidden">
          <div className="flex flex-col md:flex-row gap-10">
            <div className="flex-1 text-center md:text-left">
              <FadeIn>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-stone-300 mb-4">
                  <MessageSquare className="w-3.5 h-3.5" />
                  We are listening
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Have feedback or a feature request?</h3>
                <p className="text-stone-400">
                  Notesify is built for you. If you encounter a bug, have a brilliant idea, or just want to say hi, let us know directly.
                </p>
              </FadeIn>
            </div>
            
            <div className="flex-1 w-full">
              <FadeIn delay={200}>
                <div className="flex flex-col gap-3">
                  <textarea 
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us what's on your mind..." 
                    rows={4}
                    className="w-full bg-white/5 rounded-2xl border border-white/10 focus:border-indigo-500/50 transition-all px-4 py-3 text-sm text-white placeholder-stone-500 outline-none resize-none"
                  />
                  <button 
                    onClick={handleSendFeedback}
                    disabled={!feedback.trim()}
                    className="group relative w-full sm:w-auto self-end bg-white text-black hover:bg-stone-200 disabled:bg-white/50 disabled:cursor-not-allowed px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Send to Developer
                      <Send className="size-3.5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </span>
                  </button>
                </div>
                <p className="mt-4 text-[10px] text-right text-stone-500">
                  This will safely open Gmail in a new tab.
                </p>
              </FadeIn>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
};
