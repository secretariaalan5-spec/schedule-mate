import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit2, Trash2, History, X } from "lucide-react";
import type { Patient, Appointment } from "@/hooks/useScheduling";
import { formatDateBR } from "@/hooks/useScheduling";

interface Props {
  patients: Patient[];
  onAdd: (p: Omit<Patient, "id" | "legacy_id">) => Promise<Patient | null>;
  onUpdate: (id: string, p: Partial<Patient>) => void;
  onDelete: (id: string) => void;
  onGetHistory: (id: string) => Promise<Appointment[]>;
}

export default function PatientManager({ patients, onAdd, onUpdate, onDelete, onGetHistory }: Props) {
  const [search, setSearch] = useState("");
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [form, setForm] = useState({ name: "", sus_card: "", dob: "", psf: "", observations: "" });

  const filtered = patients.filter(p => {
    const s = search.toUpperCase();
    return !search || p.name.toUpperCase().includes(s) || p.sus_card?.includes(s) || p.psf?.toUpperCase().includes(s);
  });

  const openNew = () => { setForm({ name: "", sus_card: "", dob: "", psf: "", observations: "" }); setNewOpen(true); };
  const openEdit = (p: Patient) => {
    setForm({ name: p.name, sus_card: p.sus_card || "", dob: p.dob || "", psf: p.psf || "", observations: p.observations || "" });
    setEditPatient(p);
  };
  const openHistory = async (p: Patient) => {
    setHistoryPatient(p);
    const h = await onGetHistory(p.id);
    setHistory(h);
  };

  const handleSave = async () => {
    const data = { name: form.name.toUpperCase(), sus_card: form.sus_card || null, dob: form.dob || null, psf: form.psf.toUpperCase() || null, observations: form.observations || null };
    if (editPatient) {
      onUpdate(editPatient.id, data);
      setEditPatient(null);
    } else {
      await onAdd(data);
      setNewOpen(false);
    }
  };

  const formDialog = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editPatient ? "Editar Paciente" : "Nova Paciente"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Cartão SUS</Label><Input value={form.sus_card} onChange={e => setForm(f => ({ ...f, sus_card: e.target.value }))} /></div>
        <div><Label>Data de Nascimento</Label><Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} /></div>
        <div><Label>PSF</Label><Input value={form.psf} onChange={e => setForm(f => ({ ...f, psf: e.target.value }))} /></div>
        <div><Label>Observações</Label><Input value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} /></div>
        <Button onClick={handleSave} className="w-full" disabled={!form.name}>Salvar</Button>
      </div>
    </DialogContent>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova</Button>
      </div>
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cartão SUS</TableHead>
              <TableHead>Nascimento</TableHead>
              <TableHead>PSF</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.sus_card || "—"}</TableCell>
                <TableCell>{p.dob ? formatDateBR(p.dob) : "—"}</TableCell>
                <TableCell><Badge variant="secondary">{p.psf || "—"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openHistory(p)}><History className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>{formDialog}</Dialog>
      <Dialog open={!!editPatient} onOpenChange={() => setEditPatient(null)}>{formDialog}</Dialog>
      <Dialog open={!!historyPatient} onOpenChange={() => setHistoryPatient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico: {historyPatient?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem consultas registradas</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Vaga</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {history.map(h => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDateBR(h.date)}</TableCell>
                      <TableCell>{h.slot}</TableCell>
                      <TableCell>{h.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
