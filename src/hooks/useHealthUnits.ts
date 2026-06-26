import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HealthUnit {
  id: string;
  name: string;
  address: string | null;
  created_at?: string;
}

export function useHealthUnits() {
  return useQuery<HealthUnit[]>({
    queryKey: ["health_units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_units")
        .select("id, name, address")
        .order("name");
      if (error) {
        console.error("Erro ao carregar unidades de saúde:", error);
        return [];
      }
      return (data as HealthUnit[]) ?? [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes — units change rarely
  });
}

export function useHealthUnitsPatientCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ["health_units_patient_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_unit_patient_counts" as any)
        .select("name, patient_count");
      if (error) {
        console.error("Erro ao contar pacientes por PSF:", error);
        return {};
      }
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        if (row.name) {
          counts[row.name] = row.patient_count || 0;
        }
      });
      return counts;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useHealthUnitsMutations() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async (newUnit: Omit<HealthUnit, "id">) => {
      const { data, error } = await supabase
        .from("health_units")
        .insert(newUnit)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Unidade de saúde adicionada");
      queryClient.invalidateQueries({ queryKey: ["health_units"] });
      queryClient.invalidateQueries({ queryKey: ["health_units_patient_counts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao adicionar unidade: " + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, address }: { id: string; name: string; address: string | null }) => {
      const { data, error } = await supabase
        .from("health_units")
        .update({ name, address })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Unidade de saúde atualizada");
      queryClient.invalidateQueries({ queryKey: ["health_units"] });
      // Invalidate patients count in case a unit was renamed (names are text field links)
      queryClient.invalidateQueries({ queryKey: ["health_units_patient_counts"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar unidade: " + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("health_units")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Unidade de saúde removida");
      queryClient.invalidateQueries({ queryKey: ["health_units"] });
      queryClient.invalidateQueries({ queryKey: ["health_units_patient_counts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover unidade: " + error.message);
    }
  });

  return {
    addHealthUnit: addMutation.mutateAsync,
    updateHealthUnit: updateMutation.mutateAsync,
    deleteHealthUnit: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
