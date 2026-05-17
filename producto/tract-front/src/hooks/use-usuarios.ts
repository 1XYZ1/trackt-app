"use client";

import { useQuery } from "@tanstack/react-query";
import { getMecanicos } from "@/lib/api/usuarios";

export function useMecanicos() {
  return useQuery({
    queryFn: getMecanicos,
    queryKey: ["usuarios", "mecanicos"],
  });
}
