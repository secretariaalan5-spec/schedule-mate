import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Appointment } from "@/hooks/useScheduling";
import { format, parseISO } from "date-fns";

interface SlipData {
  patientName: string;
  dob: string;
  psf: string;
  reason: string;
  date: string;
  time: string;
}

function buildSlipHTML(slip: SlipData): string {
  return `
    <div style="width:100%;height:50%;box-sizing:border-box;padding:20px 30px;display:flex;flex-direction:column;font-family:Arial,sans-serif;position:relative;">
      <div style="text-align:center;margin-bottom:8px;">
        <img src="/images/logo-camocim.png" style="height:50px;margin-bottom:4px;" />
        <div style="font-weight:bold;font-size:11px;">SECRETARIA MUNICIPAL DE SAUDE DE CAMOCIM</div>
        <div style="font-size:9px;color:#555;">RUA JOÃO PESSOA, 1252, BETANIA, CAMOCIM / CE - (88) 2221-0535</div>
        <div style="font-weight:bold;font-size:12px;margin-top:8px;">Comprovante de Agendamento</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px;font-size:12px;line-height:1.6;">
        <div><b>Nome:</b> &nbsp; ${slip.patientName}</div>
        <div style="display:flex;gap:30px;">
          <div><b>Data de Nascimento:</b> &nbsp; ${slip.dob}</div>
          <div><b>UBS:</b> &nbsp; ${slip.psf}</div>
        </div>
        <div style="margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">
          <div><b>Está agendada para:</b> &nbsp; <b>HOSPITAL DEPUTADO MURILO AGUIAR - HDMA</b></div>
          <div><b>Endereço:</b> &nbsp; R.24 DE MAIO, S/N</div>
          <div><b>Profissional:</b> &nbsp; DR.GEFFERSON</div>
          <div><b>Seu procedimento de:</b> &nbsp; ${slip.reason || "GINECOLOGIA"}</div>
          <div style="display:flex;gap:30px;margin-top:4px;">
            <div><b>Data:</b> &nbsp; ${slip.date}</div>
            <div><b>Horário Consulta:</b> &nbsp; ${slip.time}</div>
          </div>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;border-bottom:2px dashed #aaa;"></div>
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
    };
  });

  let pagesHTML = "";
  for (let i = 0; i < slips.length; i += 2) {
    const slip1 = buildSlipHTML(slips[i]);
    const slip2 = i + 1 < slips.length
      ? buildSlipHTML(slips[i + 1])
      : '<div style="height:50%;"></div>';
    pagesHTML += `
      <div class="page">
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

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Comprovantes</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: A4 portrait; margin: 0; }
  body { width:210mm; }
  .page {
    width:210mm;
    height:297mm;
    display:flex;
    flex-direction:column;
    page-break-after:always;
    overflow:hidden;
  }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>${pagesHTML}</body>
</html>`);
  printWindow.document.close();

  const img = printWindow.document.querySelector("img");
  const doPrint = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
  if (img && !img.complete) {
    img.onload = doPrint;
    img.onerror = doPrint;
  } else {
    doPrint();
  }

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
