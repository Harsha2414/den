"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Access, College, Profile } from "@/lib/types";

interface AppValue {
  me: Profile;
  access: Access;
  /** Verified (or still in the grace period): can post, comment, like, message, RSVP. */
  canAct: boolean;
  /** Colleges with students on Den (the full list of ~70,000 is searched, not loaded). */
  colleges: College[];
  /** Load a college that isn't in `colleges` yet (a college nobody from has joined). */
  ensureCollege: (id: string | null | undefined) => void;
  collegeName: (id: string | null | undefined) => string;
  college: (id: string | null | undefined) => College | undefined;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ me, colleges, access, children }: { me: Profile; colleges: College[]; access?: Access; children: ReactNode }) {
  const [extra, setExtra] = useState<College[]>([]);
  const asked = useRef(new Set<string>());
  const ensureCollege = useCallback((id: string | null | undefined) => {
    if (!id || id === "india" || asked.current.has(id) || colleges.some((c) => c.id === id)) return;
    asked.current.add(id);
    supabaseBrowser().from("colleges").select("id,name,city,state").eq("id", id).maybeSingle()
      .then(({ data }: { data: College | null }) => { if (data) setExtra((x) => [...x, data]); });
  }, [colleges]);
  const value = useMemo<AppValue>(() => {
    const map = new Map([...colleges, ...extra].map((c) => [c.id, c]));
    const acc: Access = access || { level: me.verified ? "full" : "read" };
    return {
      me, colleges, ensureCollege, access: acc, canAct: acc.level === "full" || acc.level === "grace",
      college: (id) => (id ? map.get(id) : undefined),
      collegeName: (id) => (id ? map.get(id)?.name || "" : ""),
    };
  }, [me, colleges, extra, access, ensureCollege]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
