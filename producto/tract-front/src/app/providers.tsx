"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // gcTime > staleTime: al volver a una sección ya visitada, la data
            // cacheada se pinta al instante (y revalida en background si está
            // stale) en vez de refetchear desde cero. 10 min cubre navegación
            // ida/vuelta típica sin retener memoria de más.
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors />
    </QueryClientProvider>
  );
}
