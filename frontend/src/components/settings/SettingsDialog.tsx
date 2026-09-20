import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Type, Info, Keyboard, ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";

// Sub-components
import { AccountTab } from "./AccountTab";
import { EditorTab } from "./EditorTab";
import { AboutTab } from "./AboutTab";
import { ShortcutsTab } from "./ShortcutsTab";

type Tab = "account" | "editor" | "shortcuts" | "about";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User size={15} /> },
  { id: "editor", label: "Editor", icon: <Type size={15} /> },
  { id: "shortcuts", label: "Shortcuts", icon: <Keyboard size={15} /> },
  { id: "about", label: "About", icon: <Info size={15} /> },
];

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [mobileView, setMobileView] = useState<"menu" | "content">("menu");
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Reset to menu when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => setMobileView("menu"), 200);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 bg-[#0f0f11] border border-white/8 text-zinc-100 shadow-2xl overflow-hidden max-h-[90vh]",
          isMobile ? "w-[95vw] h-[90vh] max-w-none rounded-xl" : "sm:max-w-2xl"
        )}
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <div className="flex h-full w-full max-h-[90vh] sm:min-h-[520px]">
          {/* ── Sidebar nav (Menu View) ── */}
          {(!isMobile || mobileView === "menu") && (
            <aside className={cn(
              "shrink-0 bg-[#0c0c0e] flex flex-col gap-0.5",
              isMobile ? "w-full py-6 px-4" : "w-44 border-r border-white/8 py-4 px-2"
            )}>
              <div className={cn("flex items-center justify-between pb-4", isMobile ? "px-1" : "px-2")}>
                <DialogHeader>
                  <DialogTitle className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
                    Settings
                  </DialogTitle>
                </DialogHeader>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 -mr-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close settings"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className={cn("flex flex-col", isMobile ? "gap-1.5" : "gap-1")}>
                {TABS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    type="button"
                    id={`settings-tab-${id}`}
                    onClick={() => {
                      setActiveTab(id);
                      if (isMobile) setMobileView("content");
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-xl text-left font-medium transition-all duration-150",
                      isMobile ? "px-4 py-3.5 text-base bg-white/5 hover:bg-white/10" : "px-3 py-2.5 text-sm",
                      (!isMobile && activeTab === id)
                        ? "bg-indigo-500/12 text-indigo-300 border border-indigo-500/20"
                        : (!isMobile ? "text-zinc-400 hover:bg-white/5 hover:text-zinc-200" : "text-zinc-200")
                    )}
                  >
                    <span className={(!isMobile && activeTab === id) ? "text-indigo-400" : (isMobile ? "text-zinc-400" : "text-zinc-600")}>
                      {icon}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* ── Content area (Content View) ── */}
          {(!isMobile || mobileView === "content") && (
            <div className="flex-1 min-w-0 flex flex-col relative bg-[#0f0f11]">
              {isMobile ? (
                <div className="flex items-center justify-between px-4 py-3.5 shrink-0 border-b border-white/8 bg-[#0c0c0e]">
                  <button
                    type="button"
                    onClick={() => setMobileView("menu")}
                    className="p-1.5 -ml-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                    aria-label="Back to settings menu"
                  >
                    <ChevronLeft size={20} />
                    <span className="text-xs text-zinc-400 font-medium">Settings</span>
                  </button>
                  <span className="font-semibold text-zinc-100 text-sm">
                    {TABS.find((t) => t.id === activeTab)?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 -mr-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close settings"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between h-14 px-8 shrink-0 w-full border-b border-white/5">
                  <span className="text-base font-semibold text-zinc-200">
                    {TABS.find((t) => t.id === activeTab)?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 -mr-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close settings"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              
              <div className={cn(
                "flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent",
                isMobile ? "p-4 pb-8" : "px-8 pb-8"
              )}>
                {activeTab === "account" && <AccountTab />}
                {activeTab === "editor" && <EditorTab />}
                {activeTab === "shortcuts" && <ShortcutsTab />}
                {activeTab === "about" && <AboutTab />}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default SettingsDialog;
