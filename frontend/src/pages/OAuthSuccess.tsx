import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { requestSessionRefresh } from "@/lib/api";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import notesifyLogo from "@/assets/notesify-favicon.svg";
import { toast } from "sonner";

const OAuthSuccess = () => {
  const navigate = useNavigate();
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowNotice(true);
    }, 5000);

    const finishOAuthLogin = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          // Exchange authorization code for tokens
          const res = await api.post("/users/exchange-code", { code });
          const { user, accessToken } = res.data;
          useAuthStore.getState().setAuth(user, accessToken);
        } else {
          // Fallback legacy cookie refresh
          await requestSessionRefresh();
        }

        toast.success("Signed in successfully!");
        navigate("/", { replace: true });
      } catch (error) {
        console.error("OAuth completion failed:", error);
        toast.error("Google authentication failed. Please try again.");
        navigate("/login", { replace: true });
      }
    };

    finishOAuthLogin();

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="w-full flex flex-col items-center text-center">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center">
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
          Authenticating…
        </h1>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-[280px] leading-relaxed">
          Connecting your account and setting up your workspace.
        </p>
      </div>

      {/* Loading Status Card */}
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex items-center justify-center gap-3">
        <Loader2 size={16} className="animate-spin text-zinc-300" />
        <span className="text-xs text-zinc-300 font-medium">
          Securing session…
        </span>
      </div>

      {/* Graceful Fallback if Network Stalls */}
      {showSlowNotice && (
        <div className="mt-6 space-y-3">
          <p className="text-xs text-zinc-500">
            Taking longer than expected?
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to Login</span>
          </Link>
        </div>
      )}

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
};

export default OAuthSuccess;
