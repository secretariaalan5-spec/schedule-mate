import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Patient } from "@/hooks/useScheduling";
import { format, parseISO, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  onImportComplete: () => void;
}

/* ── helpers ── */

function parseSheetDate(raw: string): string | null {
  // Extract date from "DATA: 21/08/24-", "DATA 25/03/2026 -", etc.
  const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  return `${year}-${month}-${day}`;
}

function isMorningSheet(raw: string, sheetName: string): boolean {
  const timeMatch = raw.match(/HOR[ÁA]RIO[:\s]*(\d{1,2})/i);
  if (timeMatch) return parseInt(timeMatch[1]) < 12;
  const upper = sheetName.toUpperCase().trim();
  if (upper.endsWith("M")) return true;
  if (upper.endsWith("T")) return false;
  return true;
}

function parseDob(val: any): string | null {
  if (!val) return null;
  // Handle JS Date objects (from XLSX cellDates)
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
    }
    return null;
  }
  // Handle ISO strings with T
  if (typeof val === "string" && val.includes("T")) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
    } catch { /* fall through */ }
  }
  const s = String(val).trim();
  // Try dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (2 or 4 digit year)
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // Handle Excel serial number
  if (typeof val === "number" && val > 10000 && val < 100000) {
    const d = new Date((val - 25569) * 86400000);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return null;
}

function findHeaderRow(ws: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= Math.min(range.e.r, 15); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && String(cell.v || "").toUpperCase().includes("NOME")) return r;
    }
  }
  return -1;
}

function findDateRow(ws: XLSX.WorkSheet): string {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= Math.min(range.e.r, 15); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const val = String(cell?.v || "");
      if (val.toUpperCase().includes("DATA") && val.match(/\d{1,2}[\/\-.](\d{1,2})[\/\-.]\d{2,4}/)) return val;
    }
  }
  return "";
}

/* ── component ── */

