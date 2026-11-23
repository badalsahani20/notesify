import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/auth";
import { toast } from "sonner";
import AuthLogo from "@/components/AuthLogo";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (!token) return;
      await resetPassword(token, password);
      toast.success("Password reset successful. Please log in.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Invalid or expired reset token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <AuthLogo />
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Create new password
        </h1>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-[280px]">
          Choose a secure password of at least 6 characters.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="space-y-1.5 text-left">
          <label htmlFor="new-password" className="block text-xs font-medium text-zinc-300">
            New password
          </label>
          <div className="relative">
            <Input
              id="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={6}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-black pl-3.5 pr-10 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-1.5 text-left">
          <label htmlFor="confirm-password" className="block text-xs font-medium text-zinc-300">
            Confirm new password
          </label>
          <div className="relative">
            <Input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-black pl-3.5 pr-10 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-red-400 pt-0.5">Passwords do not match</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || password.length < 6 || !confirmPassword || password !== confirmPassword}
          className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer shadow-sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={15} className="animate-spin text-zinc-800" />
              <span>Updating password…</span>
            </span>
          ) : (
            "Update Password"
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
