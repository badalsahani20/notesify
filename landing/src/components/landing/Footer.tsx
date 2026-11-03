import { Mail } from 'lucide-react';
import { FaGithub, FaInstagram, FaLinkedin } from 'react-icons/fa6';

export const Footer = () => {
  return (
    <footer className="relative border-t border-white/10 py-12 mt-12 bg-[#020202] z-20">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <a href="#" className="flex items-center gap-2 group">
              <img src="/notesify-favicon.svg" alt="Notesify" width={32} height={32} className="group-hover:scale-110 transition-transform duration-300" />
              <span className="font-semibold tracking-tight text-lg text-white">Notesify</span>
            </a>
            <p className="mt-4 text-sm text-stone-400 max-w-sm">
              The high-performance workspace for focused writing and active learning.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://github.com/badalsahani20" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-indigo-500/50 transition-colors">
                <FaGithub className="h-4 w-4" />
              </a>
              <a href="https://in.linkedin.com/in/badalsahani20" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-indigo-500/50 transition-colors">
                <FaLinkedin className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/d4rth.anv" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-indigo-500/50 transition-colors">
                <FaInstagram className="h-4 w-4" />
              </a>
              <a href="mailto:badalsahani233@gmail.com" aria-label="Email" className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-indigo-500/50 transition-colors">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-white">Product</h4>
            <ul className="space-y-3 text-sm text-stone-400">
              <li>
                <a 
                  href="#features" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-indigo-400 transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a 
                  href="#ai" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-indigo-400 transition-colors"
                >
                  AI Experience
                </a>
              </li>
              <li>
                <a 
                  href="#roadmap" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('roadmap')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-indigo-400 transition-colors"
                >
                  Roadmap
                </a>
              </li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Performance</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-white">Tech Stack</h4>
            <ul className="space-y-3 text-sm text-stone-400 font-mono">
              <li>React 18</li>
              <li>Express.js</li>
              <li>Node.js</li>
              <li>MongoDB Atlas</li>
              <li>Upstash Redis</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
            <span>© {new Date().getFullYear()} Notesify. Crafted with care.</span>
            <div className="flex gap-4">
              <a href="/terms" className="hover:text-stone-300 transition-colors">Terms of Service</a>
              <a href="/privacy" className="hover:text-stone-300 transition-colors">Privacy Policy</a>
            </div>
          </div>
          <span>Designed for thinkers · Built for speed</span>
        </div>
      </div>
    </footer>
  );
};
