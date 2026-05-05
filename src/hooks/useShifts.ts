import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShiftConfiguration {
  id: string;
  label: string;
  display_title: string;
  start_slot: number;
  end_slot: number;
  default_time: string;
  is_active: boolean;
}

export const DEFAULT_SHIFTS: ShiftConfiguration[] = [
  {
    id: "default-morning",
    label: "morning",
    display_title: "Manhã / Zona Rural",
    start_slot: 1,
    end_slot: 15,
    default_time: "08:00",
    is_active: true,
  },
  {
    id: "default-afternoon",
    label: "afternoon",
    display_title: "Tarde / Cidade",
    start_slot: 16,
    end_slot: 32,
    default_time: "14:00",
    is_active: true,
  },
];

export function useShifts() {
  return useQuery({
    queryKey: ["scheduling-shifts"],
    queryFn: async () => {
      // scheduling_shifts is not yet present in generated Supabase types,
      // so we cast the client to any to access it.
      const { data, error } = await (supabase as any)
        .from("scheduling_shifts")
        .select("*")
        .eq("is_active", true)
        .order("start_slot");

      if (error) {
        console.error("Erro ao carregar turnos:", error);
        return DEFAULT_SHIFTS;
      }
      return data && data.length > 0 ? (data as ShiftConfiguration[]) : DEFAULT_SHIFTS;
    },
    placeholderData: DEFAULT_SHIFTS,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour since configs don't change often
  });
}