export default function ImportExport({ onImportComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  /* ═══════ EXPORT EXCEL ═══════ */
  const exportExcel = async () => {
    try {
      const [patientsRes, apptsRes, daysRes] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("appointments").select("*, patients(*)").order("date").order("slot"),
        supabase.from("released_days").select("*").order("date"),
      ]);

      const wb = XLSX.utils.book_new();

      // Group appointments by date
      const apptsByDate = new Map<string, any[]>();
      for (const a of apptsRes.data || []) {
        const key = a.date;
        if (!apptsByDate.has(key)) apptsByDate.set(key, []);
        apptsByDate.get(key)!.push(a);
      }

      // Create a sheet per date (like the original format)
      for (const [date, appts] of apptsByDate) {
        const morning = appts.filter((a: any) => a.slot <= 15).sort((a: any, b: any) => a.slot - b.slot);
        const afternoon = appts.filter((a: any) => a.slot > 15).sort((a: any, b: any) => a.slot - b.slot);

        const dateFormatted = format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });

        for (const [label, group, time] of [
          ["M", morning, "07:30 h"],
          ["T", afternoon, "14:00 h"],
        ] as [string, any[], string][]) {
          if (group.length === 0) continue;
          const dayPart = format(parseISO(date), "dd_MM");
          const sheetName = `${dayPart} ${label}`.substring(0, 31);

          const rows: any[][] = [
            ["LISTA DOS PACIENTES PARA O ATENDIMENTO"],
            [`DATA: ${dateFormatted}-  HORÁRIO: ${time}`],
            ["HORÁRIO CHEGADA", "Nº", "NOME", "CARTÃO DO SUS", "DATA DE NASCIMENTO", "PSF", "MOTIVO"],
          ];

          for (const a of group) {
            const pt = a.patients as Patient | null;
            rows.push([
              time.replace(" h", ""),
              String(a.slot <= 15 ? a.slot : a.slot - 15),
              pt?.name || "",
              pt?.sus_card || "",
              pt?.dob ? format(parseISO(pt.dob), "dd/MM/yyyy") : "",
              pt?.psf || "",
              a.reason || "",
            ]);
          }

          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws["!cols"] = [{ wch: 16 }, { wch: 4 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      }

      // Patients master sheet
      const pData = (patientsRes.data || []).map((p, i) => ({
        "Nº": i + 1,
        "Nome": p.name,
        "Cartão SUS": p.sus_card || "",
        "Data Nascimento": p.dob ? format(parseISO(p.dob), "dd/MM/yyyy") : "",
        "PSF / UBS": p.psf || "",
        "Observações": p.observations || "",
      }));
      const pSheet = XLSX.utils.json_to_sheet(pData);
      pSheet["!cols"] = [{ wch: 5 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, pSheet, "Pacientes");

      // Summary
      const summaryData = [
        { "Informação": "Total de Pacientes", "Valor": patientsRes.data?.length || 0 },
        { "Informação": "Total de Consultas", "Valor": apptsRes.data?.length || 0 },
        { "Informação": "Dias Liberados", "Valor": daysRes.data?.length || 0 },
        { "Informação": "Exportado em", "Valor": format(new Date(), "dd/MM/yyyy HH:mm") },
      ];
      const sSheet = XLSX.utils.json_to_sheet(summaryData);
      sSheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, sSheet, "Resumo");

      XLSX.writeFile(wb, `saude_mulher_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  /* ═══════ EXPORT CSV BACKUP ═══════ */
  const exportCSV = async () => {
    try {
      const [daysRes, patientsRes, apptsRes] = await Promise.all([
        supabase.from("released_days").select("*").order("date"),
        supabase.from("patients").select("*").order("name"),
        supabase.from("appointments").select("*, patients(*)").order("date"),
      ]);

      let csv = "### DIAS LIBERADOS ###\n";
      csv += (daysRes.data || []).map(d => d.date).join(";") + "\n";
      csv += "### PACIENTES ###\n";
      csv += "id;name;susCard;dob;psf;observations\n";
      for (const p of patientsRes.data || []) {
        csv += `${p.id};${p.name};${p.sus_card || ""};${p.dob || ""};${p.psf || ""};${p.observations || ""}\n`;
      }
      csv += "### AGENDAMENTOS ###\n";
      csv += "slot;date;patientId;patientName;susCard;dob;psf;reason;type\n";
      for (const a of apptsRes.data || []) {
        const pt = a.patients as Patient | null;
        csv += `${a.slot};${a.date};${a.patient_id};${pt?.name || ""};${pt?.sus_card || ""};${pt?.dob || ""};${pt?.psf || ""};${a.reason || ""};${a.type}\n`;
      }

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_saude_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup CSV exportado!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  /* ═══════ IMPORT ═══════ */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      if (file.name.match(/\.(xlsx|xls)$/i)) {
        await importExcelFile(file);
      } else if (file.name.match(/\.csv$/i)) {
        await importCSVFile(file);
      } else {
        toast.error("Formato não suportado. Use .xlsx, .xls ou .csv");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar arquivo");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ── Import Excel (multi-sheet per day format) ── */
  const importExcelFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });

    // Build existing patients map
    const patientNameToId = new Map<string, string>();
    const { data: existingPatients } = await supabase.from("patients").select("id, name");
    for (const p of existingPatients || []) {
      patientNameToId.set(p.name.toUpperCase().trim(), p.id);
    }

    let patientsImported = 0;
    let appointmentsImported = 0;
    let daysImported = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws || !ws["!ref"]) continue;

      // Try to find date from DATA: row
      const dateRowText = findDateRow(ws);
      const date = parseSheetDate(dateRowText);

      // If this is a "Pacientes" or "Resumo" sheet (from our export), handle separately
      if (sheetName === "Pacientes") {
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        for (const row of rows) {
          const name = (row["Nome"] || row["name"] || row["NOME"] || "").toString().trim();
          if (!name) continue;
          if (patientNameToId.has(name.toUpperCase())) continue;

          const { data, error } = await supabase.from("patients").insert({
            name,
            sus_card: (row["Cartão SUS"] || row["CARTÃO DO SUS"] || "").toString() || null,
            dob: parseDob(row["Data Nascimento"] || row["DATA DE NASCIMENTO"]),
            psf: (row["PSF / UBS"] || row["PSF"] || "").toString() || null,
            observations: (row["Observações"] || "").toString() || null,
          }).select("id").single();
          if (data) { patientNameToId.set(name.toUpperCase(), data.id); patientsImported++; }
          if (error) console.error("Patient import error:", error);
        }
        continue;
      }

      if (sheetName === "Resumo" || sheetName === "Dias Liberados") continue;

      if (!date) {
        console.warn(`Sheet "${sheetName}": could not parse date`);
        continue;
      }

      // Release the day
      const { error: dayErr } = await supabase.from("released_days").upsert({ date }, { onConflict: "date" });
      if (!dayErr) daysImported++;

      const isMorning = isMorningSheet(dateRowText, sheetName);
      const headerRow = findHeaderRow(ws);
      if (headerRow < 0) continue;

      const range = XLSX.utils.decode_range(ws["!ref"]);

      // Find column indices
      let colName = -1, colSus = -1, colDob = -1, colPsf = -1, colMotivo = -1, colNum = -1;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
        const val = String(cell?.v || "").toUpperCase().trim();
        if (val.includes("NOME")) colName = c;
        else if (val.includes("CART") || val.includes("SUS")) colSus = c;
        else if (val.includes("NASC")) colDob = c;
        else if (val.includes("PSF")) colPsf = c;
        else if (val.includes("MOTIVO")) colMotivo = c;
        else if (val === "Nº" || val === "N°" || val === "NO" || val === "NR") colNum = c;
      }

      if (colName < 0) continue;

      for (let r = headerRow + 1; r <= range.e.r; r++) {
        const nameCell = ws[XLSX.utils.encode_cell({ r, c: colName })];
        const name = String(nameCell?.v || "").trim();
        if (!name) continue;

        // Skip metadata rows (headers imported as patient names)
        const nameUpper = name.toUpperCase();
        if (
          nameUpper.includes("LOCAL DE REALIZA") ||
          nameUpper.includes("ESPECIALIDADE") ||
          nameUpper.includes("PROFISSIONAL") ||
          nameUpper.includes("HOSPITAL") ||
          nameUpper.includes("HORÁRIO") ||
          nameUpper.includes("HORARIO") ||
          nameUpper.includes("DATA:") ||
          nameUpper.includes("LISTA DOS PACIENTES") ||
          nameUpper.includes("HORÁRIO CHEGADA")
        ) continue;

        const susCell = colSus >= 0 ? ws[XLSX.utils.encode_cell({ r, c: colSus })] : null;
        const dobCell = colDob >= 0 ? ws[XLSX.utils.encode_cell({ r, c: colDob })] : null;
        const psfCell = colPsf >= 0 ? ws[XLSX.utils.encode_cell({ r, c: colPsf })] : null;
        const motivoCell = colMotivo >= 0 ? ws[XLSX.utils.encode_cell({ r, c: colMotivo })] : null;
        const numCell = colNum >= 0 ? ws[XLSX.utils.encode_cell({ r, c: colNum })] : null;

        const susRaw = susCell?.v;
        const susCard = susRaw != null ? String(susRaw).trim() : null;
        const dob = parseDob(dobCell?.v);
        const psf = String(psfCell?.v || "").trim() || null;
        const reason = String(motivoCell?.v || "").trim() || null;
        const slotNum = numCell ? parseInt(String(numCell.v)) : (r - headerRow);

        // Upsert patient
        let patientId = patientNameToId.get(name.toUpperCase());
        if (!patientId) {
          const { data } = await supabase.from("patients").insert({
            name, sus_card: susCard, dob, psf,
          }).select("id").single();
          if (data) {
            patientId = data.id;
            patientNameToId.set(name.toUpperCase(), data.id);
            patientsImported++;
          }
        }

        if (!patientId) continue;

        // Calculate slot: morning 1-15, afternoon 16-30
        const slot = isMorning ? slotNum : slotNum + 15;

        const { error } = await supabase.from("appointments").insert({
          slot, date, patient_id: patientId, reason, type: "NORMAL",
        });
        if (!error) appointmentsImported++;
      }
    }

    toast.success(`Importado: ${patientsImported} pacientes, ${appointmentsImported} consultas, ${daysImported} dias`);
    onImportComplete();
  };

  /* ── Import CSV ── */
  const importCSVFile = async (file: File) => {
    const text = await file.text();
    const lines = text.replace(/^\ufeff/, "").split("\n");

    let section = "";
    const days: string[] = [];
    const patients: any[] = [];
    const appointments: any[] = [];
    const patientIdMap = new Map<string, string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("### DIAS LIBERADOS")) { section = "days"; continue; }
      if (trimmed.startsWith("### PACIENTES")) { section = "patients"; continue; }
      if (trimmed.startsWith("### AGENDAMENTOS")) { section = "appointments"; continue; }
      if (!trimmed) continue;

      if (section === "days") {
        days.push(...trimmed.split(";").filter(Boolean));
      } else if (section === "patients") {
        if (trimmed.startsWith("id;")) continue;
        const [id, name, susCard, dob, psf, observations] = trimmed.split(";");
        if (name) patients.push({ legacy_id: id, name, sus_card: susCard || null, dob: dob || null, psf: psf || null, observations: observations || null });
      } else if (section === "appointments") {
        if (trimmed.startsWith("slot;")) continue;
        const parts = trimmed.split(";");
        appointments.push({ slot: parseInt(parts[0]), date: parts[1], legacyPatientId: parts[2], reason: parts[7] || null, type: parts[8] || "NORMAL" });
      }
    }

    if (days.length > 0) {
      await supabase.from("released_days").upsert(days.map(d => ({ date: d })), { onConflict: "date" });
    }

    for (const p of patients) {
      const { data } = await supabase.from("patients").insert(p).select().single();
      if (data) patientIdMap.set(p.legacy_id, data.id);
    }

    for (const a of appointments) {
      const patientId = patientIdMap.get(a.legacyPatientId);
      if (!patientId) continue;
      await supabase.from("appointments").insert({
        slot: a.slot, date: a.date, patient_id: patientId, reason: a.reason, type: a.type,
      });
    }

    toast.success(`Importado: ${days.length} dias, ${patients.length} pacientes, ${appointments.length} consultas`);
    onImportComplete();
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleImport} className="hidden" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="text-primary-foreground hover:bg-primary-foreground/10"
      >
        {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
        {importing ? "Importando..." : "Importar"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportExcel}
        className="text-primary-foreground hover:bg-primary-foreground/10"
      >
        <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportCSV}
        className="text-primary-foreground hover:bg-primary-foreground/10"
      >
        <Download className="w-4 h-4 mr-1" /> Backup
      </Button>
    </div>
  );
}
