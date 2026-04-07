import { useState, useEffect, useCallback } from "react";
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

export interface ReleasedDay {
  id: string;
  date: string;
}

export function useScheduling() {
  const [releasedDays, setReleasedDays] = useState<ReleasedDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReleasedDays = useCallback(async () => {
    const { data, error } = await supabase.from("released_days").select("*").order("date");
    if (error) { toast.error("Erro ao carregar dias liberados"); return; }
    setReleasedDays(data || []);
    if (data && data.length > 0 && !selectedDate) {
      const today = format(new Date(), "yyyy-MM-dd");
      const future = data.find(d => d.date >= today);
      setSelectedDate(future?.date || data[data.length - 1].date);
    }
  }, [selectedDate]);

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

  const fetchPatients = useCallback(async () => {
    const { data, error } = await supabase.from("patients").select("*").order("name");
    if (error) { toast.error("Erro ao carregar pacientes"); return; }
    setPatients(data || []);
  }, []);

  useEffect(() => { fetchReleasedDays(); fetchPatients(); }, [fetchReleasedDays, fetchPatients]);
  useEffect(() => { if (selectedDate) fetchAppointments(selectedDate); }, [selectedDate, fetchAppointments]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("realtime-scheduling")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, (payload) => {
        if (selectedDate) fetchAppointments(selectedDate);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "released_days" }, () => {
        fetchReleasedDays();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => {
        fetchPatients();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchAppointments, fetchReleasedDays, fetchPatients]);

  const addReleasedDay = async (date: string) => {
    const { error } = await supabase.from("released_days").insert({ date });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Dia liberado adicionado");
    fetchReleasedDays();
  };

  const removeReleasedDay = async (date: string) => {
    const { error } = await supabase.from("released_days").delete().eq("date", date);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Dia removido");
    fetchReleasedDays();
  };

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

  const addPatient = async (patient: Omit<Patient, "id" | "legacy_id">) => {
    const { data, error } = await supabase.from("patients").insert(patient).select().single();
    if (error) { toast.error("Erro: " + error.message); return null; }
    toast.success("Paciente cadastrada");
    fetchPatients();
    return data;
  };

  const updatePatient = async (id: string, patient: Partial<Patient>) => {
    const { error } = await supabase.from("patients").update(patient).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Paciente atualizada");
    fetchPatients();
  };

  const deletePatient = async (id: string) => {
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Paciente removida");
    fetchPatients();
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
    releasedDays, selectedDate, setSelectedDate, appointments, patients, loading,
    addReleasedDay, removeReleasedDay, addAppointment, removeAppointment,
    addPatient, updatePatient, deletePatient, getPatientHistory,
    updateAppointmentTime,
    fetchPatients, fetchAppointments, fetchReleasedDays,
  };
}

export function formatDateBR(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateFull(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}
