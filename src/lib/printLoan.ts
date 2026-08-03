import type { Loan } from "@/hooks/useLoans";
import { toast } from "sonner";

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function printLoanReceipt(loan: Loan) {
  const patientName = loan.patient?.name ?? "—";
  const dob = fmt(loan.patient?.dob);
  const sus = loan.patient?.sus_card ?? "—";
  const cpf = (loan.patient as any)?.cpf ?? "—";
  const phone = (loan.patient as any)?.phone ?? "—";
  const acs = (loan.patient as any)?.acs ?? "—";
  const psf = loan.patient?.psf ?? "—";
  const code = loan.glucometer?.code ?? "—";
  const brand = loan.glucometer?.brand ?? "—";
  const loanedAt = fmt(loan.loaned_at);
  const expectedReturn = fmt(loan.expected_return_date);
  const notes = loan.notes ? `<div><b>Observações:</b> &nbsp; ${loan.notes}</div>` : "";

  const buildSlipHTML = (label: string) => `
    <div style="width:100%;height:50%;box-sizing:border-box;padding:20px 30px;display:flex;flex-direction:column;font-family:Arial,sans-serif;position:relative;">
      <div style="text-align:center;margin-bottom:8px;">
        <img src="/images/logo-camocim.png" style="height:50px;margin-bottom:4px;" />
        <div style="font-weight:bold;font-size:11px;">SECRETARIA MUNICIPAL DE SAUDE DE CAMOCIM</div>
        <div style="font-size:9px;color:#555;">RUA JOÃO PESSOA, 1252, BETANIA, CAMOCIM / CE - (88) 2221-0535</div>
        <div style="font-weight:bold;font-size:12px;margin-top:8px;">Termo de Empréstimo de Glicosímetro</div>
        <div style="font-size:10px;color:#333;font-weight:bold;margin-top:2px;">${label}</div>
      </div>
      
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px;font-size:12px;line-height:1.6;">
        <div><b>Nome:</b> &nbsp; ${patientName}</div>
        <div style="display:flex;gap:30px;">
          <div><b>CPF:</b> &nbsp; ${cpf}</div>
          <div><b>Cartão SUS:</b> &nbsp; ${sus}</div>
        </div>
        <div style="display:flex;gap:30px;">
          <div><b>Contato:</b> &nbsp; ${phone}</div>
          <div><b>ACS:</b> &nbsp; ${acs}</div>
        </div>
        <div style="display:flex;gap:30px;">
          <div><b>PSF / UBS:</b> &nbsp; ${psf}</div>
          <div><b>Data de Nascimento:</b> &nbsp; ${dob}</div>
        </div>
        
        <div style="margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">
          <div style="display:flex;gap:30px;">
            <div><b>Aparelho (Código):</b> &nbsp; <b>${code}</b></div>
            <div><b>Marca / Modelo:</b> &nbsp; ${brand}</div>
          </div>
          <div style="display:flex;gap:30px;margin-top:4px;">
            <div><b>Data de Retirada:</b> &nbsp; ${loanedAt}</div>
            <div><b>Devolução Prevista:</b> &nbsp; <b>${expectedReturn}</b></div>
          </div>
          ${notes}
        </div>
        
        <p style="font-size:10px;color:#444;line-height:1.4;margin-top:8px;text-align:justify;">
          Declaro ter recebido o glicosímetro identificado acima em perfeitas condições de uso, comprometendo-me a zelar por sua conservação e devolvê-lo no prazo estabelecido.
        </p>
      </div>
      
      <div style="display:flex;justify-content:space-between;gap:30px;margin-top:20px;margin-bottom:10px;">
        <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:4px;font-size:10px;">Assinatura do Paciente / Responsável</div>
        <div style="flex:1;text-align:center;border-top:1px solid #333;padding-top:4px;font-size:10px;">Assinatura do Profissional Responsável</div>
      </div>
      
      <div style="position:absolute;bottom:0;left:0;right:0;border-bottom:2px dashed #aaa;"></div>
    </div>
  `;

  const html = `<!DOCTYPE html>
  <html>
  <head>
  <title>Recibo de Empréstimo</title>
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
  <body>
    <div class="page">
      ${buildSlipHTML("1ª VIA — PACIENTE")}
      ${buildSlipHTML("2ª VIA — UNIDADE DE SAÚDE")}
    </div>
  </body>
  </html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Popup bloqueado. Permita popups para imprimir.");
    return;
  }
  w.document.write(html);
  w.document.close();

  const img = w.document.querySelector("img");
  const doPrint = () => {
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };
  if (img && !img.complete) {
    img.onload = doPrint;
    img.onerror = doPrint;
  } else {
    doPrint();
  }
}