"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Keeps loaded pages in memory, so going back is instant and data refreshes quietly in the background. */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 10 * 60_000, refetchOnWindowFocus: true, retry: 1 },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
