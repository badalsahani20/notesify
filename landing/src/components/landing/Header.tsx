import { ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FadeIn } from '../ui/FadeIn';

export const Header = () => {
  return (
    <header className="fixed top-0 z-50 flex w-full flex-col backdrop-blur-md bg-[#050505]/70 border-b border-white/5 transition-all duration-300">
      <div className="flex w-full justify-center px-6 py-3 sm:py-4">
        <div className="max-w-7xl flex w-full justify-between items-center">
          <FadeIn delay={100}>
            <Link to="/" className="group flex items-center outline-none gap-3">
              <div className="relative size-8 sm:size-9 flex items-center justify-center">
                {/* Subtle Glow Backdrop */}
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-700"></div>
                
                {/* Native Logo with Spring Scale */}
                <img 
                  src="/favicon.png" 
                  alt="Notesify" 
                  className="relative z-10 size-full object-contain transition-transform duration-500 ease-out group-hover:scale-125" 
                />
              </div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white transition-colors duration-300 group-hover:text-indigo-400">Notesify</span>
            </Link>
          </FadeIn>
          
          <FadeIn delay={200} className="flex items-center space-x-2 sm:space-x-5">
            <a href="#offline" className="group hidden md:inline-flex items-center justify-center outline-none transition duration-300 px-3 py-2 text-sm font-bold text-stone-400 hover:text-white">
              Offline Mode
            </a>

            <Link to="/download/windows" className="group hidden lg:inline-flex items-center justify-center outline-none transition duration-300 px-3 py-2 text-sm font-bold text-stone-400 hover:text-white">
              Windows App
            </Link>

            <Link to="/docs" className="group hidden sm:inline-flex items-center justify-center outline-none transition duration-300 px-4 py-2 text-sm font-bold text-stone-400 hover:text-white">
              <div className="relative size-5 mr-2">
                <FileText className="absolute inset-0 size-full transition duration-300 group-hover:-rotate-12 group-hover:text-indigo-400" />
              </div>
              Documentation
            </Link>
            
            <a href="https://app.notesify.in" className="group relative inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm sm:text-base font-bold bg-white/10 hover:bg-white/15 transition-all duration-300 overflow-hidden text-white hover:ring-2 hover:ring-indigo-500/50">
              <span className="relative z-10 flex items-center">
                <span className="transition-transform duration-300 group-hover:-translate-x-1">Open App</span>
                <div className="relative ml-2 size-4 overflow-hidden">
                  <ArrowRight className="absolute inset-0 size-full transition duration-300 group-hover:translate-x-full group-hover:opacity-0 group-hover:blur-sm" />
                  <ArrowRight className="absolute inset-0 size-full -translate-x-full opacity-0 blur-sm transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-hover:blur-none group-hover:delay-75" />
                </div>
              </span>
            </a>
          </FadeIn>
        </div>
      </div>
    </header>
  );
};
