import { useState, useEffect, useCallback, useRef } from "react";
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
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [appointmentDates, setAppointmentDates] = useState<string[]>([]);

  // Debounce refs to prevent rapid re-fetches from realtime
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  const debouncedCall = useCallback((key: string, fn: () => void, delay = 500) => {
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(fn, delay);
  }, []);

  const fetchAppointmentDates = useCallback(async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("date")
      .order("date");
    if (!error && data) {
      const uniqueDates = [...new Set(data.map(d => d.date))];
      setAppointmentDates(uniqueDates);
    }
  }, []);

  const fetchAppointments = useCallback(async (date: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("*, patients(*)")
      .eq("date", date)
      .order("slot");
    if (error) { toast.error("Erro ao carregar agendamentos"); setLoading(false); return; }
    setAppointments((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAppointmentDates(); }, [fetchAppointmentDates]);
  useEffect(() => { if (selectedDate) fetchAppointments(selectedDate); }, [selectedDate, fetchAppointments]);

  // Realtime subscriptions with debounce
  useEffect(() => {
    const channel = supabase
      .channel("realtime-scheduling")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        debouncedCall("appointments", () => {
          if (selectedDate) fetchAppointments(selectedDate);
          fetchAppointmentDates();
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchAppointments, fetchAppointmentDates, debouncedCall]);

  const addAppointment = async (slot: number, date: string, patientId: string, reason: string, type: string = "NORMAL", scheduleTime?: string) => {
    const time = scheduleTime || (slot <= 15 ? "08:00" : "14:00");
    const { error } = await supabase.from("appointments").insert({
      slot, date, patient_id: patientId, reason, type, schedule_time: time
    } as any);
    if (error) { toast.error("Erro: " + error.message); return false; }
    toast.success("Consulta agendada");
    fetchAppointments(date);
    return true;
  };

  const updateAppointment = async (id: string, updates: { reason?: string; type?: string; schedule_time?: string; patient_id?: string }) => {
    const { error } = await supabase.from("appointments").update(updates as any).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Consulta atualizada");
    if (selectedDate) fetchAppointments(selectedDate);
  };

  const updateAppointmentTime = async (id: string, scheduleTime: string) => {
    const { error } = await supabase.from("appointments").update({ schedule_time: scheduleTime } as any).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Horário atualizado");
    if (selectedDate) fetchAppointments(selectedDate);
  };

  const removeAppointment = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Consulta removida");
    if (selectedDate) fetchAppointments(selectedDate);
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
