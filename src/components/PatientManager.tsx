import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Edit2, Trash2, History, User, CreditCard } from "lucide-react";
import type { Patient, Appointment } from "@/hooks/useScheduling";
import { usePatients } from "@/hooks/usePatients";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateBR } from "@/hooks/useScheduling";

interface Props {
  onGetHistory: (id: string) => Promise<Appointment[]>;
}

export default function PatientManager({ onGetHistory }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const {
    patients: filtered,
    stats,
    addPatient: onAdd,
    updatePatient: onUpdate,
    deletePatient: onDelete,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePatients(debouncedSearch);

  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [form, setForm] = useState({ name: "", sus_card: "", dob: "", psf: "", observations: "" });
  const [deleteCandidate, setDeleteCandidate] = useState<Patient | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const totalFiltered = filtered.length;

  // Infinite scroll: load next page when sentinel enters viewport
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, filtered.length]);

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
      onUpdate({ id: editPatient.id, updates: data });
      setEditPatient(null);
    } else {
      await onAdd(data);
      setNewOpen(false);
    }
  };

  const formDialog = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-primary">{editPatient ? "Editar Paciente" : "Nova Paciente"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cartão SUS</Label>
            <Input value={form.sus_card} onChange={e => setForm(f => ({ ...f, sus_card: e.target.value }))} placeholder="Nº do cartão" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Nascimento</Label>
            <Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PSF / UBS</Label>
          <Input value={form.psf} onChange={e => setForm(f => ({ ...f, psf: e.target.value }))} placeholder="Nome do PSF" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
          <Input value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Observações adicionais" />
        </div>
        <Button onClick={handleSave} className="w-full" disabled={!form.name}>Salvar</Button>
      </div>
    </DialogContent>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-4 mb-3">
          <Card className="flex-1 border-primary/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-primary">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Pacientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 border-primary/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-primary">{stats.withSus}</p>
                <p className="text-xs text-muted-foreground">Com Cartão SUS</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, cartão SUS ou PSF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova Paciente
          </Button>
        </div>
        {debouncedSearch && (
          <p className="text-xs text-muted-foreground mt-2">
            {totalFiltered}{hasNextPage ? "+" : ""} resultado{totalFiltered !== 1 ? "s" : ""} encontrado{totalFiltered !== 1 ? "s" : ""}
          </p>

        )}
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="space-y-3 pb-8">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {debouncedSearch ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((p, i) => (
                  <div key={p.id} className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{i + 1}</span>
                          <h3 className="font-bold text-base truncate">{p.name}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                          <CreditCard className="w-3.5 h-3.5" />
                          {p.sus_card || "Sem Cartão SUS"}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openHistory(p)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEdit(p)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm(`Excluir paciente "${p.name}"?`)) onDelete(p.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Nascimento</p>
                        <p className="text-sm">{p.dob ? formatDateBR(p.dob) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">PSF / UBS</p>
                        <div className="mt-0.5">
                          {p.psf ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] h-5">{p.psf}</Badge>
                          ) : "—"}
                        </div>
                      </div>
                    </div>

                    {p.observations && (
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Observações</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">"{p.observations}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block bg-card rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cartão SUS</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>PSF / UBS</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-28 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p, i) => (
                      <TableRow key={p.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell className="text-sm font-mono">{p.sus_card || "—"}</TableCell>
                        <TableCell className="text-sm">{p.dob ? formatDateBR(p.dob) : "—"}</TableCell>
                        <TableCell>
                          {p.psf ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">{p.psf}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.observations || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => openHistory(p)} title="Histórico">
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => openEdit(p)} title="Editar">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm(`Excluir paciente "${p.name}"?`)) onDelete(p.id); }} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </ScrollArea>



      <Dialog open={newOpen} onOpenChange={setNewOpen}>{formDialog}</Dialog>
      <Dialog open={!!editPatient} onOpenChange={() => setEditPatient(null)}>{formDialog}</Dialog>
      <Dialog open={!!historyPatient} onOpenChange={() => setHistoryPatient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Histórico: {historyPatient?.name}</DialogTitle>
          </DialogHeader>
          {historyPatient && (
            <div className="mb-3 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
              <p><span className="font-medium">Cartão SUS:</span> {historyPatient.sus_card || "—"}</p>
              <p><span className="font-medium">PSF:</span> {historyPatient.psf || "—"}</p>
              <p><span className="font-medium">Nascimento:</span> {historyPatient.dob ? formatDateBR(historyPatient.dob) : "—"}</p>
            </div>
          )}
          <ScrollArea className="max-h-80">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem consultas registradas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Vaga</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(h => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDateBR(h.date)}</TableCell>
                      <TableCell>{String(h.slot).padStart(2, "0")}</TableCell>
                      <TableCell>{h.slot <= 15 ? "Manhã" : "Tarde"}</TableCell>
                      <TableCell>{h.reason || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={h.type === "RETORNO" ? "outline" : "secondary"} className="text-xs">
                          {h.type}
                        </Badge>
                      </TableCell>
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
