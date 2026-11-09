import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  List,
  Mail,
} from "lucide-react";
import { Header } from "../landing/Header";
import { Footer } from "../landing/Footer";
import { SEO } from "../landing/SEO";
import {
  estimateReadTime,
  type LegalDocument,
  type LegalSection,
} from "../../lib/legal";

export interface LegalHighlight {
  label: string;
  description: string;
  href: string;
}

export interface LegalContact {
  label: string;
  heading: string;
  description: string;
  email: string;
}

export interface LegalRelated {
  label: string;
  to: string;
  description: string;
}

interface LegalPageLayoutProps {
  seo: {
    title: string;
    description: string;
    keywords?: string;
    path: string;
  };
  document: LegalDocument;
  activeDocument: "privacy" | "terms";
  eyebrow: string;
  headline: string;
  summary: string;
  highlights?: LegalHighlight[];
  contact: LegalContact;
  related: LegalRelated;
  footerNote: string;
}

const proseClasses = [
  "prose prose-invert max-w-none",
  "prose-p:text-[15px] prose-p:leading-7 prose-p:text-stone-400",
  "prose-li:text-[15px] prose-li:leading-7 prose-li:text-stone-400 prose-li:marker:text-indigo-400/60",
  "prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5",
  "prose-strong:font-semibold prose-strong:text-stone-100",
  "prose-headings:text-white prose-headings:tracking-tight",
  "prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-base prose-h3:font-semibold",
  "prose-h4:mt-6 prose-h4:mb-2 prose-h4:text-[15px] prose-h4:font-semibold",
  "prose-a:font-medium prose-a:text-indigo-400 prose-a:no-underline prose-a:decoration-indigo-400/40 prose-a:underline-offset-4 hover:prose-a:text-indigo-300 hover:prose-a:underline",
  "prose-blockquote:border-indigo-500/40 prose-blockquote:bg-white/[0.02] prose-blockquote:py-1 prose-blockquote:pr-4 prose-blockquote:text-stone-300 prose-blockquote:not-italic",
  "prose-code:rounded prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-normal prose-code:text-indigo-300",
  "prose-hr:border-white/10",
].join(" ");

const markdownComponents: Components = {
  a: ({ href, children, title }) => {
    const opensInNewTab = href?.startsWith("http");

    return (
      <a
        href={href}
        title={title}
        target={opensInNewTab ? "_blank" : undefined}
        rel={opensInNewTab ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="not-prose my-6 border-l-2 border-indigo-500/50 bg-indigo-500/[0.04] px-5 py-4 text-[15px] leading-7 text-stone-300 [&_p]:m-0 [&_p+p]:mt-3 [&_strong]:font-semibold [&_strong]:text-white">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.03]">{children}</thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-white/5 last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 align-top text-sm leading-6 text-stone-400">
      {children}
    </td>
  ),
};

const ReadingProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;

      setProgress(
        scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0,
      );
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent"
    >
      <div
        className="h-full bg-indigo-500/80 transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
};

interface SectionNavProps {
  sections: LegalSection[];
  activeId: string;
  onNavigate?: () => void;
}

const SectionNav = ({ sections, activeId, onNavigate }: SectionNavProps) => (
  <nav aria-label="Document sections" className="border-l border-white/10">
    {sections.map((section) => {
      const isActive = section.id === activeId;

      return (
        <a
          key={section.id}
          href={`#${section.id}`}
          onClick={onNavigate}
          aria-current={isActive ? "location" : undefined}
          className={`-ml-px flex items-start gap-3 border-l-2 py-2 pl-4 pr-2 text-[13px] leading-snug transition-colors ${
            isActive
              ? "border-indigo-400 text-white"
              : "border-transparent text-stone-400 hover:border-white/20 hover:text-stone-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pt-px font-mono text-[10px] tabular-nums ${
              isActive ? "text-indigo-400" : "text-stone-500"
            }`}
          >
            {section.number}
          </span>
          <span>{section.title}</span>
        </a>
      );
    })}
  </nav>
);

