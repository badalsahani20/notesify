import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { toast } from "sonner";
import notesifyLogo from "@/assets/notesify-favicon.svg";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await api.post("/users/forgot-password", { email: email.trim() });
      setSent(true);
      toast.success("Password reset link sent!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full flex flex-col items-center">
        {/* Header Icon */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <MailCheck size={20} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Check your inbox
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-[280px] leading-relaxed">
            We sent a password reset link to{" "}
            <span className="font-mono text-zinc-200 font-medium">{email}</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          <Button
            asChild
            className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
          >
            <Link to="/login">Back to Login</Link>
          </Button>

          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-black text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
          >
            Try a different email
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[11px] text-zinc-600">
          <a href="https://notesify.in/terms" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">
            Terms
          </a>
          <span>·</span>
          <a href="https://notesify.in/privacy" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">
            Privacy Policy
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="relative mb-3 flex items-center justify-center">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center justify-center">
            <img
              src={notesifyLogo}
              alt="Notesify"
              width={26}
              height={26}
              className="w-6.5 h-6.5 object-contain"
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Reset password
        </h1>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-[280px]">
          Enter your email address and we&apos;ll send you a link to reset your account.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="space-y-1.5 text-left">
          <label htmlFor="forgot-email" className="block text-xs font-medium text-zinc-300">
            Email address
          </label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-black px-3.5 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !email.trim()}
          className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer shadow-sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={15} className="animate-spin text-zinc-800" />
              <span>Sending link…</span>
            </span>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </form>

      {/* Back to Login */}
      <div className="mt-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to Login</span>
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-center gap-3 text-[11px] text-zinc-600">
        <a href="https://notesify.in/terms" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">
          Terms
        </a>
        <span>·</span>
        <a href="https://notesify.in/privacy" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">
          Privacy Policy
        </a>
      </div>
    </div>
  );
}
