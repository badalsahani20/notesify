import { useState } from 'react';
import { X } from 'lucide-react';
import { Header } from '../components/landing/Header';
import { Hero } from '../components/landing/Hero';
import { SocialProof } from '../components/landing/SocialProof';
import appScreenshot from '../assets/app-screenshot.png';
import { Manifesto } from '../components/landing/Manifesto';
import { Features } from '../components/landing/Features';
import { AIExperience } from '../components/landing/AIExperience';
import { StudyTools } from '../components/landing/StudyTools';
import { EditorCapabilities } from '../components/landing/EditorCapabilities';
import { IrisLiveDemo } from '../components/landing/IrisLiveDemo';
import { Roadmap } from '../components/landing/Roadmap';
import { CTA } from '../components/landing/CTA';
import { Feedback } from '../components/landing/Newsletter';
import { FAQ } from '../components/landing/FAQ';
import { Footer } from '../components/landing/Footer';
import { SEO } from '../components/landing/SEO';

import { HeroScreenshot } from '../components/landing/HeroScreenshot';
import { OfflineShowcase } from '../components/landing/OfflineShowcase';

export const LandingPage = () => {
  const [isScreenshotExpanded, setIsScreenshotExpanded] = useState(false);
  return (
    <div className="min-h-screen bg-[#050505] text-stone-200 selection:bg-indigo-500/30 font-sans overflow-x-hidden">
      <SEO 
        title="Notesify — Offline-Ready AI Notes & Study Workspace"
        description="Your notes, online or offline. Read, write, and organize locally with automatic cloud synchronization and Iris AI assistance."
        keywords="offline notes app, ai notes app, local first notes, study app, ai study assistant, notesify"
        path="/"
      />
      <Header />

      <main className="relative z-10">
        <Hero />
        <SocialProof />

        <HeroScreenshot 
          appScreenshot={appScreenshot} 
          onExpand={() => setIsScreenshotExpanded(true)} 
        />

        {/* --- Offline-First Star Showcase --- */}
        <OfflineShowcase />

        {/* --- Iris Preview Section --- */}

        <section className="relative py-24 bg-[#050505]/50 border-t border-white/5">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-12">
               <span className="inline-block text-xs font-medium tracking-widest text-indigo-500 uppercase mb-3">
                 Try it yourself
               </span>
               <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
                 Give Iris a thought
               </h2>
               <p className="text-stone-400">See how our custom routing engine handles different queries.</p>
            </div>
            <IrisLiveDemo />
          </div>
        </section>

        <Manifesto />
        <Features />
        <AIExperience />
        <StudyTools />
        <EditorCapabilities />

        <Roadmap />
        <FAQ />
        <CTA />
        <Feedback />

        {/* Fullscreen Product Screenshot Modal */}
        {isScreenshotExpanded && (
          <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-md p-4 md:p-10 transition-all duration-300 cursor-zoom-out"
            onClick={() => setIsScreenshotExpanded(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setIsScreenshotExpanded(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-all z-[110] cursor-pointer"
              aria-label="Close fullscreen view"
            >
              <X size={20} />
            </button>
            
            {/* Image Wrapper */}
            <div className="relative max-w-7xl max-h-[85vh] w-full flex items-center justify-center p-2">
              <img 
                src={appScreenshot} 
                alt="Notesify Workspace and Iris AI Assistant Interface Fullscreen" 
                className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain rounded-xl border border-white/10 shadow-2xl cursor-default"
                onClick={(e) => e.stopPropagation()} // Prevent closing ONLY when clicking the image itself
              />
            </div>
            
            {/* Caption */}
            <p className="mt-4 text-xs text-stone-400 font-medium tracking-wide">
              Notesify Workspace showing document editor (left) and Iris AI Assistant with rendered Mermaid diagram (right).
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
