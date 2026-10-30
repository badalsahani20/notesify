import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

type GenerateNotesDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (promptContext: string) => void;
};

// Custom Select Component with sharp, modern styling (low rounding)
const CustomSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div className="flex flex-col gap-2 relative">
      <label className="text-[10px] font-bold text-[var(--text-strong)] uppercase tracking-widest opacity-80">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs p-3 rounded-lg border border-[var(--divider)] bg-[var(--surface-ghost)] text-[var(--text-strong)] hover:border-indigo-500/30 transition-all text-left shadow-sm active:scale-[0.98]"
      >
        <span className="font-medium">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`text-[var(--muted-text)] transition-transform duration-300 ${isOpen ? "rotate-180 text-indigo-400" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Overlay click-catcher to dismiss dropdown smoothly */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-60 overflow-y-auto rounded-lg border border-[var(--divider)] bg-[var(--panel-bg-strong)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar backdrop-blur-md">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left text-xs p-2.5 rounded-md font-medium transition-colors flex items-center justify-between ${
                    opt.value === value
                      ? "bg-indigo-500/10 text-indigo-400 font-semibold"
                      : "text-[var(--text-main)] hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && <Check size={12} className="text-indigo-400 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export const GenerateNotesDialog = ({ isOpen, onClose, onGenerate }: GenerateNotesDialogProps) => {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Academic");
  const [structure, setStructure] = useState("Detailed Structured Note");
  const [depth, setDepth] = useState("Standard");

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a topic or concept.");
      return;
    }

    const promptContext = `Topic: ${topic}\nPreferred Tone: ${tone}\nFormatting Structure: ${structure}\nStudy Depth: ${depth}`;
    onGenerate(promptContext);
    onClose();
    setTopic("");
  };

  const toneOptions = [
    { value: "Academic", label: "Academic" },
    { value: "Technical / Precise", label: "Technical / Precise" },
    { value: "Simple / Analogy Rich", label: "Simple / Analogy-Rich" },
    { value: "Beginner-Friendly", label: "Beginner-Friendly" },
    { value: "Exam-Oriented", label: "Exam-Oriented" },
    { value: "Q&A Style", label: "Q&A Style" },
  ];

  const structureOptions = [
    { value: "Detailed Structured Note", label: "Detailed Structured Note" },
    { value: "Revision Crash Sheet", label: "Revision Crash Sheet" },
    { value: "Concept + Intuition Mode", label: "Concept + Intuition Mode" },
    { value: "Interview Prep Notes", label: "Interview Prep Notes" },
  ];

  const depthOptions = [
    { value: "Quick", label: "Quick", desc: "Fast revision" },
    { value: "Standard", label: "Standard", desc: "Balanced" },
    { value: "Deep Dive", label: "Deep Dive", desc: "Detailed understanding" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-2xl">
        <div className="flex flex-col bg-[var(--panel-bg)] border border-[var(--divider)] rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          
          <DialogHeader className="px-6 py-5 border-b border-[var(--divider)] bg-[var(--panel-bg-strong)] flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner flex items-center justify-center">
                <div className="iris-orb shrink-0 animate-pulse" style={{ width: "16px", height: "16px", borderWidth: "1px" }} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[var(--text-strong)] tracking-tight">
                  Generate with Iris
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--muted-text)] font-medium mt-0.5">
                  Let Iris craft a high-performance study note for you.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--surface-ghost)] hover:text-[var(--text-strong)] text-[var(--muted-text)] transition-colors"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </DialogHeader>

          <form onSubmit={handleGenerate} className="flex flex-col p-6 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="topic" className="text-[10px] font-bold text-[var(--text-strong)] uppercase tracking-widest opacity-80">
                Topic / Concept Description
              </label>
              <textarea
                id="topic"
                rows={3}
                placeholder="e.g., Photosynthesis light reactions, React Server Components vs Client Components, or explaining Quantum entanglement..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full text-sm p-3.5 rounded-lg border border-[var(--divider)] bg-[var(--surface-ghost)] text-[var(--text-strong)] focus:outline-none focus:border-indigo-500/40 resize-none transition-all placeholder:text-[var(--muted-text)] placeholder:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CustomSelect
                label="Explanation Tone"
                value={tone}
                onChange={setTone}
                options={toneOptions}
              />
              <CustomSelect
                label="Study Structure"
                value={structure}
                onChange={setStructure}
                options={structureOptions}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[var(--text-strong)] uppercase tracking-widest opacity-80">
                Study Depth
              </label>
              <div className="grid grid-cols-3 p-1 rounded-lg border border-[var(--divider)] bg-[var(--surface-ghost)] gap-1">
                {depthOptions.map((opt) => {
                  const isActive = depth === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDepth(opt.value)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all ${
                        isActive
                          ? "bg-white text-zinc-950 shadow-md font-semibold dark:bg-white dark:text-zinc-950"
                          : "text-[var(--text-main)] hover:text-[var(--text-strong)] hover:bg-white/5 font-medium"
                      }`}
                    >
                      <span className="text-[11px] leading-tight">{opt.label}</span>
                      <span className={`text-[9px] mt-0.5 opacity-80 leading-none ${isActive ? "text-indigo-100 font-normal" : "text-[var(--muted-text)] font-normal"}`}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 text-[11px] leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-indigo-400" />
              <span>
                Iris will generate a beautifully structured markdown study block that you can stream in, preview, copy, or insert at your cursor in the editor!
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--divider)] pt-5 mt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-10 rounded-lg text-[var(--muted-text)] hover:bg-[var(--surface-ghost)] text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold gap-1.5 px-5 shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <div className="iris-orb shrink-0 animate-pulse" style={{ width: "12px", height: "12px", borderWidth: "1px", boxShadow: "none" }} />
                Generate Study Note
              </Button>
            </div>
          </form>

        </div>
      </DialogContent>
    </Dialog>
  );
};
