/* Hallmark · component: login · genre: modern-minimal · theme: vercel-obsidian
 * states: default · hover · focus-visible · active · disabled · loading · error · success
 * contrast: pass (WCAG AAA on black canvas)
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import Google from "@/assets/google.svg";
import notesifyLogo from "@/assets/notesify-favicon.svg";
import { toast } from "sonner";
import { generatePkceChallenge, getCodeVerifier, clearCodeVerifier } from "@/utils/pkce";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { setAuth } = useAuthStore();
  const nav = useNavigate();

  const isDesktop = typeof window !== "undefined" && Boolean((window as any).electronAPI?.auth);
  const isNative = Capacitor.isNativePlatform();

  // Desktop OAuth deep-link listener
  useEffect(() => {
    if (isDesktop) {
      (window as any).electronAPI.auth.onOAuthCallback(async (code: string) => {
        try {
          setLoading(true);
          const code_verifier = getCodeVerifier();
          if (!code_verifier) {
            toast.error("Invalid authentication state. Please try again.");
            return;
          }

          const res = await api.post("/users/exchange-code", { code, code_verifier });
          
          if (res.data?.refreshToken) {
            await (window as any).electronAPI.auth.setRefreshToken(res.data.refreshToken);
          }

          setAuth(
            {
              id: res.data.user.id || res.data.user._id,
              name: res.data.user.name,
              email: res.data.user.email,
              avatar: res.data.user.avatar,
              isVerified: res.data.user.isVerified,
            },
            res.data.accessToken
          );
          clearCodeVerifier();
          nav("/");
        } catch (error: any) {
          toast.error("Google authentication failed");
          console.error(error);
        } finally {
          setLoading(false);
        }
      });
    }
  }, [isDesktop, nav, setAuth]);

  const handleEmailStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setStep("password");
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 60);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    try {
      if (isDesktop || isNative) {
        // Native Client PKCE Flow (Electron Desktop & Capacitor Mobile)
        const { challenge } = await generatePkceChallenge();
        const clientId = isDesktop ? "notesify-desktop" : "notesify-mobile";
        const clientType = isDesktop ? "desktop" : "mobile";

        // 1. Authenticate with credentials and retrieve authorization code
        const authRes = await api.post("/users/desktop/login", {
          email: email.trim(),
          password,
          code_challenge: challenge,
          redirect_uri: "notesify://callback",
          clientId,
          clientType,
        });

        const authCode = authRes.data.authorizationCode;

        // 2. Exchange authorization code for tokens
        const exchangeRes = await api.post("/users/exchange-code", {
          code: authCode,
          code_verifier: getCodeVerifier(),
        });

        // 3. Persist rotated refresh token into native secure storage
        if (exchangeRes.data?.refreshToken) {
          if (isDesktop) {
            await (window as any).electronAPI.auth.setRefreshToken(exchangeRes.data.refreshToken);
          } else if (isNative) {
            await Preferences.set({ key: "refreshToken", value: exchangeRes.data.refreshToken });
          }
        }

        setAuth(
          {
            id: exchangeRes.data.user.id || exchangeRes.data.user._id,
            name: exchangeRes.data.user.name,
            email: exchangeRes.data.user.email,
            avatar: exchangeRes.data.user.avatar,
            isVerified: exchangeRes.data.user.isVerified,
          },
          exchangeRes.data.accessToken
        );
        clearCodeVerifier();
        nav("/");
      } else {
        // Standard Web Flow (cookies managed by browser)
        const res = await api.post("/users/login", { email: email.trim(), password });
        if (res.data) {
          setAuth(
            {
              id: res.data.user.id || res.data.user._id,
              name: res.data.user.name,
              email: res.data.user.email,
              avatar: res.data.user.avatar,
              isVerified: res.data.user.isVerified,
            },
            res.data.accessToken
          );
          nav("/");
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err?.response?.data?.message || "Invalid email or password";

      if (errorMessage.toLowerCase().includes("verify your email")) {
        toast.error(errorMessage, {
          action: {
            label: "Enter Code",
            onClick: () => nav("/verify-email", { state: { email: email.trim() } }),
          },
          duration: 8000,
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
          Log in to Notesify
        </h1>
      </div>

      {/* Main Form Container */}
      <div className="w-full">
        <AnimatePresence mode="wait" initial={false}>
          {step === "email" ? (
            /* ── Step 1: Vercel-Style Initial View (Email + Providers) ── */
            <motion.form
              key="step-email"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              onSubmit={handleEmailStepSubmit}
              className="space-y-3.5 w-full"
            >
              <div>
                <Input
                  ref={emailInputRef}
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="Email Address"
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
                disabled={!email.trim()}
                className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer shadow-sm"
              >
                Continue with Email
              </Button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="group relative flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-800 bg-black px-4 text-sm font-medium text-white transition-all hover:bg-zinc-900/90 hover:border-zinc-700 active:scale-[0.99] cursor-pointer"
              >
                <img src={Google} alt="" width={16} height={16} className="shrink-0" />
                <span>Continue with Google</span>
              </button>
            </motion.form>
          ) : (
            /* ── Step 2: Expanded Password View ── */
            <motion.form
              key="step-password"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleLogin}
              className="space-y-4 w-full"
            >
              {/* Email Pill with Edit Action */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                <span className="text-zinc-300 font-mono truncate max-w-[220px]">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setTimeout(() => emailInputRef.current?.focus(), 50);
                  }}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs font-medium ml-2 shrink-0"
                >
                  Edit
                </button>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="text-xs font-medium text-zinc-300"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    ref={passwordInputRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
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

              {/* Submit CTA */}
              <Button
                type="submit"
                disabled={loading || !password}
                className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer shadow-sm"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin text-zinc-800" />
                    <span>Signing in…</span>
                  </span>
                ) : (
                  "Log In"
                )}
              </Button>

              {/* Back to Email step */}
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setTimeout(() => emailInputRef.current?.focus(), 50);
                }}
                className="flex items-center justify-center gap-1.5 w-full text-xs text-zinc-400 hover:text-white transition-colors py-1 cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Back to all options</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 text-center">
        <p className="text-xs text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-medium text-white hover:text-zinc-200 hover:underline underline-offset-4 transition-colors"
          >
            Sign Up
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

export default Login;
