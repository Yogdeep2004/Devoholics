"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data.session) router.push("/library");
    else setMsg("Check your email to confirm your account, then sign in.");
  }
  return (
    <div className="relative isolate -mt-8 grid min-h-[calc(100dvh-3.5rem)] items-center gap-12 py-12 lg:grid-cols-[1.1fr_1fr]">
      <div aria-hidden className="hero-art pointer-events-none absolute inset-0 -z-10 bg-cover bg-[position:35%_50%] opacity-60 max-lg:hidden" style={{ backgroundImage: "url(/art/signal-field.png)" }} />
      <div className="max-lg:hidden">
        <h2 className="display max-w-md text-4xl">Design your stack with the data in front of you.</h2>
        <p className="mt-4 max-w-sm text-[15px] text-muted">Save tools, follow what matters, and build architectures the assistant can review but never change without you.</p>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border-strong bg-surface/90 p-6 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.8)] backdrop-blur lg:justify-self-end">
        <h1 className="display text-2xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block space-y-1.5 text-[13px] text-muted">Email
            <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="block space-y-1.5 text-[13px] text-muted">Password
            <input className="field" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
            {mode === "up" && <span className="block text-xs text-faint">At least 8 characters.</span>}</label>
          {msg && <p role="alert" className="text-[13px] text-warn">{msg}</p>}
          <button disabled={busy} className="btn btn-primary h-10 w-full text-sm">{busy ? "Please wait..." : mode === "in" ? "Sign in" : "Sign up"}</button>
        </form>
        <button className="mt-4 text-[13px] text-muted transition-colors duration-150 hover:text-fg" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
