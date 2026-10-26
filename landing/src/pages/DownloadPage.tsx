import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { 
  Download, 
  ArrowLeft, 
  CheckCircle2, 
  MonitorDown, 
  Sparkles, 
  Bot, 
  FileText, 
  Radio, 
  Cpu, 
  ExternalLink, 
  ShieldCheck, 
  History, 
  WifiOff, 
  Search, 
  Zap,
  Check,
  Laptop,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SEO } from '../components/landing/SEO';
import { FadeIn } from '../components/ui/FadeIn';
import { DotField } from '../components/ui/DotField';
import type { OSKey, NormalizedRelease } from '../types/releases';
import { FALLBACK_RELEASES } from '../lib/releaseNormalizer';
import { resolvePlatformState } from '../lib/platformManifest';
import { fetchReleases } from '../services/releasesService';

// Icon resolver based on category tag
function getHighlightIcon(tag: string) {
  const lower = tag.toLowerCase();
  if (lower.includes('agentic') || lower.includes('ai')) return Bot;
  if (lower.includes('context') || lower.includes('document')) return FileText;
  if (lower.includes('telemetry') || lower.includes('stream')) return Radio;
  if (lower.includes('architecture') || lower.includes('routing')) return Cpu;
  if (lower.includes('local') || lower.includes('offline')) return WifiOff;
  if (lower.includes('desktop') || lower.includes('ui')) return Laptop;
  if (lower.includes('security') || lower.includes('auth')) return ShieldCheck;
  if (lower.includes('web') || lower.includes('search')) return Search;
  if (lower.includes('navigation') || lower.includes('title')) return Zap;
  return Sparkles;
}

