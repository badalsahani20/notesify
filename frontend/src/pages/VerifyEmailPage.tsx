import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

type VerificationState = "idle" | "pending" | "success" | "error";

const VerifyEmailPage = () => {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuth, user } = useAuthStore();
  const [status, setStatus] = useState<VerificationState>(token ? "pending" : "idle");
  const [showManualContinue, setShowManualContinue] = useState(false);
  const [message, setMessage] = useState(
    token ? "Verifying your email and preparing your workspace..." : "We sent a verification link to your inbox."
  );

  const stateEmail = (location.state as { email?: string } | null)?.email;
  const emailToDisplay = stateEmail || user?.email;
  const maskedEmail = useMemo(() => {
    if (!emailToDisplay) return null;
    const [localPart, domain] = emailToDisplay.split("@");
    if (!localPart || !domain) return emailToDisplay;
    return `${localPart.slice(0, 2)}${"*".repeat(Math.max(1, localPart.length - 2))}@${domain}`;
  }, [emailToDisplay]);

  const hasCalled = useRef(false);
  useEffect(() => {
    if (!token || hasCalled.current) return;
    hasCalled.current = true;

    let isMounted = true;

    const verify = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        // Small delay to ensure any background session provider check settles first
        await new Promise(resolve => setTimeout(resolve, 800));

        const apiUrl = import.meta.env.VITE_API_URL;
        console.log("Starting verification with fetch...");

        const res = await fetch(`${apiUrl}/users/verify-email/${token}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const data = await res.json();
        if (!isMounted) return;

        console.log("Verification Success:", data.success);

        // Update UI status immediately
        setStatus("success");
        setMessage(data.message || "Email verified successfully.");
        toast.success("Email verified successfully");

        // Sync the store with the new verified user
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

      } catch (error: any) {
        clearTimeout(timeoutId);
        if (!isMounted) return;

        console.error("Verification error:", error.message);
        if (error.name === "AbortError") console.error("Request timed out after 10 seconds");

        // Safety fallback: if we got the welcome email, we are verified!
        if (user?.isVerified) {
          console.log("User already verified, skipping error state.");
          navigate("/", { replace: true });
          return;
        }

        setStatus("error");
        setMessage(error.message?.includes("Abort")
          ? "The request timed out. Please check your internet or try refreshing."
          : "This verification link is invalid or has expired.");
      }
    };

    const escapeTimer = setTimeout(() => {
      if (status === "pending") setShowManualContinue(true);
    }, 5000);

    verify();

    return () => {
      isMounted = false;
      clearTimeout(escapeTimer);
    };
  }, [navigate, setAuth, token, status, user?.isVerified]);

  // Handle post-success redirect in a dedicated effect
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        navigate("/", { replace: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const [resending, setResending] = useState(false);
  const [customEmail, setCustomEmail] = useState("");

  const handleResendEmail = async () => {
    const targetEmail = emailToDisplay || customEmail;
    if (!targetEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setResending(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/users/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend email");

      toast.success(data.message || "Verification email sent!");
    } catch (err: any) {
      toast.error(err.message || "Could not resend verification email");
    } finally {
      setResending(false);
    }
  };

  const title = token ? "Verify your account" : "Check your inbox";
  const subtitle = token
    ? "We’re confirming your email before opening Notesify."
    : "A quick verification keeps your account secure.";

  const statusIcon =
    status === "pending" ? (
      <Loader2 className="size-7 animate-spin text-indigo-300" />
    ) : status === "success" ? (
      <CheckCircle2 className="size-7 text-emerald-400" />
    ) : status === "error" ? (
      <TriangleAlert className="size-7 text-amber-400" />
    ) : (
      <MailCheck className="size-7 text-indigo-300" />
    );

  return (
    <div className="mx-auto w-full max-w-md">
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
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-zinc-200">{subtitle}</p>
        </div>
      </div>

      <div className="group relative z-10">
        <div className="absolute -inset-[1px] rounded-[21px] bg-gradient-to-b from-white/15 via-transparent to-white/5 opacity-50 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_32px_100px_rgba(0,0,0,0.8)] backdrop-blur-[40px]">
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05]">
              {statusIcon}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {status === "success"
                  ? "Verification complete"
                  : status === "error"
                    ? "Verification failed"
                    : token
                      ? "Confirming your email"
                      : "Verification email sent"}
              </p>
              <p className="text-sm leading-relaxed text-zinc-300">{message}</p>
            </div>
          </div>

          {!token && maskedEmail ? (
            <div className="mb-6 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-4 text-sm leading-relaxed text-indigo-100">
              We sent a secure verification link to <span className="font-semibold text-white">{maskedEmail}</span>.
            </div>
          ) : null}

          {status === "error" && !emailToDisplay ? (
            <div className="mb-6 space-y-2">
              <label htmlFor="resend-email-input" className="text-xs font-medium text-zinc-300">
                Enter email to receive new link:
              </label>
              <input
                id="resend-email-input"
                type="email"
                placeholder="name@example.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400"
              />
            </div>
          ) : null}

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-indigo-300" />
              <p className="text-sm leading-relaxed text-zinc-300">
                The link expires in 24 hours, so it’s best to verify your account right away.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 size-4 text-indigo-300" />
              <p className="text-sm leading-relaxed text-zinc-300">
                If you don’t see the email, check spam, promotions, or social folders before trying again.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {status === "error" ? (
              <>
                <Button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="auth-primary-button auth-gradient-hover h-12 w-full"
                >
                  {resending ? "Sending..." : "Resend Verification Email"}
                </Button>
                <Button asChild variant="outline" className="h-12 w-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
                  <Link to="/signup">Create a new account</Link>
                </Button>
              </>
            ) : token ? (
              <Button
                asChild={status === "pending" && showManualContinue}
                type="button"
                disabled={status === "pending" && !showManualContinue}
                className={`auth-primary-button h-12 w-full ${status === "pending" && !showManualContinue ? "cursor-default opacity-90" : "auth-gradient-hover"}`}
              >
                {status === "pending" && showManualContinue ? (
                  <Link to="/login">Account ready? Login Now</Link>
                ) : status === "pending" ? (
                  "Verifying..."
                ) : (
                  "Redirecting..."
                )}
              </Button>
            ) : (
              <>
                <Button asChild className="auth-primary-button auth-gradient-hover h-12 w-full">
                  <a href="https://mail.google.com" target="_blank" rel="noreferrer">
                    Open Email
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="h-12 w-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                >
                  {resending ? "Sending..." : "Resend Email"}
                </Button>
              </>
            )}

            <Button asChild variant="outline" className="h-12 w-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              <Link to="/login">Back to login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
