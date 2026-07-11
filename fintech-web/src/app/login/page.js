"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, login, signup, resetPassword } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Already signed in → skip straight to the console.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResetSent(false);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setResetSent(false);
    if (!email.trim()) {
      setError("Enter your email above first, then tap \u201cForgot password\u201d again.");
      return;
    }
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  // Avoid a flash of the form while we determine whether a session already exists.
  if (loading || user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-navy-950">
        <Loader2 className="h-5 w-5 animate-spin text-vault-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-navy-950">
      {/* Left: brand / value panel — hidden on small screens */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-navy-950 px-12 py-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(217,190,90,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(217,190,90,0.5) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-vault-400/15 ring-1 ring-vault-400/30">
            <Landmark className="h-4.5 w-4.5 text-vault-400" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight text-white">
              Tendai Reporting
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Multi-Tenant Console
            </p>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-3xl font-bold leading-tight text-white">
            Real-time visibility across every branch, every currency.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            USD, ZWG, and ZAR cash flow, compliance flags, and retail ledger activity —
            unified in a single command center.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {[
              "Live USD / ZWG / ZAR conversion",
              "AML compliance command center",
              "Branch-level retail cash ledger",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5 text-sm text-slate-300">
                <ShieldCheck className="h-4 w-4 shrink-0 text-vault-400" strokeWidth={2} />
                {line}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-slate-600">
          Bank-grade encryption &middot; SOC 2 aligned
        </p>
      </div>

      {/* Right: auth form */}
      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-navy-950 ring-1 ring-vault-400/30">
              <Landmark className="h-4.5 w-4.5 text-vault-400" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight text-navy-900">
                Tendai Reporting
              </p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Multi-Tenant Console
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-navy-900">
            {mode === "signup" ? "Create your account" : "Sign in to your console"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {mode === "signup"
              ? "Set up access to your tenant's financial reporting console."
              : "Enter your credentials to access the reporting console."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Full name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tendai Moyo"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-navy-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-vault-400 focus:ring-1 focus:ring-vault-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@tendai.co.zw"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-navy-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-vault-400 focus:ring-1 focus:ring-vault-400"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600">
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-navy-700 hover:text-vault-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-navy-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-vault-400 focus:ring-1 focus:ring-vault-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {resetSent && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Password reset email sent — check your inbox.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "signup" ? "Already have an account?" : "Need a console account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
                setResetSent(false);
              }}
              className="font-semibold text-navy-900 hover:text-vault-600 hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
