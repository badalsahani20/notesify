import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, ArrowLeft, CheckCircle2, MonitorDown, Sparkles } from 'lucide-react';
import { SEO } from '../components/landing/SEO';
import { FadeIn } from '../components/ui/FadeIn';
import { DotField } from '../components/ui/DotField';

export const DownloadPage = () => {
  const { os } = useParams();
  const [downloadStarted, setDownloadStarted] = useState(false);

  // Fallback to Windows if os is missing or unknown
  const targetOS = os?.toLowerCase() === 'mac' ? 'macOS' : os?.toLowerCase() === 'linux' ? 'Linux' : 'Windows';
  
  // Note: Replace this with your actual GitHub releases URL once deployed
  const downloadUrl = 'https://github.com/badalsahani20/notesify/releases/latest/download/Notesify-Setup.exe';

  useEffect(() => {
    // Auto-start download after a brief 2 second delay for the animation
    const timer = setTimeout(() => {
      setDownloadStarted(true);
      if (targetOS === 'Windows') {
        window.location.href = downloadUrl;
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [targetOS]);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-stone-200 selection:bg-indigo-500/30 font-sans relative overflow-hidden">
      <SEO 
        title={`Download Notesify for ${targetOS}`}
        description={`Download the official Notesify desktop app for ${targetOS}. Experience the ultimate AI study workspace natively on your computer.`}
        path={`/download/${os}`}
      />
      
      {/* Interactive Dot Grid Background */}
      <DotField
        dotRadius={1.5}
        
    dotSpacing={14}
    bulgeStrength={67}
    glowRadius={160}
    sparkle={true}
    waveAmplitude={0}
    cursorRadius={500}
    cursorForce={0.1}
    bulgeOnly
    gradientFrom="#A855F7"
    gradientTo="#B497CF"
    glowColor="#120F17"
      />

      <main className="flex-1 flex flex-col items-center justify-center pt-32 pb-24 px-6 relative z-10">
        <div className="max-w-2xl w-full text-center">
          
          <FadeIn delay={100}>
            {/* Morphing Iris Animation */}
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-10 group cursor-default">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 iris-hero-blob shadow-[0_0_60px_rgba(99,102,241,0.6)] transition-all duration-700 animate-spin-slow"></div>
              <div className="absolute inset-2 bg-[#050505] iris-hero-blob transition-all duration-700 scale-90"></div>
              <div className="absolute inset-4 bg-gradient-to-br from-indigo-400 to-purple-500 iris-hero-blob opacity-60 animate-pulse"></div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                {downloadStarted ? (
                  <CheckCircle2 className="size-10 sm:size-12 text-white animate-in zoom-in duration-500" strokeWidth={1.5} />
                ) : (
                  <MonitorDown className="size-10 sm:size-12 text-white animate-pulse" strokeWidth={1.5} />
                )}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6">
              {downloadStarted ? 'Thanks for downloading!' : `Preparing your download...`}
            </h1>
            <p className="text-stone-400 text-lg max-w-lg mx-auto mb-12">
              {downloadStarted 
                ? `Your Notesify for ${targetOS} installer is now downloading. Please check your browser's download manager.`
                : `We're getting the latest version of Notesify ready for your ${targetOS} machine.`}
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            {/* Manual Download Fallback */}
            <div className="flex flex-col items-center gap-4 mb-16">
              <a 
                href={downloadUrl}
                className="group inline-flex items-center justify-center rounded-2xl px-8 py-4 text-base font-bold bg-white/5 hover:bg-white/10 transition-all duration-300 text-white border border-white/10 hover:border-white/20"
              >
                <Download className="size-5 mr-2" />
                Download manually
              </a>
              <Link to="/" className="text-sm text-stone-500 hover:text-stone-300 transition-colors flex items-center">
                <ArrowLeft className="size-4 mr-1" />
                Back to home
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={500}>
            {/* Installation Steps */}
            <div className="text-left bg-white/5 border border-white/10 rounded-2xl p-8 max-w-xl mx-auto shadow-2xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Sparkles className="size-5 text-indigo-400 mr-2" />
                How to install
              </h2>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 size-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-500/30">1</div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Open the installer</h3>
                    <p className="text-sm text-stone-400">Locate the downloaded `.exe` file in your browser's downloads folder and click to open it.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 size-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-500/30">2</div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Follow the setup</h3>
                    <p className="text-sm text-stone-400">Windows might ask for permission. Click "Run anyway" and follow the simple setup wizard.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 size-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-500/30">3</div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Start studying</h3>
                    <p className="text-sm text-stone-400">Sign in to your account and experience the fastest way to write notes and generate flashcards.</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
          
        </div>
      </main>
    </div>
  );
};
