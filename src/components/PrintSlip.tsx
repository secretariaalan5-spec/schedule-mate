import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Appointment, Patient } from "@/hooks/useScheduling";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SlipData {
  patientName: string;
  dob: string;
  psf: string;
  reason: string;
  date: string;
  time: string;
  appointmentId: string;
}

function buildSlipHTML(slip: SlipData): string {
  return `
    <div style="width:100%;height:50%;box-sizing:border-box;padding:30px 40px;display:flex;flex-direction:column;justify-content:space-between;border-bottom:1px dashed #ccc;font-family:Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:10px;">
        <img src="/images/logo-camocim.png" style="height:60px;margin-bottom:6px;" />
        <div style="font-weight:bold;font-size:13px;">SECRETARIA MUNICIPAL DE SAUDE DE CAMOCIM</div>
        <div style="font-size:11px;color:#555;">RUA JOÃO PESSOA, 1252, BETANIA, CAMOCIM / CE - (88) 2221-0535</div>
        <div style="font-weight:bold;font-size:14px;margin-top:10px;">Comprovante de Agendamento</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px;font-size:13px;">
        <div style="display:flex;gap:20px;">
          <div><b>Nome:</b> &nbsp; ${slip.patientName}</div>
        </div>
        <div style="display:flex;gap:40px;">
          <div><b>Data de Nascimento:</b> &nbsp; ${slip.dob}</div>
          <div><b>UBS:</b> &nbsp; ${slip.psf}</div>
        </div>
        <div style="margin-top:12px;border-top:1px solid #eee;padding-top:10px;">
          <div><b>Está agendada para:</b> &nbsp; <b>HOSPITAL DEPUTADO MURILO AGUIAR - HDMA</b></div>
          <div><b>Endereço:</b> &nbsp; R.24 DE MAIO, S/N</div>
          <div><b>Profissional:</b> &nbsp; DR.GEFFERSON</div>
          <div><b>Seu procedimento de:</b> &nbsp; ${slip.reason || "GINECOLOGIA"}</div>
          <div style="display:flex;gap:40px;margin-top:4px;">
            <div><b>Data:</b> &nbsp; ${slip.date}</div>
            <div><b>Horário Consulta:</b> &nbsp; ${slip.time}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function printAppointments(
  appointmentsToPrint: Appointment[],
  onRefresh?: () => void
) {
  if (appointmentsToPrint.length === 0) {
    toast.error("Nenhuma consulta selecionada para imprimir");
    return;
  }

  const slips: SlipData[] = appointmentsToPrint.map(appt => {
    const pt = appt.patients;
    const isMorning = appt.slot <= 15;
    return {
      patientName: pt?.name || "—",
      dob: pt?.dob ? format(parseISO(pt.dob), "dd/MM/yyyy") : "—",
      psf: pt?.psf || "—",
      reason: appt.reason || "GINECOLOGIA",
      date: format(parseISO(appt.date), "dd/MM/yyyy"),
      time: isMorning ? "8:00" : "14:00",
      appointmentId: appt.id,
    };
  });

  // Build pages (2 slips per A4 page)
  let pagesHTML = "";
  for (let i = 0; i < slips.length; i += 2) {
    const slip1 = buildSlipHTML(slips[i]);
    const slip2 = i + 1 < slips.length ? buildSlipHTML(slips[i + 1]) : '<div style="height:50%;"></div>';
    pagesHTML += `
      <div style="width:210mm;height:297mm;page-break-after:always;display:flex;flex-direction:column;">
        ${slip1}
        ${slip2}
      </div>
    `;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Popup bloqueado. Permita popups para imprimir.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comprovantes de Agendamento</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>${pagesHTML}</body>
    </html>
  `);
  printWindow.document.close();

  // Wait for images to load then print
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };

  // Mark as printed
  const ids = appointmentsToPrint.map(a => a.id);
  const { error } = await supabase
    .from("appointments")
    .update({ printed: true } as any)
    .in("id", ids);

  if (error) {
    console.error("Error marking as printed:", error);
  } else {
    toast.success(`${ids.length} comprovante(s) marcado(s) como impresso(s)`);
    onRefresh?.();
  }
}
