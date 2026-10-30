import { ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  showScrollTop: boolean;
  showScrollBottom: boolean;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  yOffset?: number;
};

export const FloatingScrollButtons = ({
  showScrollTop,
  showScrollBottom,
  onScrollTop,
  onScrollBottom,
  yOffset = 0,
}: Props) => {
  return (
    <div
      className="absolute bottom-24 right-8 flex flex-col gap-3 z-40 pointer-events-none transition-transform duration-150"
      style={yOffset ? { transform: `translateY(-${yOffset}px)` } : undefined}
    >
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onScrollTop}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-[var(--panel-bg-strong)] border border-[var(--divider)] text-[var(--text-strong)] hover:bg-[var(--surface-muted)] shadow-xl backdrop-blur-md transition-colors"
            title="Scroll to top"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onScrollBottom}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-[var(--panel-bg-strong)] border border-[var(--divider)] text-[var(--text-strong)] hover:bg-[var(--surface-muted)] shadow-xl backdrop-blur-md transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
