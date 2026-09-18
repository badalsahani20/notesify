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

  const latestRelease = releases[0] || FALLBACK_RELEASES[0];
  const activeRelease = releases[activeReleaseIndex] || latestRelease;
  const platform = resolvePlatformState(selectedOS, latestRelease);

  // Auto-start download for ready platform (e.g. Windows)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (platform.isReady) {
      timer = setTimeout(() => {
        setDownloadStarted(true);
        window.location.href = platform.downloadUrl;
      }, 2000);
    } else {
      setDownloadStarted(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedOS, platform.isReady, platform.downloadUrl]);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-stone-200 selection:bg-indigo-500/30 font-sans relative overflow-x-hidden">
      <SEO 
        title={`Download Notesify for ${platform.name} — ${latestRelease.version}`}
        description={`Download Notesify desktop app for ${platform.name}. Official release ${latestRelease.version} featuring bounded agentic reasoning, on-demand contextual retrieval, and offline-first notes.`}
        path={`/download/${selectedOS}`}
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

      {/* Top Floating Navigation */}
      <header className="relative z-20 w-full px-6 pt-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10"
        >
          <ArrowLeft className="size-4" />
          <span>Back to home</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
            Notesify {latestRelease.version}
          </span>
          <a
            href={latestRelease.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full border border-white/10 transition-colors"
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
            {/* Morphing Iris Blob Animation */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto mb-8 group cursor-default">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 iris-hero-blob shadow-[0_0_70px_rgba(99,102,241,0.5)] transition-all duration-700 animate-spin-slow"></div>
              <div className="absolute inset-2 bg-[#050505] iris-hero-blob transition-all duration-700 scale-90"></div>
              <div className="absolute inset-4 bg-gradient-to-br from-indigo-400 to-purple-500 iris-hero-blob opacity-60 animate-pulse"></div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                {downloadStarted ? (
                  <CheckCircle2 className="size-10 sm:size-12 text-emerald-400 animate-in zoom-in duration-500" strokeWidth={1.75} />
                ) : (
                  <MonitorDown className="size-10 sm:size-12 text-white animate-pulse" strokeWidth={1.5} />
                )}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-indigo-300 text-xs font-semibold tracking-wider mb-4">
              <span>Latest Release • {latestRelease.version}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-4">
              {downloadStarted ? 'Thanks for downloading!' : `Download Notesify for ${platform.name}`}
            </h1>
            <p className="text-stone-400 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              {downloadStarted 
                ? `Your Notesify for ${platform.name} installer is downloading. Check your browser's download shelf to launch setup.`
                : platform.isReady 
                  ? `Your download will start automatically in a moment. You can also trigger the direct installer below.`
                  : `Desktop build for ${platform.name} is in active preview. You can launch the full web application immediately.`}
            </p>
          </FadeIn>

          {/* OS Switcher Pills */}
          <FadeIn delay={250}>
            <div className="inline-flex items-center p-1.5 rounded-xl bg-[#09090b]/90 border border-white/10 mb-8 backdrop-blur-xl shadow-lg relative">
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
                        ? 'text-white' 
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {isCurrent && (
                      <motion.div
                        layoutId="active-os-pill"
                        className="absolute inset-0 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/30"
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
                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold transition-colors ${
                          isCurrent ? 'bg-white/20 text-white' : 'bg-white/5 text-stone-400'
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
                  className="group relative inline-flex items-center justify-center rounded-2xl px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-bold bg-white text-black hover:bg-stone-200 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:-translate-y-0.5"
                >
                  <Download className="size-5 sm:size-6 mr-3 text-black group-hover:scale-110 transition-transform" />
                  <span>Download for {platform.name}</span>
                  <span className="ml-3 hidden sm:inline-flex text-xs px-2.5 py-1 rounded-full bg-black/10 font-semibold text-stone-700">
                    {platform.fileSize}
                  </span>
                </a>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <a 
                    href="https://app.notesify.in"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl px-8 py-4 text-base font-bold bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 text-white shadow-lg shadow-indigo-500/20"
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

              <div className="flex items-center gap-3 text-xs text-stone-400 mt-2">
                <span>{platform.architecture}</span>
                <span className="text-stone-600">•</span>
                <span>{platform.packageType}</span>
                <span className="text-stone-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="size-3" />
                  {platform.status}
                </span>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* Divider with Ambient Glow */}
        <div className="w-full max-w-5xl h-px bg-gradient-to-r from-transparent via-white/15 to-transparent my-10 relative">
          <div className="absolute inset-0 bg-indigo-500/20 blur-sm" />
        </div>

        {/* ========================================================= */}
        {/* TIER 2: WHAT'S NEW IN LATEST RELEASE (DYNAMIC METADATA)  */}
        {/* ========================================================= */}
        <section className="w-full max-w-5xl mb-20">
          <FadeIn delay={350}>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <span>Release Showcase • GitHub Source of Truth</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  What's New in {latestRelease.version} —{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
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
                    className={`rounded-2xl p-6 border border-white/10 bg-[#09090b]/90 hover:bg-[#111116]/95 backdrop-blur-xl shadow-xl transition-all duration-300 relative overflow-hidden group hover:border-white/20 hover:-translate-y-0.5 ${
                      idx === 0 ? 'lg:col-span-2 bg-gradient-to-br from-indigo-950/40 via-[#09090b]/95 to-[#09090b]/90 border-indigo-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <IconComponent className="size-5" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-stone-300 border border-white/5">
                        {item.tag}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
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
              <div className="rounded-2xl p-6 border border-white/10 bg-[#09090b]/90 backdrop-blur-xl shadow-xl mb-6 relative overflow-hidden">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Cpu className="size-4 text-indigo-400" />
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
            <div className="rounded-2xl border border-white/10 bg-[#09090b]/90 backdrop-blur-xl shadow-xl overflow-hidden">
              <button
                onClick={() => setShowFullChangelog((prev) => !prev)}
                className="w-full px-6 py-4 flex items-center justify-between text-xs font-bold text-stone-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-indigo-400" />
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
                <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <History className="size-4 text-purple-400" />
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
                        ? 'border-indigo-500/60 shadow-xl shadow-indigo-500/15 backdrop-blur-xl' 
                        : 'border-white/10 bg-[#09090b]/90 hover:bg-[#111116]/95 hover:border-white/20 backdrop-blur-xl shadow-lg'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-release-card"
                        className="absolute inset-0 bg-indigo-950/40 border border-indigo-500/60 rounded-2xl pointer-events-none"
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
              <div className="lg:col-span-7 bg-[#09090b]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-28 bg-indigo-500/10 blur-[90px] rounded-full pointer-events-none" />
                
                <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                  How to install on {platform.name}
                </h3>
                <p className="text-sm text-stone-400 mb-6">
                  Follow these quick steps to get Notesify running on your machine.
                </p>
                
                <div className="space-y-6">
                  {platform.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex-shrink-0 size-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
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

              {/* Right Column: Platform-Specific Package Specs (Not Generic Global Specs) */}
              <div className="lg:col-span-5 bg-[#09090b]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                    <ShieldCheck className="size-5 text-emerald-400 mr-2" />
                    {platform.name} Package Specs
                  </h3>
                  <p className="text-xs text-stone-400 mb-6">
                    Verified package metadata and packaging configuration.
                  </p>

                  <dl className="space-y-3.5 text-xs">
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400">Release Version</dt>
                      <dd className="font-semibold text-white">{latestRelease.version} (Stable)</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400">Package Format</dt>
                      <dd className="font-semibold text-white">{platform.packageType}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400">Target Architecture</dt>
                      <dd className="font-semibold text-white">{platform.architecture}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400">Display Scaling</dt>
                      <dd className="font-semibold text-emerald-400">{platform.dpiAware}</dd>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/5">
                      <dt className="text-stone-400">Download Size</dt>
                      <dd className="font-semibold text-white">{platform.fileSize}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-stone-400">Binary Artifact</dt>
                      <dd className="font-mono text-[11px] text-indigo-300 truncate max-w-[170px]" title={platform.binaryName}>
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
                    className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
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