export const LegalPageLayout = ({
  seo,
  document,
  activeDocument,
  eyebrow,
  headline,
  summary,
  highlights,
  contact,
  related,
  footerNote,
}: LegalPageLayoutProps) => {
  const [activeId, setActiveId] = useState(
    document.sections[0]?.id ?? "",
  );
  const mobileTocRef = useRef<HTMLDetailsElement>(null);
  const readTime = estimateReadTime(document);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const offset = 140;
      let current = document.sections[0]?.id ?? "";

      for (const section of document.sections) {
        const element = window.document.getElementById(section.id);
        if (!element) continue;

        if (element.getBoundingClientRect().top <= offset) {
          current = section.id;
        } else {
          break;
        }
      }

      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [document.sections]);

  const closeMobileToc = () => {
    if (mobileTocRef.current) mobileTocRef.current.open = false;
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#050505] font-sans text-stone-200 selection:bg-indigo-500/30">
      <SEO {...seo} />
      <ReadingProgress />
      <Header />

      <main className="relative z-10 pt-24">
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-5xl px-6 pb-12 pt-8 sm:pb-16 sm:pt-10">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500"
            >
              <Link to="/" className="transition-colors hover:text-stone-300">
                Notesify
              </Link>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span>Legal</span>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span className="text-stone-300">
                {activeDocument === "privacy"
                  ? "Privacy Policy"
                  : "Terms of Service"}
              </span>
            </nav>

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end">
              <div className="max-w-2xl">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-400">
                  {eyebrow}
                </p>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
                  {headline}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-stone-400 sm:text-lg">
                  {summary}
                </p>
              </div>

              <div className="lg:border-l lg:border-white/10 lg:pl-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400">
                  Last updated
                </p>
                <p className="mt-2 text-sm font-medium text-stone-200">
                  {document.lastUpdated}
                </p>
                <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                  <span>{document.sections.length} sections</span>
                  <span
                    aria-hidden="true"
                    className="size-1 rounded-full bg-stone-700"
                  />
                  <span>{readTime}</span>
                </p>

                <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.02] p-1 text-xs font-medium">
                  <Link
                    to="/privacy"
                    aria-current={
                      activeDocument === "privacy" ? "page" : undefined
                    }
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      activeDocument === "privacy"
                        ? "bg-white text-black"
                        : "text-stone-400 hover:text-white"
                    }`}
                  >
                    Privacy
                  </Link>
                  <Link
                    to="/terms"
                    aria-current={
                      activeDocument === "terms" ? "page" : undefined
                    }
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      activeDocument === "terms"
                        ? "bg-white text-black"
                        : "text-stone-400 hover:text-white"
                    }`}
                  >
                    Terms
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
          <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16">
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 pr-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400">
                  On this page
                </p>
                <div className="mt-4">
                  <SectionNav
                    sections={document.sections}
                    activeId={activeId}
                  />
                </div>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400">
                    Related
                  </p>
                  <Link
                    to={related.to}
                    className="group mt-3 flex items-start justify-between gap-3 text-sm font-medium text-stone-300 transition-colors hover:text-white"
                  >
                    <span>{related.label}</span>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-stone-600 transition-colors group-hover:text-indigo-400" />
                  </Link>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {related.description}
                  </p>
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <Mail className="size-4 text-indigo-400" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-stone-200">
                    {contact.label}
                  </p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-1 block break-all text-xs text-stone-400 transition-colors hover:text-indigo-300"
                  >
                    {contact.email}
                  </a>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <details
                ref={mobileTocRef}
                className="group mb-10 rounded-xl border border-white/10 bg-white/[0.02] lg:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-stone-200 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <List
                      className="size-4 text-indigo-400"
                      aria-hidden="true"
                    />
                    Jump to a section
                  </span>
                  <ChevronDown
                    className="size-4 text-stone-500 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-white/10 px-4 py-3">
                  <SectionNav
                    sections={document.sections}
                    activeId={activeId}
                    onNavigate={closeMobileToc}
                  />
                </div>
              </details>

              <article>
                {document.intro && (
                  <div
                    className={`${proseClasses} [&>p:first-child]:text-base sm:[&>p:first-child]:text-lg [&>p:first-child]:leading-8 [&>p:first-child]:text-stone-300`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {document.intro}
                    </ReactMarkdown>
                  </div>
                )}

                {highlights && highlights.length > 0 && (
                  <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
                    {highlights.map((highlight) => (
                      <a
                        key={highlight.href}
                        href={highlight.href}
                        className="group flex flex-col justify-between gap-5 bg-[#070708] p-5 transition-colors hover:bg-[#0b0b0d]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm font-semibold text-stone-100">
                            {highlight.label}
                          </p>
                          <ArrowUpRight
                            className="mt-0.5 size-4 shrink-0 text-stone-600 transition-colors group-hover:text-indigo-400"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="text-[13px] leading-6 text-stone-400">
                          {highlight.description}
                        </p>
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-12 space-y-12 border-t border-white/10 pt-12 sm:mt-16 sm:space-y-16 sm:pt-14">
                  {document.sections.map((section) => (
                    <section
                      key={section.id}
                      id={section.id}
                      className="scroll-mt-28"
                    >
                      <header className="flex items-baseline gap-4">
                        <span
                          aria-hidden="true"
                          className="font-mono text-[11px] tracking-wider text-indigo-400/80"
                        >
                          {section.number}
                        </span>
                        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
                          {section.title}
                        </h2>
                      </header>
                      <div className={`${proseClasses} mt-6`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {section.body}
                        </ReactMarkdown>
                      </div>
                    </section>
                  ))}
                </div>

                <section className="mt-16 border-t border-white/10 pt-10 sm:mt-20 sm:pt-12">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
                    <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-md">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-indigo-400">
                          {contact.label}
                        </p>
                        <h2 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                          {contact.heading}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-stone-400">
                          {contact.description}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 sm:w-[240px] sm:shrink-0">
                        <a
                          href={`mailto:${contact.email}`}
                          className="group inline-flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-stone-200"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Mail
                              className="size-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="truncate">{contact.email}</span>
                          </span>
                          <ArrowUpRight
                            className="size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </a>

                        <Link
                          to={related.to}
                          className="group inline-flex items-center justify-between gap-4 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-stone-300 transition-colors hover:border-white/20 hover:text-white"
                        >
                          <span>{related.label}</span>
                          <ArrowRight
                            className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 max-w-2xl text-xs leading-5 text-stone-500">
                    {footerNote}
                  </p>
                </section>
              </article>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
