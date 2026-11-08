"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui";
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
  const input = "w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm";
  return (
    <Card className="mx-auto mt-8 max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Email<input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="block text-sm">Password<input className={input} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
        {msg && <p role="alert" className="text-sm text-warn">{msg}</p>}
        <button disabled={busy} className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-60">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</button>
      </form>
      <button className="mt-3 text-sm text-muted hover:text-fg" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </Card>
  );
}
