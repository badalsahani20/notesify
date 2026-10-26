import { useState, useRef, useEffect } from 'react';
import { FileText, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { SpotlightCard } from '../ui/SpotlightCard';

export const IrisLiveDemo = () => {
  const SUGGESTIONS = [
    {
      label: "Explain useEffect",
      prompt: "Can you explain React's useEffect hook simply?",
      response: "Think of `useEffect` like setting up a side-mission for your component.\n\nIt tells React: \"Hey, after you render this to the screen, I need you to do this extra thing (like fetching data).\"\n\nBasic syntax:\n\n```jsx\nuseEffect(() => {\n  // Do something after render\n}, [dependencies]);\n```\n\nThe dependency array is crucial—it controls exactly when the effect runs!"
    },
    {
      label: "Decline Offer",
      prompt: "Write a polite email declining a project offer.",
      response: "Subject: Thank you for the opportunity\n\nHi [Name],\n\nThank you so much for thinking of me for the [Project Name] project. \n\nUnfortunately, my schedule is fully booked right now and I don't have the bandwidth to give this the attention it deserves, so I will have to respectfully pass. \n\nI'd love to stay in touch for future opportunities.\n\nBest regards,\n[Your Name]"
    },
    {
      label: "Tokyo Packing",
      prompt: "What are 3 essential things to pack for Tokyo in October?",
      response: "October in Tokyo is mild and beautiful, but requires smart packing:\n\n1. Comfortable Shoes: You will easily walk 15k+ steps a day navigating the subway.\n2. Light Layers: It's warm during the day but cools off at night. A light jacket is perfect.\n3. Coin Pouch: Japan uses a lot of coins for vending machines and street food, and your wallet will fill up fast!"
    },
    {
      label: "Recent Tech News",
      prompt: "What is happening in tech news today?",
      response: [
        "Just in: China has proposed new labor regulations that strictly restrict companies from replacing human workers with AI solely for the purpose of cutting costs. It is a massive precedent for global AI labor laws and corporate accountability.",
        "Breaking: OpenAI just announced a new tier of 'reasoning' models that spend up to 2 minutes 'thinking' before answering complex math and coding queries. It is a massive leap forward for agentic AI and autonomous research.",
        "Update: The EU just passed the final draft of the AI Act, imposing heavy fines on tech giants that deploy 'high-risk' generative AI without proper transparency, data provenance, and clear AI watermarking."
      ]
    }
  ];

  const FALLBACK_RESPONSE = "Whoa, look at you, typing a custom prompt like a real rebel.\n\nHate to break the fourth wall here, but this is a landing page preview. If I actually hooked up a live API key here, some bot net would rack up a $10,000 LLM bill before I could even say 'chimichangas'.\n\nIf you want the *actual* magic (and trust me, it's good), sign in to the real app. Until then, click the shiny predefined buttons above to watch me do my simulated party tricks.";

  const [isStreaming, setIsStreaming] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [newsIndex, setNewsIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response]);

  const mockStream = async (text: string) => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setResponse("");
    
    // Find matching predefined response, or use fallback
    const matchedSuggestion = SUGGESTIONS.find(s => s.prompt === text);
    let targetResponse = FALLBACK_RESPONSE;

    if (matchedSuggestion) {
      if (Array.isArray(matchedSuggestion.response)) {
        // Cycle through the array sequentially so they see a new one each time
        targetResponse = matchedSuggestion.response[newsIndex % matchedSuggestion.response.length];
        setNewsIndex(prev => prev + 1);
      } else {
        targetResponse = matchedSuggestion.response;
      }
    }

    // Simulate "Thinking" delay
    await new Promise(r => setTimeout(r, 600));

    let currentText = "";
    // Stream character by character for a smooth LLM feel
    const chars = targetResponse.split("");
    
    for (let i = 0; i < chars.length; i++) {
      // Randomize typing speed slightly for realism (10ms - 30ms)
      const delay = Math.floor(Math.random() * 20) + 10;
      await new Promise(r => setTimeout(r, delay));
      currentText += chars[i];
      setResponse(currentText);
    }
    
    setIsStreaming(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isStreaming) {
      mockStream(prompt.trim());
    }
  };

  return (
    <SpotlightCard className="overflow-hidden shadow-2xl shadow-indigo-900/10 text-left flex flex-col h-[600px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 shrink-0">
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <span className="size-2 rounded-full bg-emerald-400" />
          <FileText className="h-3.5 w-3.5 text-stone-400" />
          <span className="font-mono text-stone-300">iris-query-router.ts</span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-stone-300 font-mono">
          <Sparkles className="h-3 w-3 text-indigo-400" />
          <span>Multi-Tier Router</span>
        </div>
      </div>

      <div className="p-5 sm:p-6 bg-[#0a0a0a] flex-1 overflow-y-auto iris-scrollbar" ref={scrollRef}>
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-[11px] font-medium tracking-widest text-stone-500 uppercase">
              Select a prompt or type your own
            </label>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => {
                    setPrompt(s.prompt);
                    mockStream(s.prompt);
                  }}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-colors disabled:opacity-50 bg-indigo-500/5"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Go ahead, type a custom prompt. I totally won't ignore it. Promise."
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-stone-600 outline-none focus:border-indigo-500/50 transition-colors" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <span className="absolute bottom-3 right-3 text-[10px] text-stone-500 font-mono">
                {prompt.length}/500
              </span>
            </div>
            
            <button
              type="submit"
              disabled={isStreaming || !prompt.trim()}
              className="flex items-center justify-center gap-2 bg-white text-black hover:bg-stone-200 disabled:bg-white/50 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-bold transition w-full sm:w-auto"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iris is thinking…
                </>
              ) : (
                <>
                  Ask Iris
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {(response || isStreaming) && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2 text-[11px] font-medium text-indigo-400 uppercase tracking-wider">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-900 border border-white/10">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                </span>
                Iris
                {isStreaming && !response && (
                  <span className="flex items-center gap-1 ml-2 text-stone-400 lowercase tracking-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    thinking
                  </span>
                )}
              </div>
              <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-sans">
                {response}
                {isStreaming && (
                  <span className="inline-block w-[2px] h-4 bg-indigo-500 align-middle ml-1 animate-blink" />
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
};
