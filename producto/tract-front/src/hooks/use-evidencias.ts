"use client";

import { useQuery } from "@tanstack/react-query";
import { getEvidencias } from "@/lib/api/evidencias";

export function useEvidencias(ticketId?: string) {
  return useQuery({
    enabled: Boolean(ticketId),
    queryFn: () => getEvidencias(ticketId as string),
    queryKey: ["evidencias", ticketId],
  });
}
