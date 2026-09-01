import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Edit2, Trash2, History, User, CreditCard, ArrowLeftRight } from "lucide-react";
import type { Patient, Appointment } from "@/hooks/useScheduling";
import { usePatients, type PatientsFilter } from "@/hooks/usePatients";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateBR } from "@/hooks/useScheduling";
import { useHealthUnits } from "@/hooks/useHealthUnits";
import MergePatientsDialog from "@/components/MergePatientsDialog";
import PatientTimeline from "@/components/PatientTimeline";
import { useLoans } from "@/hooks/useLoans";
import { HandCoins } from "lucide-react";
import { parseValidLocalDate } from "@/lib/dateUtils";

function PatientLoansSection({ patientId }: { patientId: string }) {
  const { data = [] } = useLoans(patientId);
  if (data.length === 0) return null;
  const active = data.filter((l) => !l.returned_at);
  const past = data.filter((l) => l.returned_at);
  return (
    <div className="p-3 rounded-xl border bg-primary/5 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
        <HandCoins className="w-3.5 h-3.5" /> Empréstimos
      </div>
      {active.map((l) => {
        const target = parseValidLocalDate(l.expected_return_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = target
          ? Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return (
          <div key={l.id} className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-emerald-700">Ativo:</span>
            <span className="font-mono font-bold">{l.glucometer?.code}</span>
            <span>Devolução: {formatDateBR(l.expected_return_date)}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] py-0 px-1.5 font-bold",
                diff === null
                  ? "text-muted-foreground border-border bg-muted"
                  : diff < 0
                  ? "text-rose-700 border-rose-300 bg-rose-50"
                  : diff === 0
                  ? "text-amber-700 border-amber-300 bg-amber-50"
                  : "text-emerald-700 border-emerald-300 bg-emerald-50"
              )}
            >
              {diff === null
                ? "Data inválida"
                : diff < 0
                ? `Vencido há ${Math.abs(diff)}d`
                : diff === 0
                ? "Vence hoje"
                : `Faltam ${diff} dias`}
            </Badge>
          </div>
        );
      })}
      {past.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Histórico: {past.length} devolução(ões) — última em{" "}
          {formatDateBR(past[past.length - 1].returned_at as string)}
        </div>
      )}
    </div>
  );
}

interface Props {
  onGetHistory: (id: string) => Promise<Appointment[]>;
}

