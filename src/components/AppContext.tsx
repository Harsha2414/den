"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Access, College, Profile } from "@/lib/types";

interface AppValue {
  me: Profile;
  access: Access;
  /** Verified (or still in the grace period): can post, comment, like, message, RSVP. */
  canAct: boolean;
  colleges: College[];
  collegeName: (id: string | null | undefined) => string;
  college: (id: string | null | undefined) => College | undefined;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ me, colleges, access, children }: { me: Profile; colleges: College[]; access?: Access; children: ReactNode }) {
  const value = useMemo<AppValue>(() => {
    const map = new Map(colleges.map((c) => [c.id, c]));
    const acc: Access = access || { level: me.verified ? "full" : "read" };
    return {
      me, colleges, access: acc, canAct: acc.level === "full" || acc.level === "grace",
      college: (id) => (id ? map.get(id) : undefined),
      collegeName: (id) => (id ? map.get(id)?.name || "" : ""),
    };
  }, [me, colleges, access]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
