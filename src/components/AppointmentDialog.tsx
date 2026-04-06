import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Patient } from "@/hooks/useScheduling";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  slot: number;
  date: string;
  patients: Patient[];
  variant: "morning" | "afternoon";
  onAdd: (slot: number, date: string, patientId: string, reason: string, type: string) => Promise<boolean>;
  onPatientsChanged: () => void;
}

export default function AppointmentDialog({ open, onClose, slot, date, patients, variant, onAdd, onPatientsChanged }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [name, setName] = useState("");
  const [susCard, setSusCard] = useState("");
  const [dob, setDob] = useState("");
  const [psf, setPsf] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("NORMAL");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const variantLabel = variant === "morning" ? "Manhã — Zona Rural" : "Tarde — Cidade";

  const filtered = useMemo(() => {
    if (!search) return [];
    const s = search.toUpperCase();
    return patients.filter(p => p.name.toUpperCase().includes(s) || p.sus_card?.includes(s)).slice(0, 20);
  }, [patients, search]);

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setName(p.name);
    setSusCard(p.sus_card || "");
    setDob(p.dob || "");
    setPsf(p.psf || "");
    setSearch(p.name);
    setShowResults(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);

    let patientId = selectedPatient?.id;

    // If no patient selected or name changed, create new patient
    if (!patientId || name.trim().toUpperCase() !== selectedPatient?.name.toUpperCase()) {
      const { data, error } = await supabase.from("patients").insert({
        name: name.trim().toUpperCase(),
        sus_card: susCard || null,
        dob: dob || null,
        psf: psf || null,
      }).select("id").single();

      if (error) {
        setLoading(false);
        return;
      }
      patientId = data.id;
      onPatientsChanged();
    } else {
      // Update existing patient info if changed
      const updates: Partial<Patient> = {};
      if (susCard !== (selectedPatient.sus_card || "")) updates.sus_card = susCard || null;
      if (dob !== (selectedPatient.dob || "")) updates.dob = dob || null;
      if (psf !== (selectedPatient.psf || "")) updates.psf = psf || null;
      if (Object.keys(updates).length > 0) {
        await supabase.from("patients").update(updates).eq("id", patientId);
        onPatientsChanged();
      }
    }

    const ok = await onAdd(slot, date, patientId!, reason, type);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vaga {String(slot).padStart(2, "0")} — {variantLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Nome do Paciente */}
          <div className="space-y-1.5 relative">
            <Label>Nome do Paciente</Label>
            <Input
              placeholder="Pesquisar ou digitar nome..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setName(e.target.value);
                setShowResults(true);
                if (!e.target.value) setSelectedPatient(null);
              }}
              onFocus={() => search && setShowResults(true)}
            />
            {showResults && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-40 overflow-auto">
                {filtered.map(p => (
                  <div
                    key={p.id}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => selectPatient(p)}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.psf && <span className="ml-2 text-xs text-muted-foreground">({p.psf})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cartão SUS + Data Nascimento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cartão SUS</Label>
              <Input placeholder="Nº do cartão" value={susCard} onChange={e => setSusCard(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Nascimento</Label>
              <Input placeholder="DD/MM/AAAA" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
          </div>

          {/* PSF / UBS */}
          <div className="space-y-1.5">
            <Label>PSF / UBS</Label>
            <Input placeholder="Nome do PSF" value={psf} onChange={e => setPsf(e.target.value)} />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label>Motivo / Observação</Label>
            <Input placeholder="Motivo da consulta" value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {/* Tipo: Normal / Retorno */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={type === "NORMAL" ? "default" : "outline"}
              onClick={() => setType("NORMAL")}
              className="w-full"
            >
              Normal
            </Button>
            <Button
              type="button"
              variant={type === "RETORNO" ? "default" : "outline"}
              onClick={() => setType("RETORNO")}
              className="w-full"
            >
              Retorno
            </Button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim() || loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
