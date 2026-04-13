import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Appointment } from "@/hooks/useScheduling";

export const MORNING_SLOTS = Array.from({ length: 15 }, (_, i) => i + 1);
export const AFTERNOON_SLOTS = Array.from({ length: 17 }, (_, i) => i + 16);
export const EXPORT_HEADERS = ["Nº", "NOME", "CARTÃO SUS", "DATA NASCIMENTO", "PSF", "HORÁRIO", "MOTIVO", "TIPO", "ASSINATURA"];

export const capitalizeText = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const formatPatientDob = (dob: string | null | undefined) => {
  if (!dob) return "";
  const parsed = new Date(`${dob}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? dob : format(parsed, "dd/MM/yyyy");
};

export const buildShiftRows = (
  slots: number[],
  appointments: Appointment[],
) => {
  const bySlot = new Map(appointments.map((appointment) => [appointment.slot, appointment]));

  return slots.map((slot) => {
    const appointment = bySlot.get(slot);
    return [
      slot,
      appointment?.patients?.name || "",
      appointment?.patients?.sus_card || "",
      formatPatientDob(appointment?.patients?.dob),
      appointment?.patients?.psf || "",
      appointment?.schedule_time || "",
      appointment?.reason || "",
      appointment?.type || "",
      "",
    ];
  });
};

export const exportDayExcel = (selectedDate: string | undefined, appointments: Appointment[]) => {
  if (!selectedDate || appointments.length === 0) {
    toast("Nenhuma marcação para exportar neste dia.");
    return;
  }

  const morning = appointments.filter(a => a.slot >= 1 && a.slot <= 15).sort((a, b) => a.slot - b.slot);
  const afternoon = appointments.filter(a => a.slot >= 16 && a.slot <= 32).sort((a, b) => a.slot - b.slot);

  const parsedDate = new Date(`${selectedDate}T12:00:00`);
  const formattedDate = capitalizeText(format(parsedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }));
  const sheetRows = [
    ["AGENDA DE ATENDIMENTO"],
    [`Data: ${formattedDate}`],
    [],
    ["MANHÃ — 08:00 — ZONA RURAL (Vagas 1–15)"],
    EXPORT_HEADERS,
    ...buildShiftRows(MORNING_SLOTS, morning),
    [],
    ["TARDE — 14:00 — CIDADE / CAMOCIM (Vagas 16–32)"],
    EXPORT_HEADERS,
    ...buildShiftRows(AFTERNOON_SLOTS, afternoon),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 34 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 30 },
    { wch: 12 },
    { wch: 18 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
    { s: { r: 20, c: 0 }, e: { r: 20, c: 8 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, format(parsedDate, "dd-MM EEE", { locale: ptBR }));
  XLSX.writeFile(wb, `agenda_${selectedDate}.xlsx`);
};
