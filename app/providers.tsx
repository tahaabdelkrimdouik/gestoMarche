"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MutationActivity from "@/components/MutationActivity";
import { useState } from "react";
import { useVisualViewport } from "@/hooks/useVisualViewport";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  useVisualViewport();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <MutationActivity />
    </QueryClientProvider>
  );
}
