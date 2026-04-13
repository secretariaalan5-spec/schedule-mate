import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export interface Patient {
  id: string;
  legacy_id: string | null;
  name: string;
  sus_card: string | null;
  dob: string | null;
  psf: string | null;
  observations: string | null;
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
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Query: Appointment Dates
  const { data: appointmentDates = [] } = useQuery({
    queryKey: ["appointmentDates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("date")
        .order("date");
      if (error) throw error;
      return [...new Set(data.map(d => d.date))];
    }
  });

  // Query: Appointments for selectedDate
  const { data: appointments = [], isLoading: loading } = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(*)")
        .eq("date", selectedDate)
        .order("slot");
      if (error) { throw error; }
      return (data as any) || [];
    },
    enabled: !!selectedDate
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("realtime-scheduling")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["appointmentDates"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Mutations
  const addAppointmentMutation = useMutation({
    mutationFn: async ({ slot, date, patientId, reason, type = "NORMAL", scheduleTime }: any) => {
      const time = scheduleTime || (slot <= 15 ? "08:00" : "14:00");
      const { error } = await supabase.from("appointments").insert({
        slot, date, patient_id: patientId, reason, type, schedule_time: time
      } as any);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Consulta agendada");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointmentDates"] });
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
      queryClient.invalidateQueries({ queryKey: ["appointmentDates"] });
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
    queryClient.invalidateQueries({ queryKey: ["appointmentDates"] });
  };

  return {
    selectedDate, setSelectedDate, appointments, loading,
    appointmentDates,
    addAppointment, updateAppointment, removeAppointment,
    getPatientHistory,
    updateAppointmentTime,
    fetchAppointments, fetchAppointmentDates,
  };
}

export function formatDateBR(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateFull(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}
