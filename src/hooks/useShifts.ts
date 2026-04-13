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

export function useShifts() {
  return useQuery({
    queryKey: ["scheduling-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduling_shifts")
        .select("*")
        .eq("is_active", true)
        .order("start_slot");

      if (error) throw error;
      return data as ShiftConfiguration[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour since configs don't change often
  });
}
