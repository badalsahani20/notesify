import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import Google from "@/assets/google.svg";
import notesifyLogo from "@/assets/notesify-favicon.svg";
import { toast } from "sonner";
import { generatePkceChallenge } from "@/utils/pkce";
import { Capacitor } from "@capacitor/core";

const SignupForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const isDesktop = typeof window !== "undefined" && Boolean((window as any).electronAPI?.auth);
  const isNative = Capacitor.isNativePlatform();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/users/register", {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (res.data) {
        toast.success(res.data.message || "Registration successful! Please check your email.");
        nav("/verify-email", {
          state: {
            email: res.data.user?.email || email.trim(),
            name: res.data.user?.name || name.trim(),
          },
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    const { API_BASE_URL } = await import("@/lib/api");
    if (isDesktop) {
      const { challenge } = await generatePkceChallenge();
      const authUrl = new URL(`${API_BASE_URL}/users/google`);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("redirect_uri", "notesify://callback");
      authUrl.searchParams.set("clientId", "notesify-desktop");
      authUrl.searchParams.set("clientType", "desktop");
      
      (window as any).electronAPI.auth.openExternal(authUrl.toString());
    } else if (isNative) {
      const { Browser } = await import("@capacitor/browser");
      const { challenge } = await generatePkceChallenge();
      const authUrl = new URL(`${API_BASE_URL}/users/google`);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("redirect_uri", "notesify://callback");
      authUrl.searchParams.set("clientId", "notesify-mobile");
      authUrl.searchParams.set("clientType", "mobile");
      
      await Browser.open({ url: authUrl.toString(), windowName: "_system" });
    } else {
      window.location.href = `${API_BASE_URL}/users/google`;
    }
  };

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
          Create an account
        </h1>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-[280px]">
          Join the minimalist workspace for your notes and thinking
        </p>
      </div>

      {/* Main Form Container */}
      <div className="w-full space-y-3.5">
        {/* Google 1-Tap Signup */}
        <button
          type="button"
          onClick={handleGoogleSignup}
          className="group relative flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-800 bg-black px-4 text-sm font-medium text-white transition-all hover:bg-zinc-900/90 hover:border-zinc-700 active:scale-[0.99] cursor-pointer"
        >
          <img src={Google} alt="" width={16} height={16} className="shrink-0" />
          <span>Continue with Google</span>
        </button>

        {/* Hairline Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="h-px w-full bg-zinc-800/80" />
          <span className="absolute bg-black px-2.5 text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">
            or continue with email
          </span>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleRegister} className="space-y-3.5 w-full">
          {/* Full Name */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-name" className="block text-xs font-medium text-zinc-300">
              Full name
            </label>
            <Input
              id="signup-name"
              name="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-black px-3.5 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-email" className="block text-xs font-medium text-zinc-300">
              Email address
            </label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-black px-3.5 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-password" className="block text-xs font-medium text-zinc-300">
              Password
            </label>
            <div className="relative">
              <Input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-black pl-3.5 pr-10 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !name.trim() || !email.trim() || password.length < 6}
            className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer shadow-sm pt-0"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin text-zinc-800" />
                <span>Creating account…</span>
              </span>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 text-center">
        <p className="text-xs text-zinc-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-white hover:text-zinc-200 hover:underline underline-offset-4 transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>

      {/* Understated Legal Disclaimer */}
      <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-zinc-600">
        <a
          href="https://notesify.in/terms"
          target="_blank"
          rel="noreferrer"
          className="hover:text-zinc-400 transition-colors"
        >
          Terms
        </a>
        <span>·</span>
        <a
          href="https://notesify.in/privacy"
          target="_blank"
          rel="noreferrer"
          className="hover:text-zinc-400 transition-colors"
        >
          Privacy Policy
        </a>
      </div>
    </div>
  );
};

export default SignupForm;
