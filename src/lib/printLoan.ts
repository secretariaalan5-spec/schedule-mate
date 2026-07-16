import type { Loan } from "@/hooks/useLoans";

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function printLoanReceipt(loan: Loan) {
  const patientName = loan.patient?.name ?? "—";
  const sus = loan.patient?.sus_card ?? "—";
  const psf = loan.patient?.psf ?? "—";
  const code = loan.glucometer?.code ?? "—";
  const brand = loan.glucometer?.brand ?? "—";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>Recibo de Empréstimo</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; }
    h1 { font-size: 18px; margin:0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
    .sub { font-size: 12px; color:#555; margin-bottom: 18px; }
    .box { border: 1px solid #333; padding: 14px 16px; border-radius: 6px; }
    .row { display:flex; gap:16px; margin: 6px 0; font-size: 13px; }
    .row b { min-width: 170px; display:inline-block; }
    .term { margin-top: 16px; font-size: 12px; line-height: 1.5; text-align: justify; }
    .sign { margin-top: 40px; display:flex; justify-content:space-between; gap: 40px; }
    .sign div { flex:1; text-align:center; border-top:1px solid #333; padding-top:6px; font-size: 11px; }
    hr { border:none; border-top:1px dashed #999; margin: 24px 0; }
  </style></head><body>
  <div class="receipt">
    <h1>Recibo de Empréstimo de Glicosímetro</h1>
    <div class="sub">Programa Saúde da Mulher — Camocim</div>
    <div class="box">
      <div class="row"><b>Paciente:</b><span>${patientName}</span></div>
      <div class="row"><b>Cartão SUS:</b><span>${sus}</span></div>
      <div class="row"><b>PSF / UBS:</b><span>${psf}</span></div>
      <div class="row"><b>Glicosímetro (código):</b><span>${code}</span></div>
      <div class="row"><b>Marca / Modelo:</b><span>${brand}</span></div>
      <div class="row"><b>Data do empréstimo:</b><span>${fmt(loan.loaned_at)}</span></div>
      <div class="row"><b>Devolução prevista:</b><span>${fmt(loan.expected_return_date)}</span></div>
    </div>
    <p class="term">
      Declaro ter recebido, por empréstimo, o aparelho glicosímetro identificado acima,
      em perfeitas condições de uso, comprometendo-me a zelar por sua conservação e a
      devolvê-lo na data prevista. Em caso de perda, dano ou extravio, comprometo-me a
      comunicar imediatamente a unidade de saúde responsável.
    </p>
    <div class="sign">
      <div>Paciente / Responsável</div>
      <div>Profissional Responsável</div>
    </div>
  </div>
  </body></html>`;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    setTimeout(() => {
      w.focus();
      w.print();
    }, 250);
  };
}