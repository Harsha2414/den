"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./AppContext";

/** Who is online right now (Den open and visible on their screen). */
const OnlineCtx = createContext<Set<string>>(new Set());

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { me } = useApp();
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    const supabase = supabaseBrowser();
    const ch = supabase.channel("online", { config: { presence: { key: me.id } } });
    const sync = () => setOnline(new Set(Object.keys(ch.presenceState())));
    const show = () => {
      if (document.visibilityState === "visible") ch.track({ at: Date.now() });
      else ch.untrack();
    };
    ch.on("presence", { event: "sync" }, sync)
      .subscribe((status: string) => { if (status === "SUBSCRIBED") show(); });
    document.addEventListener("visibilitychange", show);
    return () => { document.removeEventListener("visibilitychange", show); supabase.removeChannel(ch); };
  }, [me.id]);
  return <OnlineCtx.Provider value={online}>{children}</OnlineCtx.Provider>;
}

export const useOnline = () => useContext(OnlineCtx);

/** Wraps an avatar with a green dot when that student is online. */
export function OnlineDot({ id, children }: { id: string; children: ReactNode }) {
  const online = useOnline().has(id);
  return <span className="av-wrap">{children}{online && <i className="online-dot" aria-label="Online" />}</span>;
}
