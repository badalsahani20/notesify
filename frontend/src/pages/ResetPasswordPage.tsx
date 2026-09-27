import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function ResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post(`/users/reset-password/${token}`, { password });
            toast.success("Password reset successful! Please login");
            navigate("/login");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid or expired token");
        } finally {
            setLoading(false);
        }
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
                    <p className="text-sm text-zinc-400">Create a new secure password to continue.</p>
                </div>
            </div>

            <div className="group auth-card-group">
                <div className="auth-card-border" />
                <div className="auth-card">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300 ml-1">New Password</label>
                            <Input
                                placeholder="At least 6 characters"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                className="h-12 border-white/10 bg-white/[0.03] text-white placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/5 transition-all duration-300"
                            />
                        </div>
                        <Button className="auth-primary-button auth-gradient-hover h-12 w-full active:scale-[0.98]" disabled={loading} variant="ghost">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                                    Updating…
                                </span>
                            ) : "Update Password"}
                        </Button>
                    </form>
                </div>
            </div>
        </>
    );
}

