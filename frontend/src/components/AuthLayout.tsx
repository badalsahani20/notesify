import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-black p-4 text-zinc-100 sm:p-6">
      {/* Subtle top ambient spotlight (Linear / Vercel modern-minimal aesthetic) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 -top-36 -translate-x-1/2 h-[440px] w-[680px] max-w-full rounded-full bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.025)_0%,transparent_65%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[340px] sm:max-w-[360px]">
        <Outlet />
      </div>
    </div>
  );
}

