"use client";

import { useQuery } from "@tanstack/react-query";
import { getEquipos } from "@/lib/api/equipos";

export function useEquipos() {
  return useQuery({
    queryFn: getEquipos,
    queryKey: ["equipos"],
  });
}
