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

function buildSlipHTML(slip: SlipData, logoUrl: string): string {
  return `
    <div style="width:100%;height:50%;box-sizing:border-box;padding:20px 30px;display:flex;flex-direction:column;font-family:Arial,sans-serif;position:relative;">
      <div style="text-align:center;margin-bottom:8px;">
        <img src="${logoUrl}" style="height:50px;margin-bottom:4px;" onerror="this.style.display='none'" />
        <div style="font-weight:bold;font-size:11px;">SECRETARIA MUNICIPAL DE SAUDE DE CAMOCIM</div>
        <div style="font-size:9px;color:#555;">RUA JO&Atilde;O PESSOA, 1252, BETANIA, CAMOCIM / CE - (88) 2221-0535</div>
        <div style="font-weight:bold;font-size:12px;margin-top:8px;">Comprovante de Agendamento</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px;font-size:12px;line-height:1.6;">
        <div><b>Nome:</b> &nbsp; ${slip.patientName}</div>
        <div style="display:flex;gap:30px;">
          <div><b>Data de Nascimento:</b> &nbsp; ${slip.dob}</div>
          <div><b>UBS:</b> &nbsp; ${slip.psf}</div>
        </div>
        <div style="margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">
          <div><b>Est&aacute; agendada para:</b> &nbsp; <b>HOSPITAL DEPUTADO MURILO AGUIAR - HDMA</b></div>
          <div><b>Endere&ccedil;o:</b> &nbsp; R.24 DE MAIO, S/N</div>
          <div><b>Profissional:</b> &nbsp; DR.GEFFERSON</div>
          <div><b>Seu procedimento de:</b> &nbsp; ${slip.reason || "GINECOLOGIA"}</div>
          <div style="display:flex;gap:30px;margin-top:4px;">
            <div><b>Data:</b> &nbsp; ${slip.date}</div>
            <div><b>Hor&aacute;rio Consulta:</b> &nbsp; ${slip.time}</div>
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

  // Use absolute URL so the logo loads correctly in every environment
  // (localhost, Vercel deploy, PWA, mobile browsers, etc.)
  const logoUrl = `${window.location.origin}/images/logo-camocim.png`;

  const slips: SlipData[] = appointmentsToPrint.map((appt) => {
    const pt = appt.patients;
    return {
      patientName: pt?.name || "—",
      dob: pt?.dob ? format(parseISO(pt.dob), "dd/MM/yyyy") : "—",
      psf: pt?.psf || "—",
      reason: appt.reason || "GINECOLOGIA",
      date: format(parseISO(appt.date), "dd/MM/yyyy"),
      time: appt.schedule_time || (appt.slot <= 15 ? "08:00" : "14:00"),
    };
  });

  let pagesHTML = "";
  for (let i = 0; i < slips.length; i += 2) {
    const slip1 = buildSlipHTML(slips[i], logoUrl);
    const slip2 =
      i + 1 < slips.length
        ? buildSlipHTML(slips[i + 1], logoUrl)
        : '<div style="height:50%;"></div>';
    pagesHTML += `<div class="page">${slip1}${slip2}</div>`;
  }

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
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
    page-break-after: always;
    overflow:hidden;
  }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>${pagesHTML}</body>
</html>`;

  // ─── Blob URL + hidden iframe ────────────────────────────────────────────────
  // Using a hidden iframe avoids popup-blockers completely and works on
  // mobile browsers, PWA contexts, and all modern desktop browsers.
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print-frame");
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      URL.revokeObjectURL(blobUrl);
    }, 3000);
  };

  iframe.onload = () => {
    // Wait a tick for images to render before calling print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback: open blob in a new tab if iframe.print() is blocked
        const win = window.open(blobUrl, "_blank");
        if (!win) {
          toast.error(
            "Não foi possível abrir a impressão. Permita popups neste site e tente novamente."
          );
        }
      }
      cleanup();
    }, 600);
  };

  iframe.onerror = () => {
    cleanup();
    toast.error("Erro ao preparar o comprovante para impressão.");
  };

  iframe.src = blobUrl;

  // ─── Mark appointments as printed in Supabase ───────────────────────────────
  const ids = appointmentsToPrint.map((a) => a.id);
  const { error } = await supabase
    .from("appointments")
    .update({ printed: true } as any)
    .in("id", ids);

  if (error) {
    console.error("Erro ao marcar como impresso:", error);
  } else {
    toast.success(`${ids.length} comprovante(s) marcado(s) como impresso(s)`);
    onRefresh?.();
  }
}
