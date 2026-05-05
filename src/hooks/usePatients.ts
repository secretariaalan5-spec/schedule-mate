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
          query = query.or(
            `name.ilike.%${safe}%,sus_card.ilike.%${safe}%,psf.ilike.%${safe}%`
          );
        }
      }

      const { data, error } = await query;
      if (error) throw error;
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
      const { count: total } = await supabase.from("patients").select("*", { count: "exact", head: true });
      const { count: withSus } = await supabase.from("patients").select("*", { count: "exact", head: true }).not("sus_card", "is", null);
      
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
