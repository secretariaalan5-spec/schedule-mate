import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "./useScheduling";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export function usePatients(search: string) {
  const queryClient = useQueryClient();

  // Cursor-based pagination via range(). Loads PAGE_SIZE rows at a time.
  const patientsQuery = useInfiniteQuery({
    queryKey: ["patients", search],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("patients")
        .select("*")
        .order("name")
        .range(from, to);

      if (search) {
        // Sanitize: PostgREST .or() breaks on commas, parentheses, quotes
        const safe = search.replace(/[,()"']/g, " ").trim();
        if (safe) {
          const orParts = [
            `name.ilike.%${safe}%`,
            `sus_card.ilike.%${safe}%`,
            `psf.ilike.%${safe}%`
          ];

          // Try to match Brazilian date DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
          const brDateMatch = safe.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
          if (brDateMatch) {
            const day = brDateMatch[1].padStart(2, "0");
            const month = brDateMatch[2].padStart(2, "0");
            let year = brDateMatch[3];
            if (year.length === 2) {
              const currentYear = new Date().getFullYear() % 100;
              const yearNum = parseInt(year, 10);
              year = yearNum > currentYear ? `19${year}` : `20${year}`;
            }
            orParts.push(`dob.eq.${year}-${month}-${day}`);
          }

          // Try to match DDMMYYYY or DDMMYY (digits only, length 6 or 8)
          const digitsMatch = safe.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);
          if (digitsMatch && !brDateMatch) {
            const day = digitsMatch[1];
            const month = digitsMatch[2];
            let year = digitsMatch[3];
            if (year.length === 2) {
              const currentYear = new Date().getFullYear() % 100;
              const yearNum = parseInt(year, 10);
              year = yearNum > currentYear ? `19${year}` : `20${year}`;
            }
            const d = parseInt(day, 10);
            const m = parseInt(month, 10);
            if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
              orParts.push(`dob.eq.${year}-${month}-${day}`);
            }
          }

          // Try to match ISO date YYYY-MM-DD
          const isoDateMatch = safe.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
          if (isoDateMatch) {
            const year = isoDateMatch[1];
            const month = isoDateMatch[2].padStart(2, "0");
            const day = isoDateMatch[3].padStart(2, "0");
            orParts.push(`dob.eq.${year}-${month}-${day}`);
          }

          query = query.or(orParts.join(","));
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error("Erro ao carregar pacientes:", error);
        toast.error("Não foi possível carregar pacientes");
        return [];
      }
      return data as Patient[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    staleTime: 1000 * 60 * 5,
  });

  const patients: Patient[] =
    patientsQuery.data?.pages.flat() ?? [];

  const totalStatsQuery = useQuery({
    queryKey: ["patients-stats"],
    queryFn: async () => {
      const { count: total, error: totalError } = await supabase.from("patients").select("*", { count: "exact", head: true });
      const { count: withSus, error: withSusError } = await supabase.from("patients").select("*", { count: "exact", head: true }).not("sus_card", "is", null);
      if (totalError || withSusError) {
        console.error("Erro ao carregar estatísticas de pacientes:", totalError || withSusError);
        return { total: 0, withSus: 0 };
      }
      
      return { total: total || 0, withSus: withSus || 0 };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const addPatientMutation = useMutation({
    mutationFn: async (patient: Omit<Patient, "id" | "legacy_id">) => {
      const { data, error } = await supabase.from("patients").insert(patient).select().single();
      if (error) throw error;
      return data as Patient;
    },
    onSuccess: () => {
      toast.success("Paciente cadastrada");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients-stats"] });
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    }
  });

  const updatePatientMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Patient> }) => {
      const { data, error } = await supabase.from("patients").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Patient;
    },
    onSuccess: () => {
      toast.success("Paciente atualizada");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    }
  });

  const deletePatientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Paciente removida");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients-stats"] });
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    }
  });

  return {
    patients,
    isLoading: patientsQuery.isLoading,
    isFetchingNextPage: patientsQuery.isFetchingNextPage,
    hasNextPage: !!patientsQuery.hasNextPage,
    fetchNextPage: patientsQuery.fetchNextPage,
    stats: totalStatsQuery.data || { total: 0, withSus: 0 },
    addPatient: addPatientMutation.mutateAsync,
    updatePatient: updatePatientMutation.mutateAsync,
    deletePatient: deletePatientMutation.mutateAsync,
  };
}
