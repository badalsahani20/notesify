import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, ArrowLeft, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";
import api from "@/lib/api";
import notesifyLogo from "@/assets/notesify-favicon.svg";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

type VerificationState = "idle" | "verifying" | "success" | "error";

const VerifyEmailPage = () => {
  const { token } = useParams<{ token?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuth, user } = useAuthStore();

  const isDesktop = typeof window !== "undefined" && Boolean((window as any).electronAPI?.auth);
  const isNative = Capacitor.isNativePlatform();

  // Email context
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const [email, setEmail] = useState<string>(stateEmail || user?.email || "");
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Status for magic link or overall state
  const [status, setStatus] = useState<VerificationState>(token ? "verifying" : "idle");
  const [statusMessage, setStatusMessage] = useState(
    token ? "Confirming your email verification link…" : ""
  );

  // 6-digit OTP states
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer (30s)
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Masked email for security display
  const maskedEmail = useMemo(() => {
    if (!email) return null;
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return email;
    return `${localPart.slice(0, 2)}${"*".repeat(Math.max(1, localPart.length - 2))}@${domain}`;
  }, [email]);

  // Handle Token Verification (Magic Link Fallback)
  const hasCalledToken = useRef(false);
  useEffect(() => {
    if (!token || hasCalledToken.current) return;
    hasCalledToken.current = true;

    const verifyToken = async () => {
      try {
        const res = await api.get(`/users/verify-email/${token}`);
        const data = res.data;

        if (data?.refreshToken) {
          if (isDesktop) {
            await (window as any).electronAPI?.auth?.setRefreshToken(data.refreshToken);
          } else if (isNative) {
            await Preferences.set({ key: "refreshToken", value: data.refreshToken });
          }
        }

        setStatus("success");
        setStatusMessage(data.message || "Email verified successfully.");
        toast.success("Email verified successfully!");

        setAuth(
          {
            id: data.user?.id || data.user?._id,
            name: data.user?.name,
            email: data.user?.email,
            avatar: data.user?.avatar,
            isVerified: true,
          },
          data.accessToken
        );

        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1200);
      } catch (error: any) {
        if (user?.isVerified) {
          navigate("/", { replace: true });
          return;
        }

        setStatus("error");
        setStatusMessage(
          error.response?.data?.message || "This verification link is invalid or has expired."
        );
      }
    };

    verifyToken();
  }, [navigate, setAuth, token, user?.isVerified, isDesktop, isNative]);

  // Auto-focus first OTP input on mount if not using magic token
  useEffect(() => {
    if (!token && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [token]);

  // Verify OTP submission handler
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || otp.join("")).trim();
    const targetEmail = email.trim();

    if (!targetEmail) {
      toast.error("Please enter your email address");
      setIsEditingEmail(true);
      return;
    }

    if (finalCode.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code");
      return;
    }

    setSubmittingOtp(true);
    try {
      const res = await api.post("/users/verify-otp", {
        email: targetEmail,
        otp: finalCode,
      });

      const data = res.data;
      if (data?.refreshToken) {
        if (isDesktop) {
          await (window as any).electronAPI?.auth?.setRefreshToken(data.refreshToken);
        } else if (isNative) {
          await Preferences.set({ key: "refreshToken", value: data.refreshToken });
        }
      }

      toast.success("Account verified successfully!");
      setAuth(
        {
          id: data.user?.id || data.user?._id,
          name: data.user?.name,
          email: data.user?.email,
          avatar: data.user?.avatar,
          isVerified: true,
        },
        data.accessToken
      );

      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid or expired verification code");
    } finally {
      setSubmittingOtp(false);
    }
  };

  // OTP Input event handlers
  const handleOtpChange = (index: number, val: string) => {
    const sanitized = val.replace(/\D/g, "");

    // If pasted or auto-filled multiple characters
    if (sanitized.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = sanitized[i] || "";
      }
      setOtp(newOtp);
      const nextFocus = Math.min(sanitized.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (sanitized.length >= 6) {
        handleVerifyOtp(sanitized.slice(0, 6));
      }
      return;
    }

    const singleDigit = sanitized.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = singleDigit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 filled
    if (singleDigit && index === 5) {
      const allDigits = newOtp.join("");
      if (allDigits.length === 6) {
        handleVerifyOtp(allDigits);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        e.preventDefault();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
  };

  // Resend code handler
  const handleResend = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast.error("Please enter your email address first");
      setIsEditingEmail(true);
      return;
    }

    setResending(true);
    try {
      const res = await api.post("/users/resend-verification", { email: targetEmail });
      toast.success(res.data?.message || "A new 6-digit code has been sent to your email!");
      setResendCooldown(30);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to resend verification code");
    } finally {
      setResending(false);
    }
  };

  // 1. Magic Link View (when token is in URL)
  if (token) {
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Verifying email</h1>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-[280px]">
            Confirming your account before opening your workspace
          </p>
        </div>

        {/* Status Card */}
        <div className="w-full space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800/80">
              {status === "verifying" ? (
                <Loader2 className="size-4.5 animate-spin text-zinc-300" />
              ) : status === "success" ? (
                <CheckCircle2 className="size-4.5 text-emerald-400" />
              ) : (
                <RotateCw className="size-4.5 text-amber-400" />
              )}
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">
                {status === "verifying"
                  ? "Verifying magic link…"
                  : status === "success"
                  ? "Email verified"
                  : "Verification link expired"}
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">{statusMessage}</p>
            </div>
          </div>

          {status === "error" && (
            <div className="space-y-2 pt-1">
              <Button
                asChild
                className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
              >
                <Link to="/verify-email" state={{ email }}>
                  Enter 6-digit code instead
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-black text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
              >
                <Link to="/login">Back to Login</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. In-App 6-Digit OTP View (Standard flow)
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
        <h1 className="text-2xl font-bold tracking-tight text-white">Enter verification code</h1>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-[290px] leading-relaxed">
          We sent a 6-digit security code to your email
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full space-y-4">
        {/* Email Pill with Edit Option */}
        {email && !isEditingEmail ? (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs">
            <span className="text-zinc-400">
              Code sent to: <span className="font-medium text-white">{maskedEmail}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsEditingEmail(true)}
              className="text-[11px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 text-left">
            <label htmlFor="verify-email-input" className="block text-xs font-medium text-zinc-300">
              Email address
            </label>
            <div className="flex gap-2">
              <Input
                id="verify-email-input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-zinc-800 bg-black px-3.5 text-sm text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/30 transition-colors"
              />
              {isEditingEmail && email && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingEmail(false)}
                  className="h-10 px-3 rounded-lg border border-zinc-800 bg-black text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700"
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 6-Digit OTP Inputs */}
        <div className="py-2">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                disabled={submittingOtp}
                className="w-10 sm:w-11 h-12 text-center text-lg font-mono font-semibold text-white bg-black border border-zinc-800 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50 select-all"
              />
            ))}
          </div>
        </div>

        {/* Primary Verification Action */}
        <Button
          type="button"
          onClick={() => handleVerifyOtp()}
          disabled={submittingOtp || otp.join("").length !== 6}
          className="h-10 w-full rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer shadow-sm"
        >
          {submittingOtp ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={15} className="animate-spin text-zinc-800" />
              <span>Verifying code…</span>
            </span>
          ) : (
            "Verify & Continue"
          )}
        </Button>

        {/* Resend Code Section */}
        <div className="pt-1 flex items-center justify-between text-xs text-zinc-400">
          <span>Didn't receive the code?</span>
          {resendCooldown > 0 ? (
            <span className="text-zinc-500 font-mono">Resend in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-medium text-white hover:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {resending ? "Sending…" : "Resend Code"}
            </button>
          )}
        </div>
      </div>

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

export default VerifyEmailPage;
