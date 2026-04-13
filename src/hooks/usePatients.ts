import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "./useScheduling";
import { toast } from "sonner";

export function usePatients(search: string) {
  const queryClient = useQueryClient();

  const patientsQuery = useQuery({
    queryKey: ["patients", search],
    queryFn: async () => {
      let query = supabase.from("patients").select("*").order("name");
      
      if (search) {
        // ILIKE for case-insensitive search. OR for multiple columns
        query = query.or(`name.ilike.%${search}%,sus_card.ilike.%${search}%,psf.ilike.%${search}%`);
      }
      
      // Limit to 100 records for performance, since it's search-driven now
      query = query.limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
    // Add debounce effect via staleTime if desired, but React Query handles it reasonably well.
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

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
    patients: patientsQuery.data || [],
    isLoading: patientsQuery.isLoading,
    stats: totalStatsQuery.data || { total: 0, withSus: 0 },
    addPatient: addPatientMutation.mutateAsync,
    updatePatient: updatePatientMutation.mutateAsync,
    deletePatient: deletePatientMutation.mutateAsync,
  };
}
