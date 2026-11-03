import { useEffect, useState, type ReactNode } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

type Props = {
  /** True while the reader is actively scrolling. */
  visible: boolean;
  /** True when the editor is already at the top (nothing to scroll up to). */
  atTop: boolean;
  /** True when the editor is already at the bottom (nothing to scroll down to). */
  atBottom: boolean;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  yOffset?: number;
};

const UNMOUNT_DELAY_MS = 200;

const ScrollButton = ({
  hidden,
  enabled,
  label,
  onClick,
  icon,
}: {
  hidden: boolean;
  enabled: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-hidden={hidden}
    tabIndex={hidden || !enabled ? -1 : 0}
    disabled={!enabled}
    onClick={onClick}
    className={[
      "flex h-9 w-9 items-center justify-center rounded-full",
      "border border-[var(--divider)] bg-[var(--panel-bg-strong)] text-[var(--text-strong)]",
      "shadow-lg transition-opacity duration-150 active:scale-95",
      // No backdrop-filter here. Blurring the scrolling editor behind a
      // floating control forces a recomposite of that region every frame,
      // which is the main source of scroll jank on Android WebView.
      hidden
        ? "invisible pointer-events-none"
        : "visible opacity-90 hover:opacity-100",
      // While the pill is fading out it must not swallow taps meant for the
      // text underneath.
      enabled ? "pointer-events-auto" : "pointer-events-none",
    ].join(" ")}
  >
    {icon}
  </button>
);

export const FloatingScrollButtons = ({
  visible,
  atTop,
  atBottom,
  onScrollTop,
  onScrollBottom,
  yOffset = 0,
}: Props) => {
  // Keep the buttons mounted just long enough to fade out, then remove them
  // from the DOM entirely so an idle editor has no floating layer at all.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), UNMOUNT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!visible}
      className={[
        "pointer-events-none absolute z-40 flex flex-col gap-2",
        // Mobile: sit in the left gutter. The bottom-right corner belongs to
        // the AI action stack (fixed, z-55), and the bottom edge to the editor
        // toolbar, so placing these there made them untappable.
        "bottom-20 left-2",
        // Desktop has no FAB stack, so keep the familiar bottom-right spot.
        "sm:bottom-24 sm:left-auto sm:right-6",
        "transition-opacity duration-150 ease-out",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={yOffset > 0 ? { transform: `translateY(-${yOffset}px)` } : undefined}
    >
      {/* Both slots are always reserved so the pill never changes position
          when one direction becomes unavailable. */}
      <ScrollButton
        hidden={atTop}
        enabled={visible && !atTop}
        label="Scroll to top"
        onClick={onScrollTop}
        icon={<ArrowUp size={18} />}
      />
      <ScrollButton
        hidden={atBottom}
        enabled={visible && !atBottom}
        label="Scroll to bottom"
        onClick={onScrollBottom}
        icon={<ArrowDown size={18} />}
      />
    </div>
  );
};
