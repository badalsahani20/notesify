import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import Google from "../assets/google.svg";
import { toast } from "sonner";
import { generatePkceChallenge, getCodeVerifier, clearCodeVerifier } from "../utils/pkce";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const nav = useNavigate();

  const isDesktop = !!(window as any).electronAPI?.auth;

  useEffect(() => {
    if (isDesktop) {
      (window as any).electronAPI.auth.onOAuthCallback(async (code: string) => {
        try {
          setLoading(true);
          const code_verifier = getCodeVerifier();
          if (!code_verifier) {
             toast.error("Invalid state: no verifier");
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

  const handleResendVerification = async (userEmail: string) => {
    if (!userEmail) {
      toast.error("Please enter your email address first.");
      return;
    }
    try {
      const res = await api.post("/users/resend-verification", { email: userEmail });
      toast.success(res.data?.message || "Verification email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to resend verification email.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isDesktop) {
        // Desktop PKCE Flow
        const { challenge } = await generatePkceChallenge();
        
        // 1. Authenticate & get Authorization Code
        const authRes = await api.post("/users/desktop/login", {
          email,
          password,
          code_challenge: challenge,
          redirect_uri: "notesify://callback",
          clientId: "notesify-desktop",
          clientType: "desktop"
        });

        const authCode = authRes.data.authorizationCode;

        // 2. Exchange Authorization Code for tokens
        const exchangeRes = await api.post("/users/exchange-code", {
          code: authCode,
          code_verifier: getCodeVerifier()
        });

        if (exchangeRes.data?.refreshToken) {
          await (window as any).electronAPI.auth.setRefreshToken(exchangeRes.data.refreshToken);
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
        // Standard Web Flow
        const res = await api.post("/users/login", { email, password });
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
            label: "Resend Email",
            onClick: () => handleResendVerification(email),
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
    if (isDesktop) {
      const { challenge } = await generatePkceChallenge();
      const authUrl = new URL(`${import.meta.env.VITE_API_URL}/users/google`);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("redirect_uri", "notesify://callback");
      authUrl.searchParams.set("clientId", "notesify-desktop");
      authUrl.searchParams.set("clientType", "desktop");
      
      // Open in system browser, via IPC
      (window as any).electronAPI.auth.openExternal(authUrl.toString());
    } else {
      window.location.href = `${import.meta.env.VITE_API_URL}/users/google`;
    }
  };

  return (
    <>
      {/* Logo & Header */}
      <div className="mb-10 flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-[30px] scale-110" />
          <img
            src="/notesify-favicon.png"
            alt="Notesify"
            width={64}
            height={64}
            className="relative rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          />
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="text-sm text-zinc-200">The minimalist way to <span className="text-indigo-400 font-semibold">organize</span> your <span className="text-indigo-400 font-semibold">thoughts</span>.</p>
        </div>
      </div>

      {/* Translucent Obsidian Glass Card */}
      <div className="group relative z-10">
        <div className="absolute -inset-[1px] rounded-[21px] bg-gradient-to-b from-white/15 via-transparent to-white/5 opacity-50 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative rounded-2xl bg-white/[0.02] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_32px_100px_rgba(0,0,0,0.8)] backdrop-blur-[40px] border border-white/[0.08]">
          <form
            id="login-form"
            name="login"
            onSubmit={handleLogin}
            className="space-y-6"
          >
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300 ml-1"
              >
                Email Address
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 border-white/10 bg-white/[0.03] text-white placeholder:text-zinc-400 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label
                  htmlFor="login-password"
                  className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="min. 6 characters"
                  className="h-12 border-white/10 bg-white/[0.03] pr-12 text-white placeholder:text-zinc-400 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-zinc-400 transition-colors hover:text-white"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="auth-primary-button auth-gradient-hover h-12 w-full active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Authenticating…
                </span>
              ) : (
                "Continue"
              )}
            </Button>

            {/* Divider */}
            <div className="relative flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">security</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* Google */}
            <Button
              type="button"
              onClick={handleGoogleLogin}
              variant="outline"
              className="auth-google-button auth-gradient-hover group relative h-12 w-full cursor-pointer overflow-hidden border-white/10 bg-gradient-to-r from-white/[0.03] via-indigo-400/10 to-white/[0.03] font-semibold text-white hover:border-white/20 active:scale-[0.98]"
            >
              <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-[100%]" />
              <span className="relative flex items-center justify-center gap-3">
                <img src={Google} alt="Google" width={18} height={18} />
                Continue with Google
              </span>
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-sm text-zinc-400">
              New to Notesify?{" "}
              <Link to="/signup" className="font-semibold text-white transition-all hover:underline decoration-white/30 underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        <p className="text-[10px] text-white max-w-[280px] leading-relaxed">
          By continuing, you agree to our <span onClick={() => window.open("https://notesify.in/terms", "_blank")} className="text-[#818cf8] font-bold transition-colors hover:text-indigo-100 cursor-pointer">Terms</span> and <span onClick={() => window.open("https://notesify.in/privacy", "_blank")} className="text-[#818cf8] font-semibold transition-colors hover:text-indigo-100 cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </>
  );
};

export default Login;

