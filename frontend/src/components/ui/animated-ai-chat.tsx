import React, { useRef, useEffect, useCallback, useState } from "react";
import { 
    ArrowUpIcon, 
    Paperclip, 
    Command, 
    XIcon, 
    LoaderIcon,
    FileText,
    BrainCircuit,
    Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
    value?: string;
    textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function useAutoResizeTextarea({
    minHeight = 52,
    maxHeight = 200,
    value,
    textareaRef: externalRef,
}: UseAutoResizeTextareaProps) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = externalRef || internalRef;

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset || !textarea.value) {
                textarea.style.height = `${minHeight}px`;
                textarea.style.overflowY = "hidden";
                return;
            }

            // Reset to 0px temporarily to calculate accurate content scrollHeight
            textarea.style.height = "0px";
            const scrollHeight = textarea.scrollHeight;
            const limit = maxHeight ?? 200;
            const nextHeight = Math.max(minHeight, Math.min(scrollHeight, limit));

            textarea.style.height = `${nextHeight}px`;
            textarea.style.overflowY = scrollHeight > limit ? "auto" : "hidden";
        },
        [minHeight, maxHeight, textareaRef]
    );

    useEffect(() => {
        adjustHeight();
    }, [adjustHeight, value]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
    onSelect?: () => void;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    return (
      <div className={cn("relative w-full", containerClassName)}>
        <textarea
          className={cn(
            "w-full rounded-md bg-transparent px-3 py-2 text-sm text-white/90",
            "placeholder:text-white/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0" : "",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export interface AnimatedAIChatProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isTyping?: boolean;
  onAttachClick?: () => void;
  onStop?: () => void;
  attachments?: React.ReactNode;
  extraActionButtons?: React.ReactNode;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  showHeading?: boolean;
  commands?: CommandSuggestion[];
}

export function AnimatedAIChat({
  value,
  onChange,
  onSubmit,
  isTyping = false,
  onAttachClick,
  onStop,
  attachments,
  extraActionButtons,
  textareaRef: externalTextareaRef,
  placeholder = "Ask Iris anything...",
  showHeading = false,
  commands
}: AnimatedAIChatProps) {
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 52,
        maxHeight: 200,
        value,
        textareaRef: externalTextareaRef,
    });
    const commandPaletteRef = useRef<HTMLDivElement>(null);

    const defaultCommands: CommandSuggestion[] = [
        { 
            icon: <FileText className="w-4 h-4" />, 
            label: "Summarize", 
            description: "Summarize the current note", 
            prefix: "/summarize" 
        },
        { 
            icon: <BrainCircuit className="w-4 h-4" />, 
            label: "Create Quiz", 
            description: "Generate a quiz from your notes", 
            prefix: "/quiz" 
        },
        { 
            icon: <Search className="w-4 h-4" />, 
            label: "Search", 
            description: "Search globally across all notes", 
            prefix: "/search" 
        }
    ];

    const commandSuggestions = commands || defaultCommands;

    useEffect(() => {
        if (value.startsWith('/')) {
            setShowCommandPalette(true);
        } else {
            setShowCommandPalette(false);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                commandPaletteRef.current && 
                !commandPaletteRef.current.contains(event.target as Node) &&
                !(event.target as HTMLElement).closest('[data-command-button]')
            ) {
                setShowCommandPalette(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === 'Tab' || (e.key === 'Enter' && activeSuggestion >= 0)) {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    const selectedCommand = commandSuggestions[activeSuggestion];
                    if (selectedCommand.onSelect) {
                        selectedCommand.onSelect();
                        onChange('');
                    } else {
                        onChange(selectedCommand.prefix + ' ');
                    }
                    setShowCommandPalette(false);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                onSubmit();
                adjustHeight(true);
            }
        }
    };

    const handleSendMessage = () => {
        if (value.trim()) {
            onSubmit();
            adjustHeight(true);
        }
    };
    
    const selectCommandSuggestion = (index: number) => {
        const selectedCommand = commandSuggestions[index];
        if (selectedCommand.onSelect) {
            selectedCommand.onSelect();
            onChange('');
        } else {
            onChange(selectedCommand.prefix + ' ');
        }
        setShowCommandPalette(false);
    };

    return (
        <div className={cn("flex flex-col w-full relative", showHeading ? "min-h-screen items-center justify-center p-6" : "")}>
            {showHeading && (
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                    <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
                </div>
            )}
            
            <div className="w-full max-w-3xl mx-auto relative">
                <motion.div 
                    className="relative z-10 space-y-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {showHeading && (
                        <div className="text-center space-y-3 mb-8">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="inline-block"
                            >
                                <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1">
                                    How can I help today?
                                </h1>
                                <motion.div 
                                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 0.3, duration: 0.8 }}
                                />
                            </motion.div>
                        </div>
                    )}

                    <motion.div 
                        className="relative backdrop-blur-2xl bg-[#14141a]/90 rounded-xl border border-white/10 shadow-2xl p-2.5 space-y-2"
                        initial={{ scale: 0.98 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AnimatePresence>
                            {showCommandPalette && (
                                <motion.div 
                                    ref={commandPaletteRef}
                                    className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div className="py-1 bg-black/95">
                                        {commandSuggestions.map((suggestion, index) => (
                                            <motion.div
                                                key={suggestion.prefix}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                                                    activeSuggestion === index 
                                                        ? "bg-white/10 text-white" 
                                                        : "text-white/70 hover:bg-white/5"
                                                )}
                                                onClick={() => selectCommandSuggestion(index)}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.03 }}
                                            >
                                                <div className="w-5 h-5 flex items-center justify-center text-white/60">
                                                    {suggestion.icon}
                                                </div>
                                                <div className="font-medium">{suggestion.label}</div>
                                                <div className="text-white/40 text-xs ml-1">
                                                    {suggestion.prefix}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="px-1 pt-0.5">
                            <Textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => {
                                    onChange(e.target.value);
                                    adjustHeight();
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                containerClassName="w-full"
                                className={cn(
                                    "w-full px-2 py-1.5",
                                    "resize-none",
                                    "bg-transparent",
                                    "border-none",
                                    "text-white/90 text-sm leading-relaxed",
                                    "focus:outline-none",
                                    "placeholder:text-white/30",
                                    "min-h-[52px]",
                                    "max-h-[200px]",
                                    "max-sm:max-h-[160px]",
                                    "custom-scrollbar"
                                )}
                                showRing={false}
                            />
                        </div>

                        {attachments && (
                            <div className="px-2 pb-1">
                                {attachments}
                            </div>
                        )}

                        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {onAttachClick && (
                                    <motion.button
                                        type="button"
                                        onClick={onAttachClick}
                                        whileTap={{ scale: 0.94 }}
                                        className="px-2.5 py-1 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer relative group"
                                        title="Attach file (image or PDF)"
                                    >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        <span>Attach</span>
                                    </motion.button>
                                )}
                                <motion.button
                                    type="button"
                                    data-command-button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCommandPalette(prev => !prev);
                                    }}
                                    whileTap={{ scale: 0.94 }}
                                    className={cn(
                                        "px-2.5 py-1 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer relative group",
                                        showCommandPalette && "bg-white/10 text-white/90"
                                    )}
                                    title="Quick AI Commands"
                                >
                                    <Command className="w-3.5 h-3.5" />
                                    <span>Tools</span>
                                </motion.button>

                                <div className="h-3.5 w-px bg-white/10 mx-0.5"></div>
                                {extraActionButtons}
                            </div>
                            
                            {isTyping && onStop ? (
                                <motion.button
                                    type="button"
                                    onClick={onStop}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="p-1.5 rounded-lg text-white hover:text-red-400 bg-white/5 hover:bg-red-400/10 transition-colors"
                                    title="Stop generating"
                                >
                                    <XIcon className="w-4 h-4" />
                                </motion.button>
                            ) : (
                                <motion.button
                                    type="button"
                                    onClick={handleSendMessage}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={isTyping || (!value.trim() && !attachments)}
                                    className={cn(
                                        "w-8 h-8 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0",
                                        value.trim() || attachments
                                            ? "bg-white text-black shadow-md hover:bg-white/90"
                                            : "bg-white/5 text-white/30 cursor-not-allowed"
                                    )}
                                    title="Send message"
                                >
                                    {isTyping ? (
                                        <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                                    ) : (
                                        <ArrowUpIcon className="w-4 h-4" />
                                    )}
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
