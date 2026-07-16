import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Appointment } from "@/hooks/useScheduling";
import type { ShiftConfiguration } from "@/hooks/useShifts";

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

export const exportDayExcel = (selectedDate: string | undefined, appointments: Appointment[], shifts: ShiftConfiguration[]) => {
  if (!selectedDate || appointments.length === 0) {
    toast("Nenhuma marcação para exportar neste dia.");
    return;
  }

  const parsedDate = new Date(`${selectedDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    toast.error("Data inválida — não foi possível exportar.");
    return;
  }
  const formattedDate = capitalizeText(format(parsedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }));
  
  const sheetRows: any[][] = [
    ["AGENDA DE ATENDIMENTO"],
    [`Data: ${formattedDate}`],
    [],
  ];

  shifts.forEach(shift => {
    const shiftAppointments = appointments.filter(a => a.slot >= shift.start_slot && a.slot <= shift.end_slot);
    const slots = Array.from({ length: shift.end_slot - shift.start_slot + 1 }, (_, i) => i + shift.start_slot);
    
    sheetRows.push([`${shift.display_title} (Vagas ${shift.start_slot}–${shift.end_slot})`]);
    sheetRows.push(EXPORT_HEADERS);
    sheetRows.push(...buildShiftRows(slots, shiftAppointments));
    sheetRows.push([]); // Spacer
  });

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
  
  // Basic merges for header
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, format(parsedDate, "dd-MM EEE", { locale: ptBR }));
  XLSX.writeFile(wb, `agenda_${selectedDate}.xlsx`);
};