export const DownloadPage = () => {
  const { os } = useParams();
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [releases, setReleases] = useState<NormalizedRelease[]>(FALLBACK_RELEASES);
  const [activeReleaseIndex, setActiveReleaseIndex] = useState(0);
  const [showFullChangelog, setShowFullChangelog] = useState(false);

  // Determine initial OS from URL param
  const initialOS: OSKey = useMemo(() => {
    const lower = os?.toLowerCase();
    if (lower === 'mac') return 'mac';
    if (lower === 'linux') return 'linux';
    return 'windows';
  }, [os]);

  const [selectedOS, setSelectedOS] = useState<OSKey>(initialOS);

  // Fetch dynamic releases from landing API / GitHub API
  useEffect(() => {
    let isMounted = true;
    fetchReleases()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setReleases(data);
        }
      })
      .catch(() => {
        // Fallback already pre-seeded
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Detect mobile devices and touch screens to prevent unintended downloads
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
    return mobileRegex.test(ua) || (isTouch && window.innerWidth < 768);
  });

  useEffect(() => {
    const handleResize = () => {
      const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
      setIsMobile(mobileRegex.test(ua) || (isTouch && window.innerWidth < 768));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const latestRelease = releases[0] || FALLBACK_RELEASES[0];
  const activeRelease = releases[activeReleaseIndex] || latestRelease;
  const platform = resolvePlatformState(selectedOS, latestRelease);

  // Auto-start download ONLY for Windows on desktop browsers.
  // Mobile devices, Linux, and macOS never auto-trigger downloads.
  const shouldAutoDownload = selectedOS === 'windows' && platform.isReady && !isMobile;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (shouldAutoDownload) {
      timer = setTimeout(() => {
        setDownloadStarted(true);
        const link = document.createElement('a');
        link.href = platform.downloadUrl;
        link.setAttribute('download', platform.binaryName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 1500);
    } else {
      setDownloadStarted(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [shouldAutoDownload, platform.downloadUrl, platform.binaryName]);

  return (
    <div className="min-h-screen flex flex-col bg-[#08080a] text-stone-200 selection:bg-white/20 font-sans relative overflow-x-hidden">
      <SEO 
        title={`Download Notesify for ${platform.name} — ${latestRelease.version}`}
        description={`Download Notesify desktop app for ${platform.name}. Official release ${latestRelease.version} featuring bounded agentic reasoning, on-demand contextual retrieval, and offline-first notes.`}
        path={`/download/${selectedOS}`}
      />
      
      {/* Refined Architectural Grid Background */}
      <DotField
        dotRadius={1.2}
        dotSpacing={16}
        bulgeStrength={40}
        glowRadius={120}
        sparkle={false}
        waveAmplitude={0}
        cursorRadius={400}
        cursorForce={0.06}
        bulgeOnly
        gradientFrom="#52525b"
        gradientTo="#71717a"
        glowColor="#09090b"
      />

      {/* Top Floating Navigation */}
      <header className="relative z-20 w-full px-6 pt-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-medium text-stone-400 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to home</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-white/[0.04] text-stone-300 border border-white/10">
            Notesify {latestRelease.version}
          </span>
          <a
            href={latestRelease.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1 rounded-full border border-white/10 transition-colors font-medium"
          >
            GitHub Release
            <ExternalLink className="size-3" />
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center pt-10 pb-28 px-4 sm:px-6 relative z-10 w-full max-w-6xl mx-auto">
        
        {/* ========================================================= */}
        {/* TIER 1: DOMINANT DOWNLOAD CTA HERO (ABOVE THE FOLD)       */}
        {/* ========================================================= */}
        <section className="w-full max-w-3xl text-center mb-16 pt-4">
          <FadeIn delay={100}>
            {/* Tactile Architectural Emblem */}
            <div className="relative mx-auto mb-8 flex items-center justify-center">
              <div className="relative size-24 sm:size-28 rounded-3xl bg-neutral-900/90 border border-white/10 p-1 shadow-2xl backdrop-blur-xl flex items-center justify-center group">
                <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-white/15 to-transparent opacity-50 pointer-events-none" />
                <div className="size-full rounded-[22px] bg-gradient-to-b from-neutral-800/80 to-neutral-950 flex flex-col items-center justify-center gap-1.5 border border-white/5">
                  {downloadStarted ? (
                    <CheckCircle2 className="size-8 sm:size-9 text-emerald-400 transition-all duration-300" strokeWidth={1.75} />
                  ) : (
                    <MonitorDown className="size-8 sm:size-9 text-white transition-transform group-hover:scale-105" strokeWidth={1.5} />
                  )}
                  <span className="font-mono text-[10px] tracking-widest uppercase font-semibold text-stone-400">
                    {downloadStarted ? 'Started' : platform.name}
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-stone-300 font-mono text-[11px] font-semibold tracking-wider mb-4">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Release {latestRelease.version} • Verified</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-4">
              {downloadStarted ? 'Thanks for downloading!' : `Download Notesify for ${platform.name}`}
            </h1>
            <p className="text-stone-300 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-normal">
              {downloadStarted 
                ? `Your Notesify for ${platform.name} installer is downloading. Check your browser's download shelf to launch setup.`
                : shouldAutoDownload
                  ? `Your download will start automatically in a moment. You can also trigger the direct installer below.`
                  : isMobile
                    ? `Notesify desktop is optimized for Windows PC. Download from your computer or launch the full web app below.`
                    : platform.isReady
                      ? `Click below to download the official Notesify installer for ${platform.name}.`
                      : `Desktop build for ${platform.name} is in active preview. You can launch the full web application immediately.`}
            </p>
          </FadeIn>

          {/* OS Switcher Pills */}
          <FadeIn delay={250}>
            <div className="inline-flex items-center p-1.5 rounded-xl bg-neutral-900/90 border border-white/10 mb-8 backdrop-blur-xl shadow-lg relative">
              {(['windows', 'mac', 'linux'] as OSKey[]).map((osKey) => {
                const isCurrent = selectedOS === osKey;
                const osLabel = osKey === 'windows' ? 'Windows' : osKey === 'mac' ? 'macOS' : 'Linux';
                return (
                  <button
                    key={osKey}
                    onClick={() => {
                      setSelectedOS(osKey);
                      setDownloadStarted(false);
                    }}
                    className={`relative px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer ${
                      isCurrent 
                        ? 'text-black' 
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {isCurrent && (
                      <motion.div
                        layoutId="active-os-pill"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm"
                        transition={{ 
                          type: "spring", 
                          stiffness: 450, 
                          damping: 32 
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center">
                      {osLabel}
                      {osKey === 'windows' && (
                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                          isCurrent ? 'bg-neutral-200 text-neutral-900' : 'bg-white/5 text-stone-400'
                        }`}>
                          Exe
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </FadeIn>

          {/* Primary Dominant Download CTA */}
          <FadeIn delay={300}>
            <div className="flex flex-col items-center gap-3">
              {platform.isReady ? (
                <a 
                  href={platform.downloadUrl}
                  onClick={() => setDownloadStarted(true)}
                  className="group relative inline-flex items-center justify-center rounded-2xl px-8 sm:px-10 py-4 text-base sm:text-lg font-bold bg-white text-neutral-950 hover:bg-neutral-100 border border-white/20 transition-all duration-200 shadow-xl active:scale-[0.99] cursor-pointer"
                >
                  <Download className="size-5 sm:size-6 mr-3 text-neutral-950 group-hover:scale-110 transition-transform" />
                  <span>Download for {platform.name}</span>
                  <span className="ml-3 hidden sm:inline-flex text-xs px-2.5 py-1 rounded-full bg-neutral-200 font-mono font-semibold text-neutral-800">
                    {platform.fileSize}
                  </span>
                </a>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <a 
                    href="https://app.notesify.in"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl px-8 py-4 text-base font-bold bg-white text-black hover:bg-neutral-100 transition-all duration-200 shadow-lg"
                  >
                    <ExternalLink className="size-5 mr-2" />
                    Launch Notesify Web App
                  </a>
                  <a
                    href={latestRelease.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl px-6 py-4 text-base font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all"
                  >
                    View Release Assets
                  </a>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs font-mono text-stone-400 mt-2">
                <span>{platform.architecture}</span>
                <span className="text-stone-600">•</span>
                <span>{platform.packageType}</span>
                <span className="text-stone-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1 font-sans">
                  <Check className="size-3" />
                  {platform.status}
                </span>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* Clean Hairline Divider */}
        <div className="w-full max-w-5xl h-px bg-white/10 my-12" />

        {/* ========================================================= */}
        {/* TIER 2: WHAT'S NEW IN LATEST RELEASE (DYNAMIC METADATA)  */}
        {/* ========================================================= */}
        <section className="w-full max-w-5xl mb-20">
          <FadeIn delay={350}>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
                  <span>Release Notes • GitHub Verified</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  What's New in {latestRelease.version} —{' '}
                  <span className="text-stone-300 font-bold">
                    {latestRelease.name.replace(/^🚀\s*/, '').replace(new RegExp(`^Notesify\\s*${latestRelease.version}\\s*[—–-]?\\s*`, 'i'), '') || 'The Agentic Leap'}
                  </span>
                </h2>
                <p className="text-stone-400 text-sm sm:text-base mt-1 max-w-2xl">
                  Published {latestRelease.publishedDateFormatted} on GitHub. Automatic release parsing with zero landing page redeployments.
                </p>
              </div>

              <a
                href={latestRelease.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-colors self-start md:self-auto"
              >
                <span>Full GitHub Release</span>
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {/* Feature Spotlight Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {latestRelease.highlights.map((item, idx) => {
                const IconComponent = getHighlightIcon(item.tag);
                return (
                  <div 
                    key={idx}
                    className={`rounded-2xl p-6 border border-white/10 bg-neutral-900/80 hover:bg-neutral-900/95 backdrop-blur-xl shadow-xl transition-all duration-200 relative overflow-hidden group hover:border-white/20 hover:-translate-y-0.5 ${
                      idx === 0 ? 'lg:col-span-2 border-white/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="size-10 rounded-xl bg-white/5 text-white border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <IconComponent className="size-5" />
                      </div>
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-stone-300 border border-white/10">
                        {item.tag}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-stone-100 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-stone-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Technical Highlights / Guarantees */}
            {latestRelease.technicalNotes.length > 0 && (
              <div className="rounded-2xl p-6 border border-white/10 bg-neutral-900/80 backdrop-blur-xl shadow-xl mb-6 relative overflow-hidden">
                <h4 className="text-xs font-mono font-semibold text-stone-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Cpu className="size-4 text-stone-400" />
                  <span>Architecture & Reliability Highlights</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-stone-300">
                  {latestRelease.technicalNotes.map((note, index) => (
                    <div key={index} className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable Complete Release Notes Markdown */}
            <div className="rounded-2xl border border-white/10 bg-neutral-900/80 backdrop-blur-xl shadow-xl overflow-hidden">
              <button
                onClick={() => setShowFullChangelog((prev) => !prev)}
                className="w-full px-6 py-4 flex items-center justify-between text-xs font-bold text-stone-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-stone-400" />
                  <span>{showFullChangelog ? 'Hide complete release notes' : 'Read complete release changelog (Markdown)'}</span>
                </span>
                {showFullChangelog ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {showFullChangelog && (
                <div className="p-6 border-t border-white/10 bg-black/40 text-sm text-stone-300 prose prose-invert max-w-none prose-p:text-stone-400 prose-headings:text-white prose-li:text-stone-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {latestRelease.body}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </FadeIn>
        </section>

        {/* ========================================================= */}
        {/* TIER 3: RELEASE TIMELINE & HISTORY                        */}
        {/* ========================================================= */}
        <section className="w-full max-w-5xl mb-20">
          <FadeIn delay={400}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-stone-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
                  <History className="size-4 text-stone-400" />
                  <span>Release Timeline</span>
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Track the Evolution of Notesify
                </h3>
              </div>
            </div>

            {/* Timeline Version Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {releases.map((rel, index) => {
                const isActive = activeReleaseIndex === index;
                const isLatest = index === 0;
                return (
                  <button
                    key={rel.id || rel.version}
                    onClick={() => setActiveReleaseIndex(index)}
                    className={`text-left p-5 rounded-2xl border transition-all duration-200 relative cursor-pointer overflow-hidden ${
                      isActive 
                        ? 'border-white/30 bg-neutral-900 shadow-xl' 
                        : 'border-white/10 bg-neutral-900/60 hover:bg-neutral-900/80 hover:border-white/20 backdrop-blur-xl shadow-lg'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-release-card"
                        className="absolute inset-0 bg-neutral-800/60 border border-white/20 rounded-2xl pointer-events-none"
                        transition={{ 
                          type: "spring", 
                          stiffness: 380, 
                          damping: 28 
                        }}
                      />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-extrabold text-white">
                          {rel.version}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isLatest 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-white/5 text-stone-400 border-white/10'
                        }`}>
                          {isLatest ? 'Latest Release' : 'Past Release'}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-stone-200 mb-2 line-clamp-1">
                        {rel.name.replace(/^🚀\s*/, '')}
                      </p>

                      <div className="text-xs text-stone-400 flex items-center justify-between pt-2 border-t border-white/5">
                        <span>{rel.highlights.length} highlights</span>
                        <span className="text-stone-500">{rel.publishedDateFormatted}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Release Details Panel */}
            <div className="p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#09090b]/90 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-white">{activeRelease.version}</span>
                    <span className="text-stone-500">•</span>
                    <span className="text-stone-300 font-medium">{activeRelease.name.replace(/^🚀\s*/, '')}</span>
                  </div>
                  <p className="text-sm text-stone-400">Published on {activeRelease.publishedDateFormatted}</p>
                </div>

                <a
                  href={activeRelease.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl border border-white/10 transition-colors self-start sm:self-auto"
                >
                  <span>View GitHub Release</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeRelease.highlights.map((h, i) => {
                  const Icon = getHighlightIcon(h.tag);
                  return (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-[#131318]/90 border border-white/5">
                      <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="text-sm font-semibold text-white">{h.title}</h5>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-stone-400">
                            {h.tag}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed">{h.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ========================================================= */}
        {/* TIER 4: PLATFORM SPECIFICATIONS & HOW TO INSTALL          */}
        {/* ========================================================= */}
        <section className="w-full max-w-5xl">
          <FadeIn delay={450}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: How to Install (Tailored for Selected Platform) */}
              <div className="lg:col-span-7 bg-neutral-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                  How to install on {platform.name}
                </h3>
                <p className="text-sm text-stone-400 mb-6">
                  Follow these quick steps to get Notesify running on your machine.
                </p>
                
                <div className="space-y-6">
                  {platform.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex-shrink-0 size-7 rounded-full bg-white/10 text-white flex items-center justify-center font-mono font-bold text-xs border border-white/15">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">{step.title}</h4>
                        <p className="text-sm text-stone-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Platform-Specific Package Specs */}
              <div className="lg:col-span-5 bg-neutral-900/80 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                    <ShieldCheck className="size-5 text-emerald-400 mr-2" />
                    {platform.name} Package Specs
                  </h3>
                  <p className="text-xs text-stone-400 mb-6">
                    Verified package metadata and packaging configuration.
                  </p>

                  <dl className="space-y-3.5 text-xs font-mono">
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400 font-sans">Release Version</dt>
                      <dd className="font-semibold text-white">{latestRelease.version} (Stable)</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400 font-sans">Package Format</dt>
                      <dd className="font-semibold text-white">{platform.packageType}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400 font-sans">Target Architecture</dt>
                      <dd className="font-semibold text-white">{platform.architecture}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400 font-sans">Display Scaling</dt>
                      <dd className="font-semibold text-emerald-400">{platform.dpiAware}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400 font-sans">Download Size</dt>
                      <dd className="font-semibold text-white">{platform.fileSize}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-stone-400 font-sans">Binary Artifact</dt>
                      <dd className="text-[11px] text-stone-300 truncate max-w-[170px]" title={platform.binaryName}>
                        {platform.binaryName}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-stone-400">
                  <span>Need an older version?</span>
                  <a 
                    href="https://github.com/badalsahani20/notesify/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-300 hover:text-white font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    All releases
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

            </div>
          </FadeIn>
        </section>

      </main>
    </div>
  );
};
