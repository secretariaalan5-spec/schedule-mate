import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type TimelineModule = "agenda" | "emprestimos" | "implanon";

export type TimelineEvent = {
  id: string;
  patient_id: string;
  module: TimelineModule;
  event_type: string;
  event_date: string;
  event_time: string | null;
  title: string;
  detail: string | null;
  status: string | null;
  created_at: string;
};

/** Prontuário unificado: todos os eventos da paciente, de todos os módulos. */
export function usePatientTimeline(patientId?: string) {
  return useQuery({
    queryKey: ["patient-timeline", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await db
        .from("patient_timeline")
        .select("*")
        .eq("patient_id", patientId)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });
}