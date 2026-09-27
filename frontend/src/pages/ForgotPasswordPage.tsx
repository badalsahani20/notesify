import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/users/forgot-password", { email });
            setSent(true);
            toast.success("Reset link sent!");
        } catch (error) {
            toast.error("Failed to send reset link");
        } finally {
            setLoading(false);
        }
    }

    if (sent) {
        return (
            <>
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
                            <h1 className="text-3xl font-bold tracking-tight text-white">Check your email</h1>
                            <p className="text-sm text-zinc-400">We sent a reset link to <span className="text-white font-medium">{email}</span>.</p>
                        </div>
                    </div>

                    <div className="group auth-card-group">
                        <div className="auth-card-border" />
                        <div className="auth-card text-center">
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                If you don’t see it, check your spam folder or try again with a different email address.
                            </p>
                            <div className="mt-8 space-y-4">
                                <Link
                                    to="/login"
                                    className="auth-primary-button inline-flex items-center justify-center"
                                >
                                    Return to Login
                                </Link>
                                <button
                                    onClick={() => setSent(false)}
                                    className="text-xs font-semibold uppercase tracking-widest text-zinc-400 transition hover:text-white"
                                >
                                    Try a different email
                                </button>
                            </div>
                        </div>
                    </div>
            </>
        );
    }

    return (
        <>
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
                        <h1 className="text-3xl font-bold tracking-tight text-white">Reset Password</h1>
                        <p className="text-sm text-zinc-400">We’ll email you a secure link to reset your account.</p>
                    </div>
                </div>

                <div className="group auth-card-group">
                    <div className="auth-card-border" />
                    <div className="auth-card">
                        <form 
                            id="forgot-password-form"
                            name="forgot-password"
                            onSubmit={handleSubmit} 
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <label 
                                    htmlFor="forgot-email"
                                    className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300 ml-1"
                                >
                                    Email Address
                                </label>
                                <Input
                                    id="forgot-email"
                                    name="email"
                                    placeholder="name@example.com"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-12 border-white/10 bg-white/[0.03] text-white placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300"
                                />
                            </div>
                            <Button className="auth-primary-button auth-gradient-hover h-12 w-full active:scale-[0.98]" disabled={loading} variant="ghost">
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                                        Sending…
                                    </span>
                                ) : "Send Reset Link"}
                            </Button>
                        </form>
                        <div className="mt-8 pt-6 border-t border-white/5 text-center">
                            <Link to="/login" className="text-xs font-semibold uppercase tracking-widest text-zinc-400 transition-colors hover:text-white">
                                Back to Login
                            </Link>
                        </div>
                    </div>
                </div>
        </>
    );
}
