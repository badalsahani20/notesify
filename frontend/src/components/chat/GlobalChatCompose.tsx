import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";
import { X, FileText, Lightbulb, Globe, Search, BrainCircuit, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { motion } from "framer-motion";
import { useGlobalChatStore } from "@/store/useGlobalChatStore";

interface GlobalChatComposeProps {
  input: string;
  setInput: (value: string) => void;
  attachedImage: string | null;
  setAttachedImage: (image: string | null) => void;
  isSending: boolean;
  imageDisabled: boolean;
  handleSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  topSlot?: ReactNode;
  placeholder?: string;
  onStop?: () => void;
  useReasoning?: boolean;
  setUseReasoning?: (val: boolean) => void;
  useWebSearch?: boolean;
  setUseWebSearch?: (val: boolean) => void;
}

export const GlobalChatCompose = ({
  input,
  setInput,
  attachedImage,
  setAttachedImage,
  isSending,
  imageDisabled,
  handleSend,
  textareaRef,
  fileRef,
  topSlot,
  placeholder = "Ask Iris anything...",
  onStop,
  useReasoning = true,
  setUseReasoning,
  useWebSearch = false,
  setUseWebSearch,
}: GlobalChatComposeProps) => {
  const { chatMode, setChatMode } = useGlobalChatStore();
  const [fileAccept, setFileAccept] = useState("image/*,.pdf");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Handle paste image from clipboard
  useEffect(() => {
    const handlePaste = (e: Event) => {
      const clipboardEvent = e as ClipboardEvent;
      const clipboardItems = clipboardEvent.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          if (file.size > 15 * 1024 * 1024) {
            toast.error("Pasted image must be less than 15 MB");
            continue;
          }

          clipboardEvent.preventDefault(); // Prevent pasting the image filename/metadata as text

          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setAttachedImage(event.target.result as string);
              toast.success("Image attached from clipboard!");
            }
          };
          reader.readAsDataURL(file);
          break; // Only attach the first image if multiple are pasted
        }
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("paste", handlePaste);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener("paste", handlePaste);
      }
    };
  }, [textareaRef, setAttachedImage]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File must be less than 15 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setAttachedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImageClick = () => {
    if (imageDisabled) {
      toast.error("Image analysis is temporarily unavailable. Try again later.");
      return;
    }
    fileRef.current?.click();
  };

  const openFilePicker = (accept: string) => {
    setFileAccept(accept);
    window.setTimeout(() => fileRef.current?.click(), 0);
  };

  const isPdf = attachedImage?.startsWith("data:application/pdf");

  const renderAttachments = () => {
    if (!attachedImage) return null;
    
    return (
      <motion.div 
        className="flex gap-2 flex-wrap"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="relative group inline-flex items-center gap-2 text-xs bg-white/[0.05] border border-white/10 py-1.5 px-3 rounded-lg text-white/90">
          {isPdf ? (
            <FileText size={14} className="text-white/60" />
          ) : (
            <img
              src={attachedImage}
              alt="Attached"
              className="w-5 h-5 rounded object-cover cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            />
          )}
          <span>{isPdf ? "PDF Document" : "Image"}</span>
          <button 
            onClick={() => setAttachedImage(null)}
            className="ml-1 text-white/40 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </motion.div>
    );
  };

  const renderExtraButtons = () => {
    return (
      <>
        {setUseWebSearch && (
          <button
            type="button"
            onClick={() => setUseWebSearch(!useWebSearch)}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${useWebSearch ? 'text-primary bg-primary/10' : 'text-white/40 hover:text-white/90'}`}
            title={useWebSearch ? "Disable Web Search" : "Enable Web Search"}
          >
            <Globe className="w-4 h-4" />
          </button>
        )}
        
        {setUseReasoning && (
          <button
            type="button"
            onClick={() => setUseReasoning(!useReasoning)}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${useReasoning ? 'text-primary bg-primary/10' : 'text-white/40 hover:text-white/90'}`}
            title={useReasoning ? "Disable Thinking" : "Enable Thinking"}
          >
            <Lightbulb className="w-4 h-4" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="absolute bottom-0 left-0 w-full z-20 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-2 px-4 flex flex-col justify-end pointer-events-none">
      <div className="pointer-events-auto flex flex-col w-full max-w-3xl mx-auto">
        {topSlot}

      <input
        type="file"
        ref={fileRef}
        accept={fileAccept}
        className="hidden"
        onChange={handleFileChange}
      />

      <AnimatedAIChat 
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        isTyping={isSending}
        onStop={onStop}
        placeholder={placeholder}
        textareaRef={textareaRef as any}
        showHeading={false}
        attachments={renderAttachments()}
        onAttachClick={() => {
          if (imageDisabled) {
            handleImageClick();
          } else {
            openFilePicker("image/*,.pdf,application/pdf");
          }
        }}
        extraActionButtons={renderExtraButtons()}
        commands={[
          {
            icon: chatMode === "study" ? <MessageSquare className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />,
            label: chatMode === "study" ? "Switch to Casual Chat" : "Switch to Study Mode",
            description: `Currently in ${chatMode} mode`,
            prefix: chatMode === "study" ? "/casual" : "/study",
            onSelect: () => {
              setChatMode(chatMode === "study" ? "casual" : "study");
              toast.success(`Switched to ${chatMode === "study" ? "Casual" : "Study"} Mode`);
            }
          },
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
        ]}
      />

      {/* Lightbox — portal-rendered outside compose box */}
      {lightboxOpen &&
        attachedImage &&
        !isPdf &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={attachedImage} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
              <button
                className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
                onClick={() => setLightboxOpen(false)}
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
