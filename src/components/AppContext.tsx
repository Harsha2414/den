"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { College, Profile } from "@/lib/types";

interface AppValue {
  me: Profile;
  colleges: College[];
  collegeName: (id: string | null | undefined) => string;
  college: (id: string | null | undefined) => College | undefined;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ me, colleges, children }: { me: Profile; colleges: College[]; children: ReactNode }) {
  const value = useMemo<AppValue>(() => {
    const map = new Map(colleges.map((c) => [c.id, c]));
    return {
      me, colleges,
      college: (id) => (id ? map.get(id) : undefined),
      collegeName: (id) => (id ? map.get(id)?.name || "" : ""),
    };
  }, [me, colleges]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
