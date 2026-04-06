import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Patient } from "@/hooks/useScheduling";

interface Props {
  onImportComplete: () => void;
}

export default function ImportExport({ onImportComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

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
    } catch { toast.error("Erro ao exportar"); }
  };

  const exportExcel = async () => {
    try {
      const [patientsRes, apptsRes] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("appointments").select("*, patients(*)").order("date"),
      ]);

      let tsv = "Nome\tCartão SUS\tNascimento\tPSF\tObservações\n";
      for (const p of patientsRes.data || []) {
        tsv += `${p.name}\t${p.sus_card || ""}\t${p.dob || ""}\t${p.psf || ""}\t${p.observations || ""}\n`;
      }
      tsv += "\n\nAGENDAMENTOS\n";
      tsv += "Vaga\tData\tPaciente\tPSF\tMotivo\tTipo\n";
      for (const a of apptsRes.data || []) {
        const pt = a.patients as Patient | null;
        tsv += `${a.slot}\t${a.date}\t${pt?.name || ""}\t${pt?.psf || ""}\t${a.reason || ""}\t${a.type}\n`;
      }

      const blob = new Blob(["\ufeff" + tsv], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saude_mulher_${new Date().toISOString().split("T")[0]}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exportado!");
    } catch { toast.error("Erro ao exportar"); }
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("Importação de Excel em processamento...");
    // Same as CSV import for now
    await importFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importFile(file);
    if (csvRef.current) csvRef.current.value = "";
  };

  const importFile = async (file: File) => {
    try {
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
        const { error } = await supabase.from("released_days").upsert(
          days.map(d => ({ date: d })),
          { onConflict: "date" }
        );
        if (error) console.error("Days error:", error);
      }

      for (const p of patients) {
        const { data, error } = await supabase.from("patients").insert(p).select().single();
        if (data) patientIdMap.set(p.legacy_id, data.id);
        if (error) console.error("Patient error:", error);
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
    } catch (err) {
      toast.error("Erro ao importar arquivo");
      console.error(err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" onChange={importExcel} className="hidden" />
      <input ref={csvRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
      
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="w-4 h-4 mr-1" /> Importar Excel
      </Button>
      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={exportExcel}>
        <FileSpreadsheet className="w-4 h-4 mr-1" /> Exportar Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download className="w-4 h-4 mr-1" /> Backup
      </Button>
      <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
        <Upload className="w-4 h-4 mr-1" /> Importar
      </Button>
    </div>
  );
}
