import type { ImplanonRecord } from "@/hooks/useImplanon";
import { toast } from "sonner";

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  released: "Liberado",
  applied: "Aplicado",
  removed: "Retirado",
};

const esc = (v: unknown) =>
  String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

const fmtCpf = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 11) return v ? String(v) : "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export function printImplanonReport(
  records: ImplanonRecord[],
  filters: { unit?: string; status?: string; search?: string } = {},
) {
  if (!records.length) {
    toast("Nenhum registro para exportar.");
    return;
  }

  const groups = new Map<string, ImplanonRecord[]>();
  for (const r of records) {
    const key = r.patient?.psf?.trim() || "Sem unidade definida";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));

  const chips = [
    filters.unit && filters.unit !== "all" ? `Unidade: ${filters.unit}` : "Unidade: todas",
    filters.status && filters.status !== "all"
      ? `Situação: ${STATUS_LABEL[filters.status] ?? filters.status}`
      : "Situação: todas",
    filters.search ? `Busca: "${filters.search}"` : null,
  ].filter(Boolean) as string[];

  const rows = (list: ImplanonRecord[]) =>
    list
      .map(
        (r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td><b>${esc(r.patient?.name)}</b></td>
        <td>${esc(fmtCpf(r.patient?.cpf))}</td>
        <td>${esc(r.patient?.phone)}</td>
        <td class="c">${fmt(r.released_at)}</td>
        <td class="c">${fmt(r.applied_at)}</td>
        <td class="c">${fmt(r.expected_removal_at)}</td>
        <td class="c"><span class="st ${r.status}">${STATUS_LABEL[r.status] ?? r.status}</span></td>
        <td>${esc(r.notes)}</td>
      </tr>`,
      )
      .join("");

  const body = ordered
    .map(
      ([unit, list]) => `
    <section class="grp">
      <h2>${esc(unit)} <span>${list.length} registro(s)</span></h2>
      <table>
        <thead>
          <tr>
            <th class="c" style="width:26px">Nº</th>
            <th>Paciente</th>
            <th style="width:96px">CPF</th>
            <th style="width:88px">Contato</th>
            <th class="c" style="width:66px">Liberação</th>
            <th class="c" style="width:66px">Aplicação</th>
            <th class="c" style="width:70px">Prev. retirada</th>
            <th class="c" style="width:62px">Situação</th>
            <th>Indicação</th>
          </tr>
        </thead>
        <tbody>${rows(list)}</tbody>
      </table>
    </section>`,
    )
    .join("");

  const now = new Date();
  const generated = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório Implanon</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 landscape;margin:10mm;}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2430;}
  header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #0d4a7a;padding-bottom:10px;margin-bottom:12px;}
  header img{height:52px;}
  header .t{flex:1;text-align:right;}
  header h1{font-size:16px;letter-spacing:.5px;}
  header p{font-size:10px;color:#555;margin-top:2px;}
  .chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
  .chips span{font-size:9px;border:1px solid #cbd5e1;background:#f1f5f9;border-radius:99px;padding:3px 8px;color:#334155;}
  .grp{margin-bottom:16px;page-break-inside:avoid;}
  .grp h2{font-size:11px;text-transform:uppercase;letter-spacing:.6px;background:#0d4a7a;color:#fff;padding:5px 8px;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;}
  .grp h2 span{font-weight:normal;opacity:.85;}
  table{width:100%;border-collapse:collapse;font-size:9.5px;}
  th{background:#eef3f8;border:1px solid #cdd8e3;padding:4px 5px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.3px;}
  td{border:1px solid #dbe3ec;padding:4px 5px;vertical-align:top;}
  tbody tr:nth-child(even){background:#fafcfe;}
  .c{text-align:center;}
  .st{display:inline-block;padding:1px 6px;border-radius:99px;font-size:8.5px;font-weight:bold;border:1px solid;}
  .st.released{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}
  .st.pending{background:#fff7ed;color:#b45309;border-color:#fed7aa;}
  .st.applied{background:#ecfdf5;color:#047857;border-color:#a7f3d0;}
  .st.removed{background:#f1f5f9;color:#475569;border-color:#cbd5e1;}
  footer{margin-top:10px;border-top:1px solid #ddd;padding-top:6px;font-size:8.5px;color:#666;display:flex;justify-content:space-between;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head>
<body>
  <header>
    <img src="/logo-saude-horizontal.png" alt="Prefeitura de Camocim — Secretaria Municipal da Saúde" />
    <div class="t">
      <h1>RELATÓRIO DE IMPLANON</h1>
      <p>Saúde da Mulher · Liberação, aplicação e retirada</p>
      <p>Emitido em ${generated} · ${records.length} registro(s)</p>
    </div>
  </header>
  <div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>
  ${body}
  <footer><span>Secretaria Municipal da Saúde de Camocim</span><span>Documento gerado pelo sistema Saúde da Mulher</span></footer>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Popup bloqueado. Permita popups para exportar o PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();

  const img = w.document.querySelector("img");
  const doPrint = () => setTimeout(() => { w.focus(); w.print(); }, 300);
  if (img && !img.complete) {
    img.onload = doPrint;
    img.onerror = doPrint;
  } else {
    doPrint();
  }
}
/* ── Ficha individual (1 registro por folha A4) ────────────────────── */
export function printImplanonRecord(r: ImplanonRecord) {
  const row = (label: string, value: string) =>
    `<div class="f"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

  const now = new Date();
  const generated = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Ficha Implanon — ${esc(r.patient?.name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:14mm;}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2430;font-size:11px;}
  header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #0d4a7a;padding-bottom:10px;margin-bottom:14px;}
  header img{height:56px;}
  header .t{flex:1;text-align:right;}
  header h1{font-size:16px;letter-spacing:.5px;}
  header p{font-size:10px;color:#555;margin-top:2px;}
  h2{font-size:10px;text-transform:uppercase;letter-spacing:.6px;background:#0d4a7a;color:#fff;padding:5px 8px;border-radius:4px;margin:14px 0 8px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;}
  .f{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dotted #cbd5e1;padding:4px 2px;}
  .f span{color:#64748b;}
  .box{border:1px solid #dbe3ec;border-radius:6px;padding:8px 10px;background:#fafcfe;min-height:38px;}
  .sign{display:flex;gap:40px;margin-top:46px;}
  .sign div{flex:1;border-top:1px solid #64748b;text-align:center;padding-top:4px;font-size:9.5px;color:#475569;}
  footer{margin-top:24px;border-top:1px solid #ddd;padding-top:6px;font-size:8.5px;color:#666;display:flex;justify-content:space-between;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head>
<body>
  <header>
    <img src="/logo-saude-horizontal.png" alt="Secretaria Municipal da Saúde" />
    <div class="t">
      <h1>FICHA DE IMPLANON</h1>
      <p>Saúde da Mulher · Liberação, aplicação e retirada</p>
      <p>Emitida em ${generated}</p>
    </div>
  </header>

  <h2>Identificação da paciente</h2>
  <div class="grid">
    ${row("Nome", String(r.patient?.name ?? "—"))}
    ${row("CPF", fmtCpf(r.patient?.cpf))}
    ${row("Cartão SUS", String(r.patient?.sus_card ?? "—"))}
    ${row("Contato", String(r.patient?.phone ?? "—"))}
    ${row("Unidade de saúde", String(r.patient?.psf ?? "—"))}
    ${row("Endereço", [r.patient?.address, r.patient?.neighborhood].filter(Boolean).join(", ") || "—")}
  </div>

  <h2>Dados do implante</h2>
  <div class="grid">
    ${row("Situação", STATUS_LABEL[r.status] ?? r.status)}
    ${row("Data de liberação", fmt(r.released_at))}
    ${row("Data de aplicação", fmt(r.applied_at))}
    ${row("Lote", String(r.lot ?? "—"))}
    ${row("Validade do lote", fmt(r.lot_expiry))}
    ${row("Previsão de retirada", fmt(r.expected_removal_at))}
    ${row("Data de retirada", fmt(r.removed_at))}
    ${row("Local de aplicação", String(r.application_site ?? "—"))}
    ${row("DUM", fmt(r.dum))}
    ${row("Profissional responsável", String(r.professional ?? "—"))}
  </div>

  <h2>Indicação / Observações</h2>
  <div class="box">${esc(r.notes)}</div>

  <div class="sign">
    <div>Assinatura da paciente</div>
    <div>Assinatura do profissional</div>
  </div>

  <footer><span>Secretaria Municipal da Saúde de Camocim</span><span>Documento gerado pelo sistema Saúde da Mulher</span></footer>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Popup bloqueado. Permita popups para imprimir.");
    return;
  }
  w.document.write(html);
  w.document.close();
  const img = w.document.querySelector("img");
  const doPrint = () => setTimeout(() => { w.focus(); w.print(); }, 300);
  if (img && !img.complete) { img.onload = doPrint; img.onerror = doPrint; }
  else doPrint();
}
