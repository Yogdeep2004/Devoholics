"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

/** Fetch once auth state is known (so personalised endpoints get the token); refetch when path changes. */
export function useApi<T>(path: string | null, authed = false) {
  const { token, ready } = useAuth();
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  const key = `${path}|${token ?? ""}`;
  useEffect(() => {
    if (!path || !ready || (authed && !token)) return;
    let live = true;
    api<T>(path, { token }).then(
      (data) => live && setState({ key, data }),
      (e) => live && setState({ key, error: e.message }),
    );
    return () => { live = false; };
  }, [path, token, ready, authed, key]);
  const current = state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined,
           loading: !!path && !(current && (state.data !== undefined || state.error)) };
}
