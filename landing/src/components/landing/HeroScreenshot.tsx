import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Maximize2 } from 'lucide-react';

interface HeroScreenshotProps {
  appScreenshot: string;
  onExpand: () => void;
}

export const HeroScreenshot = ({ appScreenshot, onExpand }: HeroScreenshotProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track the scroll progress of the container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    // Start animation when the top of the container hits the bottom of the viewport
    // End when the top of the container hits the center of the viewport
    offset: ["start end", "start center"]
  });

  // Map scroll progress to 3D rotation and scale
  const rotateX = useTransform(scrollYProgress, [0, 1], [15, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.3, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);

  return (
    <section className="relative pt-6 pb-24 z-20 perspective-1000" ref={containerRef}>
      <motion.div 
        style={{ 
          rotateX, 
          scale, 
          opacity, 
          y,
          transformPerspective: 1200 
        }}
        className="container mx-auto px-6 max-w-5xl origin-top"
      >
        <div className="relative group rounded-2xl border border-white/10 bg-white/[0.02] p-2 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-700 hover:border-white/20">
          {/* Typographic Frame Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#0a0a0a]/70">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-mono text-stone-300 font-medium">Iris Workspace Interface</span>
            </div>
            <div className="text-[10px] text-stone-500 font-mono tracking-wider">
              Offline-Ready · Synchronized
            </div>
          </div>

          {/* Image itself */}
          <div 
            className="relative aspect-[16/9] w-full overflow-hidden bg-[#0d0d0d] rounded-b-xl cursor-zoom-in group/img"
            onClick={onExpand}
          >
            <img 
              src={appScreenshot} 
              alt="Notesify Workspace and Iris AI Assistant Interface" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-[1.008]"
              loading="eager"
            />
            {/* Zoom overlay on Hover */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 border border-white/10 text-white text-xs font-semibold backdrop-blur-md transform translate-y-2 group-hover/img:translate-y-0 transition-all duration-300">
                <Maximize2 size={14} className="text-indigo-400" />
                <span>View Fullscreen</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
