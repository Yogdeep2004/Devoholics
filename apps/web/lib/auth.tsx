"use client";
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

type Ctx = { session: Session | null; token: string | null; ready: boolean };
const AuthCtx = createContext<Ctx>({ session: null, token: null, ready: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return <AuthCtx.Provider value={{ session, token: session?.access_token ?? null, ready }}>{children}</AuthCtx.Provider>;
}

const noopSubscribe = () => () => {};

/** `ready` is false during SSR *and* during hydration (even for lazily hydrated Suspense boundaries),
 * so the first client render always matches the server HTML. */
export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return hydrated ? ctx : { session: null, token: null, ready: false };
}
