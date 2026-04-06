import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Patient } from "@/hooks/useScheduling";

interface Props {
  onImportComplete: () => void;
}

export default function ImportExport({ onImportComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const exportExcel = async () => {
    try {
      const [patientsRes, apptsRes, daysRes] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("appointments").select("*, patients(*)").order("date"),
        supabase.from("released_days").select("*").order("date"),
      ]);

      const wb = XLSX.utils.book_new();

      // Patients sheet
      const pData = (patientsRes.data || []).map(p => ({
        Nome: p.name,
        "Cartão SUS": p.sus_card || "",
        Nascimento: p.dob || "",
        PSF: p.psf || "",
        Observações: p.observations || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pData), "Pacientes");

      // Appointments sheet
      const aData = (apptsRes.data || []).map(a => {
        const pt = a.patients as Patient | null;
        return {
          Vaga: a.slot,
          Data: a.date,
          Paciente: pt?.name || "",
          "Cartão SUS": pt?.sus_card || "",
          PSF: pt?.psf || "",
          Motivo: a.reason || "",
          Tipo: a.type,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aData), "Agendamentos");

      // Released days sheet
      const dData = (daysRes.data || []).map(d => ({ Data: d.date }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dData), "Dias Liberados");

      XLSX.writeFile(wb, `saude_mulher_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Excel exportado!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const isExcel = file.name.match(/\.(xlsx|xls)$/i);
      const isCSV = file.name.match(/\.csv$/i);

      if (isExcel) {
        await importExcelFile(file);
      } else if (isCSV) {
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

  const importExcelFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    let patientsImported = 0;
    let appointmentsImported = 0;
    let daysImported = 0;
    const patientNameToId = new Map<string, string>();

    // Load existing patients to avoid duplicates
    const { data: existingPatients } = await supabase.from("patients").select("id, name");
    for (const p of existingPatients || []) {
      patientNameToId.set(p.name.toUpperCase().trim(), p.id);
    }

    // Import Patients sheet
    const pSheet = wb.Sheets["Pacientes"] || wb.Sheets[wb.SheetNames[0]];
    if (pSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(pSheet);
      for (const row of rows) {
        const name = (row["Nome"] || row["name"] || row["NOME"] || "").toString().trim();
        if (!name) continue;

        const upperName = name.toUpperCase();
        if (patientNameToId.has(upperName)) continue;

        const patient = {
          name,
          sus_card: (row["Cartão SUS"] || row["susCard"] || row["CARTAO SUS"] || "").toString() || null,
          dob: (row["Nascimento"] || row["dob"] || row["DATA NASCIMENTO"] || "").toString() || null,
          psf: (row["PSF"] || row["psf"] || "").toString() || null,
          observations: (row["Observações"] || row["observations"] || row["OBS"] || "").toString() || null,
        };

        const { data, error } = await supabase.from("patients").insert(patient).select("id").single();
        if (data) {
          patientNameToId.set(upperName, data.id);
          patientsImported++;
        }
        if (error) console.error("Patient import error:", error);
      }
    }

    // Import Appointments sheet
    const aSheet = wb.Sheets["Agendamentos"] || wb.Sheets[wb.SheetNames[1]];
    if (aSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(aSheet);
      for (const row of rows) {
        const slot = parseInt(row["Vaga"] || row["slot"] || "0");
        const date = (row["Data"] || row["date"] || "").toString();
        const patientName = (row["Paciente"] || row["patient"] || "").toString().trim();
        if (!slot || !date || !patientName) continue;

        const patientId = patientNameToId.get(patientName.toUpperCase());
        if (!patientId) continue;

        // Ensure released day exists
        await supabase.from("released_days").upsert({ date }, { onConflict: "date" });

        const { error } = await supabase.from("appointments").insert({
          slot,
          date,
          patient_id: patientId,
          reason: (row["Motivo"] || row["reason"] || "").toString() || null,
          type: (row["Tipo"] || row["type"] || "NORMAL").toString(),
        });
        if (!error) appointmentsImported++;
      }
    }

    // Import Released Days sheet
    const dSheet = wb.Sheets["Dias Liberados"] || wb.Sheets[wb.SheetNames[2]];
    if (dSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(dSheet);
      for (const row of rows) {
        const date = (row["Data"] || row["date"] || "").toString();
        if (!date) continue;
        const { error } = await supabase.from("released_days").upsert({ date }, { onConflict: "date" });
        if (!error) daysImported++;
      }
    }

    toast.success(`Importado: ${patientsImported} pacientes, ${appointmentsImported} agendamentos, ${daysImported} dias`);
    onImportComplete();
  };

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

    toast.success(`Importado: ${days.length} dias, ${patients.length} pacientes, ${appointments.length} agendamentos`);
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
