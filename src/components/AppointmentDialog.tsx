import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import type { Patient } from "@/hooks/useScheduling";

interface Props {
  open: boolean;
  onClose: () => void;
  slot: number;
  date: string;
  patients: Patient[];
  onAdd: (slot: number, date: string, patientId: string, reason: string, type: string) => Promise<boolean>;
}

export default function AppointmentDialog({ open, onClose, slot, date, patients, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return patients.slice(0, 50);
    const s = search.toUpperCase();
    return patients.filter(p => p.name.toUpperCase().includes(s) || p.sus_card?.includes(s));
  }, [patients, search]);

  const handleAdd = async () => {
    if (!selectedPatient) return;
    setLoading(true);
    const ok = await onAdd(slot, date, selectedPatient, reason, "NORMAL");
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar Vaga #{slot}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar paciente por nome ou cartão SUS..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <ScrollArea className="h-48 border rounded-md">
            <div className="p-1">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className={`px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
                    selectedPatient === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedPatient(p.id)}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.psf && <span className="ml-2 text-xs opacity-70">({p.psf})</span>}
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma paciente encontrada</p>}
            </div>
          </ScrollArea>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: PRÉ-NATAL, DIU..." />
          </div>
          <Button onClick={handleAdd} disabled={!selectedPatient || loading} className="w-full">
            {loading ? "Agendando..." : "Agendar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
