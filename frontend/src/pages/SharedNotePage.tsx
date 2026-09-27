import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import TipTap from "@/components/editor/TipTap";
import {
  Sparkles,
  Globe,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";

const fetchSharedNote = async (slug: string) => {
  const res = await api.get(`/public/notes/${slug}`);
  return res.data;
};

// ── Loading State ──────────────────────────────────────────────
const LoadingState = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#171717]">
    <div className="relative">
      <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/20 animate-pulse" />
      <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
        <img
          src="/notesify-favicon.png"
          alt="Notesify"
          className="w-full h-full object-cover scale-[1.15]"
        />
      </div>
    </div>
    <div className="mt-6 flex items-center gap-2 text-white/40 text-sm">
      <Loader2 size={14} className="animate-spin" />
      <span>Loading shared note…</span>
    </div>
  </div>
);

// ── Error State ────────────────────────────────────────────────
const ErrorState = ({ status }: { status?: number }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#171717] px-6">
    {/* Ambient glow */}
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-500/5 blur-[120px]" />
    </div>

    <div className="relative z-10 flex flex-col items-center text-center max-w-md">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        {status === 410 ? (
          <Clock size={28} className="text-red-400" />
        ) : (
          <AlertCircle size={28} className="text-red-400" />
        )}
      </div>
      <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">
        {status === 429 ? "Too Many Requests" : status === 410 ? "Link Expired" : "Note Not Found"}
      </h1>
      <p className="text-white/40 text-sm leading-relaxed mb-8">
        {status === 429
          ? "You've viewed this shared note too many times recently. Please wait a few minutes before trying again."
          : status === 410
          ? "This share link has expired and is no longer accessible. Ask the owner to generate a new one."
          : "This link may be broken or the owner may have disabled public sharing for this note."}
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/25"
      >
        Go to Notesify <ArrowRight size={14} />
      </Link>
    </div>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────
const SharedNotePage = () => {
  const { slug } = useParams<{ slug: string }>();

  const {
    data: note,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shared-note", slug],
    queryFn: () => fetchSharedNote(slug!),
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) return <LoadingState />;
  if (error)
    return <ErrorState status={(error as any)?.response?.status} />;

  return (
    <div className="dark min-h-screen bg-[#171717] text-white flex flex-col">
      {/* ── Ambient Background Glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-[130px]" />
        <div className="absolute top-2/3 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-600/6 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-600/4 blur-[150px]" />
      </div>

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#171717]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto h-14 px-5 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-md" />
              <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-black border border-white/10">
                <img
                  src="/notesify-favicon.png"
                  alt="Notesify"
                  className="w-full h-full object-cover scale-[1.15]"
                />
              </div>
            </div>
            <span className="text-[0.9rem] font-bold tracking-[-0.04em] text-white/90">
              Notesify
            </span>
            <div className="hidden sm:flex items-center gap-1.5 ml-1 h-5 px-2 rounded-full bg-white/5 border border-white/8 text-[10px] font-bold uppercase tracking-widest text-white/35">
              <Globe size={9} />
              Public
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/signup"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/80 transition-colors duration-200"
          >
            Sign up free <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="relative z-10 flex-1 px-5 pt-14 pb-32">
        <article className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Meta row */}
          <div className="flex items-center gap-4 mb-6 text-[11px] font-semibold text-white/30 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <Calendar size={11} />
              Updated {new Date(note.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1.5">
              <Globe size={11} />
              Shared publicly
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-white mb-8">
            {note.title || "Untitled Note"}
          </h1>

          {/* Divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />

          {/* Read-only editor */}
          <div className="prose-invert">
            <TipTap content={note.content} editable={false} />
          </div>
        </article>
      </main>

      {/* ── Floating CTA Footer ── */}
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4 w-full flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2.5 pl-1.5 pr-1.5 py-1.5 rounded-2xl bg-[#111118]/95 backdrop-blur-2xl border border-white/8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {/* Logo mark */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-lg bg-indigo-500/20 blur-sm" />
            <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-black border border-white/10">
              <img
                src="/notesify-favicon.png"
                alt="Notesify"
                className="w-full h-full object-cover scale-[1.15]"
              />
            </div>
          </div>

          {/* Brand + tagline — single row */}
          <div className="flex items-center gap-1.5 pr-1">
            <span className="text-[13px] font-bold tracking-tight text-white/90">Notesify</span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="hidden xs:inline text-[11px] text-white/40 font-medium whitespace-nowrap">AI-powered notes</span>
          </div>

          {/* Action */}
          <Link
            to="/signup"
            className="flex items-center gap-1 h-7 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold whitespace-nowrap transition-all duration-200 hover:shadow-md hover:shadow-indigo-500/30"
          >
            <Sparkles size={10} />
            Try Free
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SharedNotePage;
