import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import Google from "../../assets/google.svg";
import { toast } from "sonner";
import { generatePkceChallenge } from "../../utils/pkce";

const SignupForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/users/register", { name, email, password });
      if (res.data) {
        toast.success(res.data.message || "Registration successful! Please verify your email.");
        nav("/verify-email", {
          state: {
            email: res.data.user?.email || email,
            name: res.data.user?.name || name,
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

  const isDesktop = !!(window as any).electronAPI?.auth; //return true if desktop and false if web

  const handleGoogleSignup = async () => {
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
    <div className="relative flex w-full flex-col justify-center">
      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-start gap-4 text-left [@media(max-height:800px)]:mb-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-white/10 blur-[30px] scale-110" />
            <img
              src="./notesify-favicon.png"
              alt="Notesify"
              width={56}
              height={56}
              className="relative rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.05)]"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white">Create account</h1>
            <p className="text-sm text-zinc-200">
              Join the minimalist workspace for your <span className="text-white">ideas</span>.
            </p>
          </div>
        </div>

        <div className="group auth-card-group">
          <div className="auth-card-border" />

          <div className="auth-card [@media(max-height:800px)]:p-6">
            <form
              id="signup-form"
              name="signup"
              onSubmit={handleRegister}
              className="space-y-5 [@media(max-height:800px)]:space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="signup-name"
                  className="ml-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300"
                >
                  Full Name
                </label>
                <Input
                  id="signup-name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  className="h-12 border-white/10 bg-white/[0.03] text-white placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300 [@media(max-height:800px)]:h-10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="signup-email"
                  className="ml-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300"
                >
                  Email Address
                </label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  className="h-12 border-white/10 bg-white/[0.03] text-white placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300 [@media(max-height:800px)]:h-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="signup-password"
                  className="ml-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    className="h-12 border-white/10 bg-white/[0.03] pr-12 text-white placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300 [@media(max-height:800px)]:h-10"
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
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                variant="ghost"
                className="auth-primary-button auth-gradient-hover mt-2 h-12 w-full [@media(max-height:800px)]:h-10 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Creating account...
                  </span>
                ) : (
                  "Get Started"
                )}
              </Button>

              <div className="relative flex items-center gap-4 py-1 [@media(max-height:800px)]:py-0.5">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">or</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignup}
                variant="outline"
                className="auth-google-button auth-gradient-hover group relative h-12 w-full cursor-pointer overflow-hidden border-white/10 bg-gradient-to-r from-white/[0.03] via-indigo-400/10 to-white/[0.03] font-semibold text-white hover:border-white/20 active:scale-[0.98] [@media(max-height:800px)]:h-10"
              >
                <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-[100%]" />
                <span className="relative flex items-center justify-center gap-3">
                  <img src={Google} alt="Google" width={18} height={18} />
                  Continue with Google
                </span>
              </Button>
            </form>

            <div className="mt-6 border-t border-white/5 pt-5 text-center [@media(max-height:800px)]:mt-4 [@media(max-height:800px)]:pt-4">
              <p className="text-sm text-zinc-400">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-white transition-all hover:underline decoration-white/30 underline-offset-4">
                  Sign in instead
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4 text-left [@media(max-height:800px)]:mt-4">
          <p className="max-w-[380px] text-sm leading-relaxed text-zinc-200">
            By signing up, you agree to our <span onClick={() => window.open("https://notesify.in/terms", "_blank")} className="cursor-pointer font-semibold text-[#818cf8] transition-colors hover:text-indigo-400">Terms</span> and{" "}
            <span onClick={() => window.open("https://notesify.in/privacy", "_blank")} className="cursor-pointer font-semibold text-[#818cf8] transition-colors hover:text-indigo-400">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupForm;