export default function PatientManager({ onGetHistory }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PatientsFilter>("all");
  const debouncedSearch = useDebounce(search, 400);
  const {
    patients: filtered,
    stats,
    addPatient: onAdd,
    updatePatient: onUpdate,
    deletePatient: onDelete,
    mergePatients,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePatients(debouncedSearch, filter);

  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const { data: healthUnits = [] } = useHealthUnits();
  const [mergePrimaryPatient, setMergePrimaryPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState({
    name: "",
    sus_card: "",
    dob: "",
    psf: "",
    observations: "",
  });
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

  const openNew = () => {
    setForm({
      name: "",
      sus_card: "",
      dob: "",
      psf: "",
      observations: "",
    });
    setNewOpen(true);
  };
  const openEdit = (p: Patient) => {
    setForm({
      name: p.name,
      sus_card: p.sus_card || "",
      dob: p.dob || "",
      psf: p.psf || "",
      observations: p.observations || "",
    });
    setEditPatient(p);
  };
  const openHistory = async (p: Patient) => {
    setHistoryPatient(p);
    const h = await onGetHistory(p.id);
    setHistory(h);
  };

  const handleSave = async () => {
    const data = {
      name: form.name.toUpperCase(),
      sus_card: form.sus_card || null,
      cpf: editPatient?.cpf || null,
      acs: editPatient?.acs || null,
      phone: editPatient?.phone || null,
      dob: form.dob || null,
      psf: form.psf || null,
      observations: form.observations || null,
      is_pregnant: false,
      dum: null,
      risk_classification: null,
      gestational_notes: null,
    };
    if (editPatient) {
      onUpdate({ id: editPatient.id, updates: data });
      setEditPatient(null);
    } else {
      await onAdd(data);
      setNewOpen(false);
    }
  };

  const renderFormDialog = () => (
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
          <Select value={form.psf} onValueChange={val => setForm(f => ({ ...f, psf: val }))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar unidade..." />
            </SelectTrigger>
            <SelectContent>
              {healthUnits.map(u => (
                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    <div className="flex flex-col md:h-full">
      {/* Stats bar */}
      <div className="p-4 border-b bg-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3">
          <Card className={`border-primary/20 cursor-pointer transition-all hover:shadow-md ${filter === "all" ? "ring-2 ring-primary" : ""}`} onClick={() => setFilter("all")}>
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-primary truncate">{stats.total}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-amber-500/20 cursor-pointer transition-all hover:shadow-md ${filter === "no_sus" ? "ring-2 ring-amber-500" : ""}`} onClick={() => setFilter(filter === "no_sus" ? "all" : "no_sus")}>
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-amber-600 truncate">{stats.total - stats.withSus}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Sem SUS</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-amber-500/20 cursor-pointer transition-all hover:shadow-md ${filter === "no_dob" ? "ring-2 ring-amber-500" : ""}`} onClick={() => setFilter(filter === "no_dob" ? "all" : "no_dob")}>
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-amber-600 truncate">{stats.withoutDob}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Sem Nascimento</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-rose-500/20 cursor-pointer transition-all hover:shadow-md ${filter === "no_psf" ? "ring-2 ring-rose-500" : ""}`} onClick={() => setFilter(filter === "no_psf" ? "all" : "no_psf")}>
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-rose-600 truncate">{stats.withoutPsf}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Sem PSF</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, cartão SUS ou PSF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full" />
          </div>

          <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
            <SelectTrigger className="w-full sm:w-[180px] shrink-0">
              <SelectValue placeholder="Filtro de Cadastro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Cadastros</SelectItem>
              <SelectItem value="incomplete">Cadastro Incompleto</SelectItem>
              <SelectItem value="no_sus">Sem Cartão SUS</SelectItem>
              <SelectItem value="no_dob">Sem Data Nascimento</SelectItem>
              <SelectItem value="no_psf">Sem PSF/UBS</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={openNew} size="sm" className="w-full sm:w-auto gap-1.5 shrink-0 justify-center">
            <Plus className="w-4 h-4" /> Nova Paciente
          </Button>
        </div>
        {(!!debouncedSearch || filter !== "all") && (
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
            <div className="w-full space-y-3">
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((p, i) => (
                  <div key={p.id} className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 select-text">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{i + 1}</span>
                          <h3 className="font-bold text-base truncate">{p.name}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary text-xs font-semibold select-text">
                          <CreditCard className="w-3.5 h-3.5" />
                          {p.sus_card || "Sem Cartão SUS"}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openHistory(p)} title="Histórico">
                          <History className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => openEdit(p)} title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => setMergePrimaryPatient(p)} title="Unificar cadastros">
                          <ArrowLeftRight className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteCandidate(p)} title="Excluir">
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

                    {!!p.observations && (
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
                        <TableCell className="font-medium text-sm">
                          <div className="select-text">{p.name}</div>
                        </TableCell>
                        <TableCell className="text-sm font-mono select-text">{p.sus_card || "—"}</TableCell>
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => setMergePrimaryPatient(p)} title="Unificar com duplicado">
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteCandidate(p)} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {/* Infinite scroll sentinel + loader */}
          {!isLoading && filtered.length > 0 && (
            <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground">
              {isFetchingNextPage
                ? "Carregando mais..."
                : hasNextPage
                  ? "Role para carregar mais"
                  : "Fim da lista"}
            </div>
          )}
        </div>
      </ScrollArea>



      <Dialog open={newOpen || !!editPatient} onOpenChange={(open) => {
        if (!open) {
          setNewOpen(false);
          setEditPatient(null);
        }
      }}>
        {renderFormDialog()}
      </Dialog>
      <AlertDialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              A paciente <strong>{deleteCandidate?.name}</strong> será removida permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteCandidate) onDelete(deleteCandidate.id);
                setDeleteCandidate(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!historyPatient} onOpenChange={() => setHistoryPatient(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b bg-muted/30">
            <DialogTitle className="text-primary text-base flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="truncate">{historyPatient?.name}</span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-5 space-y-5">
              {historyPatient && (
                <div className="rounded-xl border bg-card p-3 grid grid-cols-3 gap-3">
                  {[
                    { label: "Cartão SUS", value: historyPatient.sus_card || "—" },
                    { label: "PSF", value: historyPatient.psf || "—" },
                    { label: "Nascimento", value: historyPatient.dob ? formatDateBR(historyPatient.dob) : "—" },
                  ].map((f) => (
                    <div key={f.label} className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-medium text-foreground truncate">{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {historyPatient && <PatientLoansSection patientId={historyPatient.id} />}

              <section className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Prontuário unificado
                </p>
                <PatientTimeline patientId={historyPatient?.id} />
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Consultas
                </p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 rounded-xl border bg-card">
                    Sem consultas registradas
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <div key={h.id} className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{formatDateBR(h.date)}</span>
                          <Badge variant={h.type === "RETORNO" ? "outline" : "secondary"} className="text-[10px] font-bold">
                            {h.type}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>Vaga {String(h.slot).padStart(2, "0")}</span>
                          <span>{h.slot <= 15 ? "Manhã" : "Tarde"}</span>
                          <span>{h.reason || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>


      <MergePatientsDialog
        open={!!mergePrimaryPatient}
        onClose={() => setMergePrimaryPatient(null)}
        primaryPatient={mergePrimaryPatient}
        onMergeSuccess={() => {}}
        mergePatients={mergePatients}
      />
    </div>
  );
}
