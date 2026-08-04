import type { ImplanonRecord } from "@/hooks/useImplanon";
import { toast } from "sonner";

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

/** Returns removal urgency class name for PDF styling */
function removalClass(record: ImplanonRecord): string {
  if (record.status !== "applied") return "";
  const d = daysUntil(record.expected_removal_at);
  if (d === null) return "";
  if (d < 0) return "overdue";
  if (d <= 90) return "soon";
  return "";
}

/** Human-readable days remaining label */
function removalLabel(record: ImplanonRecord): string {
  if (record.status === "removed") return "Retirado";
  const d = daysUntil(record.expected_removal_at);
  if (d === null) return "—";
  if (d < 0) return `Vencido há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? "s" : ""}`;
  if (d === 0) return "Hoje";
  return `${d} dia${d !== 1 ? "s" : ""}`;
}

const STATUS_LABEL: Record<string, string> = {
  released: "Liberado",
  applied: "Aplicado",
  removed: "Retirado",
};

const esc = (v: unknown) =>
  String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

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
        (r, i) => {
          const rc = removalClass(r);
          const rl = removalLabel(r);
          const d  = daysUntil(r.expected_removal_at);
          return `
      <tr class="${rc}">
        <td class="c">${i + 1}</td>
        <td><b>${esc(r.patient?.name)}</b></td>
        <td>${esc(r.patient?.cpf)}</td>
        <td>${esc(r.patient?.phone)}</td>
        <td class="c">${fmt(r.released_at)}</td>
        <td class="c">${fmt(r.applied_at)}</td>
        <td class="c">${fmt(r.expected_removal_at)}</td>
        <td class="c days ${rc}">
          ${r.status === "applied" && d !== null
            ? `<span class="pill ${rc}">${rl}</span>`
            : `<span class="pill neutral">${rl}</span>`}
        </td>
        <td class="c"><span class="st ${r.status}">${STATUS_LABEL[r.status] ?? r.status}</span></td>
        <td>${esc(r.notes)}</td>
      </tr>`;
        },
      )
      .join("");

  const body = ordered
    .map(
      ([unit, list]) => {
        /* count alerts for unit summary */
        const overdueCount = list.filter(r => {
          if (r.status !== "applied") return false;
          const d = daysUntil(r.expected_removal_at);
          return d !== null && d < 0;
        }).length;
        const soonCount = list.filter(r => {
          if (r.status !== "applied") return false;
          const d = daysUntil(r.expected_removal_at);
          return d !== null && d >= 0 && d <= 90;
        }).length;

        const alerts = [
          overdueCount > 0 ? `<span class="alert-chip overdue-chip">${overdueCount} vencida${overdueCount > 1 ? "s" : ""}</span>` : "",
          soonCount > 0    ? `<span class="alert-chip soon-chip">${soonCount} próxima${soonCount > 1 ? "s" : ""}</span>` : "",
        ].join("");

        return `
    <section class="grp">
      <h2>${esc(unit)} <span>${list.length} registro(s)</span>${alerts}</h2>
      <table>
        <thead>
          <tr>
            <th class="c" style="width:24px">Nº</th>
            <th>Paciente</th>
            <th style="width:90px">CPF</th>
            <th style="width:84px">Contato</th>
            <th class="c" style="width:60px">Liberação</th>
            <th class="c" style="width:60px">Aplicação</th>
            <th class="c" style="width:66px">Prev. retirada</th>
            <th class="c" style="width:74px">Dias restantes</th>
            <th class="c" style="width:58px">Situação</th>
            <th>Indicação</th>
          </tr>
        </thead>
        <tbody>${rows(list)}</tbody>
      </table>
    </section>`;
      },
    )
    .join("");

  const now = new Date();
  const generated = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  /* tally totals for summary bar */
  const totalOverdue = records.filter(r => { const d = daysUntil(r.expected_removal_at); return r.status === "applied" && d !== null && d < 0; }).length;
  const totalSoon    = records.filter(r => { const d = daysUntil(r.expected_removal_at); return r.status === "applied" && d !== null && d >= 0 && d <= 90; }).length;
  const totalApplied = records.filter(r => r.status === "applied").length;
  const totalRemoved = records.filter(r => r.status === "removed").length;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório Implanon</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 landscape;margin:10mm;}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2430;font-size:9.5px;}
  header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #0d4a7a;padding-bottom:10px;margin-bottom:10px;}
  header img{height:48px;}
  header .t{flex:1;text-align:right;}
  header h1{font-size:15px;letter-spacing:.5px;color:#0d4a7a;font-weight:900;}
  header p{font-size:9px;color:#555;margin-top:2px;}

  .chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;}
  .chips span{font-size:8.5px;border:1px solid #cbd5e1;background:#f1f5f9;border-radius:99px;padding:2px 7px;color:#334155;}

  /* summary bar */
  .summary{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
  .sum-card{padding:5px 10px;border-radius:6px;border:1px solid;font-size:8.5px;font-weight:bold;text-align:center;}
  .sum-card span{display:block;font-size:15px;font-weight:900;}
  .sum-applied{background:#ecfdf5;border-color:#a7f3d0;color:#065f46;}
  .sum-soon{background:#fffbeb;border-color:#fcd34d;color:#78350f;}
  .sum-overdue{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d;}
  .sum-removed{background:#f8fafc;border-color:#cbd5e1;color:#475569;}

  .grp{margin-bottom:14px;page-break-inside:avoid;}
  .grp h2{font-size:10px;text-transform:uppercase;letter-spacing:.6px;background:#0d4a7a;color:#fff;padding:5px 8px;border-radius:4px 4px 0 0;display:flex;align-items:center;gap:8px;}
  .grp h2 span{font-weight:normal;opacity:.85;flex:1;}
  .alert-chip{font-size:7.5px;padding:2px 6px;border-radius:99px;font-weight:bold;}
  .overdue-chip{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;}
  .soon-chip{background:#fef3c7;color:#92400e;border:1px solid #fcd34d;}

  table{width:100%;border-collapse:collapse;}
  th{background:#eef3f8;border:1px solid #cdd8e3;padding:3px 5px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.3px;}
  td{border:1px solid #dbe3ec;padding:3px 5px;vertical-align:middle;}
  tbody tr:nth-child(even){background:#fafcfe;}
  /* urgency row highlights */
  tbody tr.overdue td{background:#fff5f5;}
  tbody tr.soon td{background:#fffdf0;}
  .c{text-align:center;}

  .pill{display:inline-block;padding:1px 6px;border-radius:99px;font-size:8px;font-weight:bold;border:1px solid;}
  .pill.overdue{background:#fee2e2;color:#991b1b;border-color:#fca5a5;}
  .pill.soon{background:#fef3c7;color:#92400e;border-color:#fcd34d;}
  .pill.neutral{background:#f1f5f9;color:#475569;border-color:#cbd5e1;}

  .st{display:inline-block;padding:1px 6px;border-radius:99px;font-size:8px;font-weight:bold;border:1px solid;}
  .st.released{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}
  .st.applied{background:#ecfdf5;color:#047857;border-color:#a7f3d0;}
  .st.removed{background:#f1f5f9;color:#475569;border-color:#cbd5e1;}

  footer{margin-top:10px;border-top:1px solid #ddd;padding-top:5px;font-size:8px;color:#666;display:flex;justify-content:space-between;}
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

  <!-- summary bar -->
  <div class="summary">
    <div class="sum-card sum-applied"><span>${totalApplied}</span>Aplicados</div>
    <div class="sum-card sum-soon"><span>${totalSoon}</span>Retirada próx.</div>
    <div class="sum-card sum-overdue"><span>${totalOverdue}</span>Retirada vencida</div>
    <div class="sum-card sum-removed"><span>${totalRemoved}</span>Retirados</div>
  </div>

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