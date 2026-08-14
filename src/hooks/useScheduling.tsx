import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SHIFTS, useShifts } from "./useShifts";
import { supabase } from "@/integrations/supabase/client";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatValidLocalDate, parseValidLocalDate, toLocalDateKey } from "@/lib/dateUtils";

export interface Patient {
  id: string;
  legacy_id: string | null;
  name: string;
  sus_card: string | null;
  cpf: string | null;
  acs: string | null;
  phone: string | null;
  dob: string | null;
  psf: string | null;
  observations: string | null;
  is_pregnant?: boolean | null;
  dum?: string | null;
  risk_classification?: 'BAIXO' | 'ALTO' | null;
  gestational_notes?: string | null;
}

export interface Appointment {
  id: string;
  slot: number;
  date: string;
  patient_id: string;
  reason: string | null;
  type: string;
  schedule_time: string;
  printed: boolean;
  patients?: Patient;
}

export function useScheduling() {
  const queryClient = useQueryClient();
  const { data: shifts = DEFAULT_SHIFTS } = useShifts();
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey(new Date()) ?? "");

  // Query: Appointment counts per date (used for calendar occupancy heatmap)
  // Uses a database view that does GROUP BY on the server — much faster than downloading every row
  const { data: appointmentCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["appointmentCounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_counts_by_date" as any)
        .select("date, count");
      if (error) {
        console.error("Erro ao carregar dias com agendamentos:", error);
        return {};
      }
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        if (typeof row.date !== "string" || !parseValidLocalDate(row.date)) return;
        const count = Number(row.count);
        if (!Number.isFinite(count) || count < 0) return;
        counts[row.date.slice(0, 10)] = count;
      });
      return counts;
    },
    staleTime: 1000 * 60 * 2, // 2 min — refreshed by realtime anyway
  });
  const appointmentDates = Object.keys(appointmentCounts);

  // Query: Appointments for selectedDate
  const { data: appointments = [], isLoading: loading } = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, slot, date, patient_id, reason, type, schedule_time, printed, patients(id, name, sus_card, dob, psf, observations, is_pregnant, risk_classification)")
        .eq("date", selectedDate)
        .order("slot");
      if (error) {
        console.error("Erro ao carregar agendamentos:", error);
        toast.error("Não foi possível carregar a agenda");
        return [];
      }
      return (data as any) || [];
    },
    enabled: !!selectedDate,
    staleTime: 1000 * 30, // 30s — refreshed by realtime
  });

  // Realtime subscriptions
  useEffect(() => {
    let timer: number | undefined;
    const CHANNEL_NAME = `realtime-scheduling_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["appointmentCounts"] });
      }, 250);
    };
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, refresh)
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutations
  const addAppointmentMutation = useMutation({
    mutationFn: async ({ slot, date, patientId, reason, type = "NORMAL", scheduleTime }: any) => {
      let time = scheduleTime;
      if (!time) {
        const matchingShift = shifts.find(s => slot >= s.start_slot && slot <= s.end_slot);
        time = matchingShift ? matchingShift.default_time : (slot <= 15 ? "08:00" : "14:00");
      }
      const { error } = await supabase.from("appointments").insert({
        slot, date, patient_id: patientId, reason, type, schedule_time: time
      } as any);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Consulta agendada");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointmentCounts"] });
    },
    onError: (error) => toast.error("Erro: " + error.message)
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { error } = await supabase.from("appointments").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consulta atualizada");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error) => toast.error("Erro: " + error.message)
  });

  const updateAppointmentTimeMutation = useMutation({
    mutationFn: async ({ id, scheduleTime }: { id: string, scheduleTime: string }) => {
      const { error } = await supabase.from("appointments").update({ schedule_time: scheduleTime } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário atualizado");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error) => toast.error("Erro: " + error.message)
  });

  const removeAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Consulta removida");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointmentCounts"] });
    },
    onError: (error) => toast.error("Erro: " + error.message)
  });

  const addAppointment = async (slot: number, date: string, patientId: string, reason: string, type: string = "NORMAL", scheduleTime?: string) => {
    try {
      await addAppointmentMutation.mutateAsync({ slot, date, patientId, reason, type, scheduleTime });
      return true;
    } catch {
      return false;
    }
  };

  const updateAppointment = async (id: string, updates: any) => {
    try {
      await updateAppointmentMutation.mutateAsync({ id, updates });
    } catch {}
  };

  const updateAppointmentTime = async (id: string, scheduleTime: string) => {
    try {
      await updateAppointmentTimeMutation.mutateAsync({ id, scheduleTime });
    } catch {}
  };

  const removeAppointment = async (id: string) => {
    try {
      await removeAppointmentMutation.mutateAsync(id);
    } catch {}
  };

  const getPatientHistory = async (patientId: string) => {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .order("date", { ascending: false });
    if (error) { toast.error("Erro ao buscar histórico"); return []; }
    return data || [];
  };

  const fetchAppointments = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  };

  const fetchAppointmentDates = () => {
    queryClient.invalidateQueries({ queryKey: ["appointmentCounts"] });
  };

  return {
    selectedDate, setSelectedDate, appointments, loading,
    appointmentDates, appointmentCounts,
    addAppointment, updateAppointment, removeAppointment,
    getPatientHistory,
    updateAppointmentTime,
    fetchAppointments, fetchAppointmentDates,
  };
}

export function formatDateBR(dateStr: string | null | undefined) {
  return formatValidLocalDate(dateStr, "dd/MM/yyyy", dateStr || "—", { locale: ptBR });
}

export function formatDateFull(dateStr: string | null | undefined) {
  return formatValidLocalDate(dateStr, "EEEE, dd 'de' MMMM 'de' yyyy", dateStr || "—", { locale: ptBR });
}
