import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlucometers, useLoans, type Loan } from "@/hooks/useLoans";
import { printLoanReceipt } from "@/lib/printLoan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  HandCoins,
  Plus,
  Printer,
  RotateCcw,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Clock,
  PackageCheck,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

function daysDiff(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type PatientLite = { id: string; name: string; sus_card: string | null; psf: string | null };

export default function LoanManager() {
  const loansQ = useLoans();
  const glucQ = useGlucometers();

  const [openNew, setOpenNew] = useState(false);
  const [openDevices, setOpenDevices] = useState(false);
  const [renewLoan, setRenewLoan] = useState<Loan | null>(null);
  const [returnLoan, setReturnLoan] = useState<Loan | null>(null);
  const [deleteLoan, setDeleteLoan] = useState<Loan | null>(null);

  const loans = loansQ.data ?? [];
  const gluc = glucQ.data ?? [];

  const active = useMemo(() => loans.filter((l) => !l.returned_at), [loans]);
  const history = useMemo(() => loans.filter((l) => l.returned_at), [loans]);
  const available = gluc.filter((g) => g.status === "available").length;

  const overdue = active.filter((l) => daysDiff(l.expected_return_date) < 0);
  const upcoming = active.filter((l) => {
    const d = daysDiff(l.expected_return_date);
    return d >= 0 && d <= 3;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Alerts */}
      <div className="p-4 md:p-6 border-b bg-card space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="border-emerald-500/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{available}</p>
                <p className="text-xs text-muted-foreground">Glicosímetros disponíveis</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{upcoming.length}</p>
                <p className="text-xs text-muted-foreground">Próximos do vencimento (≤3 dias)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-rose-500/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600">{overdue.length}</p>
                <p className="text-xs text-muted-foreground">Empréstimos vencidos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setOpenNew(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo Empréstimo
          </Button>
          <Button variant="outline" onClick={() => setOpenDevices(true)} className="gap-1.5">
            <Settings2 className="w-4 h-4" /> Glicosímetros
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-8">
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <HandCoins className="w-4 h-4" /> Empréstimos ativos ({active.length})
          </h3>
          {active.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border rounded-2xl bg-muted/20">
              Nenhum empréstimo ativo no momento.
            </div>
          ) : (
            <LoanTable
              loans={active}
              onRenew={setRenewLoan}
              onReturn={setReturnLoan}
              onDelete={setDeleteLoan}
              onPrint={printLoanReceipt}
            />
          )}
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Histórico ({history.length})
          </h3>
          {history.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm border rounded-2xl bg-muted/20">
              Sem devoluções registradas ainda.
            </div>
          ) : (
            <LoanTable
              loans={history}
              historical
              onDelete={setDeleteLoan}
              onPrint={printLoanReceipt}
            />
          )}
        </section>
      </div>

      <NewLoanDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={(loan) => {
          setOpenNew(false);
          printLoanReceipt(loan);
        }}
      />
      <DevicesDialog open={openDevices} onOpenChange={setOpenDevices} />

      <RenewDialog loan={renewLoan} onClose={() => setRenewLoan(null)} />

      <AlertDialog open={!!returnLoan} onOpenChange={(o) => !o && setReturnLoan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar devolução</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a devolução do glicosímetro <b>{returnLoan?.glucometer?.code}</b> por{" "}
              <b>{returnLoan?.patient?.name}</b>? O aparelho voltará para o estoque disponível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <ReturnConfirm loan={returnLoan} onDone={() => setReturnLoan(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLoan} onOpenChange={(o) => !o && setDeleteLoan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empréstimo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se o empréstimo estiver ativo, o aparelho voltará
              para disponível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <DeleteConfirm loan={deleteLoan} onDone={() => setDeleteLoan(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoanTable({
  loans,
  historical,
  onRenew,
  onReturn,
  onDelete,
  onPrint,
}: {
  loans: Loan[];
  historical?: boolean;
  onRenew?: (l: Loan) => void;
  onReturn?: (l: Loan) => void;
  onDelete: (l: Loan) => void;
  onPrint: (l: Loan) => void;
}) {
  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Paciente</TableHead>
            <TableHead>Glicosímetro</TableHead>
            <TableHead>Emprestado em</TableHead>
            <TableHead>{historical ? "Devolvido em" : "Devolução prevista"}</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="text-center w-36">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((l) => {
            const diff = daysDiff(l.expected_return_date);
            let status: React.ReactNode = null;
            if (l.returned_at) {
              status = <Badge className="bg-emerald-500/10 text-emerald-700 border-0">Devolvido</Badge>;
            } else if (diff < 0) {
              status = <Badge className="bg-rose-500/10 text-rose-700 border-0">Vencido há {Math.abs(diff)}d</Badge>;
            } else if (diff <= 3) {
              status = <Badge className="bg-amber-500/10 text-amber-700 border-0">Vence em {diff}d</Badge>;
            } else {
              status = <Badge className="bg-primary/10 text-primary border-0">Em dia</Badge>;
            }
            return (
              <TableRow key={l.id}>
                <TableCell>
                  <div className="font-medium text-sm">{l.patient?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.patient?.psf ?? "—"} • SUS {l.patient?.sus_card ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="font-mono font-semibold">{l.glucometer?.code ?? "—"}</span>
                  {l.glucometer?.brand && (
                    <div className="text-xs text-muted-foreground">{l.glucometer.brand}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{fmtBR(l.loaned_at)}</TableCell>
                <TableCell className="text-sm">
                  {historical ? fmtBR(l.returned_at) : fmtBR(l.expected_return_date)}
                </TableCell>
                <TableCell>{status}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Reimprimir recibo" onClick={() => onPrint(l)}>
                      <Printer className="w-4 h-4" />
                    </Button>
                    {!historical && onRenew && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Renovar" onClick={() => onRenew(l)}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                    {!historical && onReturn && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" title="Registrar devolução" onClick={() => onReturn(l)}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => onDelete(l)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function NewLoanDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (l: Loan) => void;
}) {
  const { create } = useLoans();
  const glucQ = useGlucometers();
  const available = (glucQ.data ?? []).filter((g) => g.status === "available");

  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [patientId, setPatientId] = useState("");
  const [glucId, setGlucId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const debounced = useDebounce(search, 300);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let q = (supabase as any)
        .from("patients")
        .select("id,name,sus_card,psf")
        .order("name")
        .limit(30);
      if (debounced.trim()) q = q.ilike("name", `%${debounced.trim().toUpperCase()}%`);
      const { data } = await q;
      if (!cancelled) setPatients((data ?? []) as PatientLite[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPatientId("");
      setGlucId("");
      setExpected("");
      setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!patientId || !glucId || !expected) {
      toast.error("Preencha paciente, glicosímetro e data de devolução");
      return;
    }
    try {
      const loan = await create.mutateAsync({
        patient_id: patientId,
        glucometer_id: glucId,
        expected_return_date: expected,
        notes: notes || null,
      });
      onCreated(loan);
    } catch {
      /* toast handled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Empréstimo</DialogTitle>
          <DialogDescription>
            Selecione a paciente e o glicosímetro disponível. O recibo será impresso automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Buscar paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome da paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma paciente</div>
                )}
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.psf ? ` — ${p.psf}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Glicosímetro disponível ({available.length})
            </Label>
            <Select value={glucId} onValueChange={setGlucId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar glicosímetro" />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum aparelho disponível
                  </div>
                )}
                {available.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.code}
                    {g.brand ? ` — ${g.brand}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Data prevista de devolução
            </Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <Button className="w-full" onClick={submit} disabled={create.isPending}>
            Registrar e imprimir recibo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const { renew } = useLoans();
  const [date, setDate] = useState("");

  useEffect(() => {
    if (loan) setDate(loan.expected_return_date);
  }, [loan]);

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renovar empréstimo</DialogTitle>
          <DialogDescription>
            Atualize apenas a data prevista de devolução. O mesmo registro será mantido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm">
              <b>{loan?.patient?.name}</b> — Glicosímetro{" "}
              <span className="font-mono">{loan?.glucometer?.code}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Nova data de devolução
            </Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!date || renew.isPending}
            onClick={async () => {
              if (!loan) return;
              await renew.mutateAsync({ id: loan.id, expected_return_date: date });
              onClose();
            }}
          >
            Salvar renovação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReturnConfirm({ loan, onDone }: { loan: Loan | null; onDone: () => void }) {
  const { returnLoan } = useLoans();
  return (
    <AlertDialogAction
      onClick={async (e) => {
        e.preventDefault();
        if (!loan) return;
        await returnLoan.mutateAsync({ id: loan.id });
        onDone();
      }}
    >
      Confirmar devolução
    </AlertDialogAction>
  );
}

function DeleteConfirm({ loan, onDone }: { loan: Loan | null; onDone: () => void }) {
  const { remove } = useLoans();
  return (
    <AlertDialogAction
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      onClick={async (e) => {
        e.preventDefault();
        if (!loan) return;
        await remove.mutateAsync(loan.id);
        onDone();
      }}
    >
      Excluir
    </AlertDialogAction>
  );
}

function DevicesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data = [], add, remove } = useGlucometers();
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!code.trim()) {
      toast.error("Informe o código do aparelho");
      return;
    }
    await add.mutateAsync({ code, brand, notes });
    setCode("");
    setBrand("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Glicosímetros</DialogTitle>
          <DialogDescription>
            Cadastre e gerencie os aparelhos disponíveis para empréstimo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end">
          <div>
            <Label className="text-xs font-semibold uppercase">Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: GL-001" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase">Marca</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Accu-Chek" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase">Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={add.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="max-h-[400px] overflow-auto border rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Código</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                    Nenhum aparelho cadastrado
                  </TableCell>
                </TableRow>
              )}
              {data.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono font-semibold">{g.code}</TableCell>
                  <TableCell>{g.brand ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.notes ?? "—"}</TableCell>
                  <TableCell>
                    {g.status === "available" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-0">Disponível</Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-700 border-0">Emprestado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      disabled={g.status !== "available"}
                      title={g.status !== "available" ? "Aparelho emprestado" : "Remover"}
                      onClick={() => remove.mutate(g.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}