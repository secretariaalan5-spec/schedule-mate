import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlucometers, useLoans, type Loan } from "@/hooks/useLoans";
import { printLoanReceipt } from "@/lib/printLoan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Clock,
  PackageCheck,
  Search,
  SlidersHorizontal,
  History,
  HardDrive,
  FilterX,
} from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { usePatients } from "@/hooks/usePatients";
import { useHealthUnits } from "@/hooks/useHealthUnits";
import type { Patient } from "@/hooks/useScheduling";

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

export default function LoanManager() {
  const loansQ = useLoans();
  const glucQ = useGlucometers();
  const { data: healthUnits = [] } = useHealthUnits();

  // Dialog states
  const [openNew, setOpenNew] = useState(false);
  const [returnLoan, setReturnLoan] = useState<Loan | null>(null);
  const [deleteLoan, setDeleteLoan] = useState<Loan | null>(null);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPsf, setSelectedPsf] = useState("all");

  const loans = loansQ.data ?? [];
  const gluc = glucQ.data ?? [];

  const active = useMemo(() => loans.filter((l) => !l.returned_at), [loans]);
  const historyList = useMemo(() => loans.filter((l) => l.returned_at), [loans]);
  
  const available = gluc.filter((g) => g.status === "available").length;
  const loanedCount = active.length;
  const overdue = active.filter((l) => daysDiff(l.expected_return_date) < 0);

  // Clear filters helper
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPsf("all");
  };

  // Filter Active Loans
  const filteredActive = useMemo(() => {
    return active.filter((l) => {
      const q = searchQuery.toUpperCase().trim();
      const patient = l.patient;
      const patientCpf = (patient as any)?.cpf || "";
      const matchesSearch =
        q === "" ||
        patient?.name.toUpperCase().includes(q) ||
        patientCpf.includes(q) ||
        l.glucometer?.code.toUpperCase().includes(q);

      const matchesPsf = selectedPsf === "all" || patient?.psf === selectedPsf;

      return matchesSearch && matchesPsf;
    });
  }, [active, searchQuery, selectedPsf]);

  // Filter History
  const filteredHistory = useMemo(() => {
    return historyList.filter((l) => {
      const q = searchQuery.toUpperCase().trim();
      const patient = l.patient;
      const patientCpf = (patient as any)?.cpf || "";
      const matchesSearch =
        q === "" ||
        patient?.name.toUpperCase().includes(q) ||
        patientCpf.includes(q) ||
        l.glucometer?.code.toUpperCase().includes(q);

      const matchesPsf = selectedPsf === "all" || patient?.psf === selectedPsf;

      return matchesSearch && matchesPsf;
    });
  }, [historyList, searchQuery, selectedPsf]);

  // Filter Glucometers
  const filteredGluc = useMemo(() => {
    return gluc.filter((g) => {
      const q = searchQuery.toUpperCase().trim();
      return (
        q === "" ||
        g.code.toUpperCase().includes(q) ||
        g.brand?.toUpperCase().includes(q) ||
        g.notes?.toUpperCase().includes(q)
      );
    });
  }, [gluc, searchQuery]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Metrics Header Grid */}
      <div className="p-4 md:p-6 border-b bg-card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-primary" /> Painel de Empréstimos
            </h1>
            <p className="text-xs text-muted-foreground">
              Cadastro e controle simplificado de glicosímetros
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)} className="gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> Novo Empréstimo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="shadow-none border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-emerald-600 tracking-tight">{available}</p>
                <p className="text-xs text-emerald-700/80">Aparelhos Disponíveis</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <HandCoins className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-blue-600 tracking-tight">{loanedCount}</p>
                <p className="text-xs text-blue-700/80">Aparelhos Emprestados (Ativos)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border-rose-500/20 bg-rose-500/5">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-rose-600 tracking-tight">{overdue.length}</p>
                <p className="text-xs text-rose-700/80">Empréstimos Vencidos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Simplified Filter Toolbar */}
      <div className="bg-card px-4 md:px-6 py-2.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* General Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-sm"
              placeholder={
                activeTab === "stock"
                  ? "Buscar por código, marca..."
                  : "Buscar por paciente, CPF ou glicosímetro..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* PSF filter dropdown */}
          {activeTab !== "stock" && (
            <Select value={selectedPsf} onValueChange={setSelectedPsf}>
              <SelectTrigger className="w-full md:w-56 h-9 text-xs">
                <SelectValue placeholder="Filtrar por unidade (PSF)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Unidades (PSF)</SelectItem>
                {healthUnits.map((u) => (
                  <SelectItem key={u.id} value={u.name}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear Filters Button */}
          {(searchQuery || selectedPsf !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <FilterX className="w-3.5 h-3.5 mr-1" /> Limpar Filtro
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {activeTab === "active" && `Mostrando ${filteredActive.length} empréstimo(s)`}
          {activeTab === "history" && `Mostrando ${filteredHistory.length} devolução(ões)`}
          {activeTab === "stock" && `Mostrando ${filteredGluc.length} aparelho(s)`}
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="bg-card border-b px-4 md:px-6 py-0.5">
          <TabsList className="bg-transparent h-10 p-0 justify-start gap-4">
            <TabsTrigger
              value="active"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium shadow-none gap-1.5"
            >
              <HandCoins className="w-4 h-4" />
              Empréstimos Ativos
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
                {active.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium shadow-none gap-1.5"
            >
              <History className="w-4 h-4" />
              Histórico de Devoluções
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
                {historyList.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="stock"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium shadow-none gap-1.5"
            >
              <HardDrive className="w-4 h-4" />
              Estoque de Glicosímetros
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
                {gluc.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Active Loans */}
        <TabsContent value="active" className="flex-1 overflow-auto p-4 md:p-6 m-0">
          {filteredActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border rounded-xl bg-card border-dashed text-center">
              <SlidersHorizontal className="w-8 h-8 text-muted-foreground/45 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum empréstimo ativo encontrado.</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="font-semibold text-xs">Paciente (Dados Gerais)</TableHead>
                    <TableHead className="font-semibold text-xs">Glicosímetro</TableHead>
                    <TableHead className="font-semibold text-xs">Datas</TableHead>
                    <TableHead className="font-semibold text-xs">Situação</TableHead>
                    <TableHead className="text-center w-28 font-semibold text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActive.map((l) => {
                    const diff = daysDiff(l.expected_return_date);
                    let statusBadge: React.ReactNode = null;
                    if (diff < 0) {
                      statusBadge = (
                        <Badge className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/10 border-0 flex items-center gap-1 w-fit text-[10px] py-0.5">
                          <AlertTriangle className="w-3 h-3" /> Vencido ({Math.abs(diff)}d)
                        </Badge>
                      );
                    } else if (diff <= 3) {
                      statusBadge = (
                        <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 border-0 flex items-center gap-1 w-fit text-[10px] py-0.5">
                          <Clock className="w-3 h-3" /> Vence em {diff}d
                        </Badge>
                      );
                    } else {
                      statusBadge = (
                        <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 border-0 flex items-center gap-1 w-fit text-[10px] py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Em dia
                        </Badge>
                      );
                    }
                    
                    const patient = l.patient;
                    const cpf = (patient as any)?.cpf ? `CPF: ${(patient as any).cpf}` : "";
                    const sus = patient?.sus_card ? `CNS: ${patient.sus_card}` : "";
                    const contact = (patient as any)?.phone ? `Tel: ${(patient as any).phone}` : "";
                    const acs = (patient as any)?.acs ? `ACS: ${(patient as any).acs}` : "";
                    const psf = patient?.psf ? `PSF: ${patient.psf}` : "";
                    
                    const details = [cpf, sus, contact, acs, psf].filter(Boolean).join(" | ");

                    return (
                      <TableRow key={l.id} className="hover:bg-muted/5">
                        <TableCell>
                          <div className="font-semibold text-sm text-foreground">{patient?.name ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{details || "Sem dados adicionais"}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-bold text-xs text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                            {l.glucometer?.code ?? "—"}
                          </span>
                          {l.glucometer?.brand && (
                            <span className="text-[10px] text-muted-foreground ml-2">({l.glucometer.brand})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">Retirada: {fmtBR(l.loaned_at)}</div>
                          <div className="text-[10px] text-muted-foreground">Prazo: {fmtBR(l.expected_return_date)}</div>
                        </TableCell>
                        <TableCell>{statusBadge}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5"
                              title="Registrar Devolução"
                              onClick={() => setReturnLoan(l)}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Reimprimir Termo"
                              onClick={() => printLoanReceipt(l)}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                              title="Excluir Registro"
                              onClick={() => setDeleteLoan(l)}
                            >
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
          )}
        </TabsContent>

        {/* Tab 2: Loan History */}
        <TabsContent value="history" className="flex-1 overflow-auto p-4 md:p-6 m-0">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border rounded-xl bg-card border-dashed text-center">
              <SlidersHorizontal className="w-8 h-8 text-muted-foreground/45 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma devolução encontrada.</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="font-semibold text-xs">Paciente (Dados Gerais)</TableHead>
                    <TableHead className="font-semibold text-xs">Glicosímetro</TableHead>
                    <TableHead className="font-semibold text-xs">Retirado em</TableHead>
                    <TableHead className="font-semibold text-xs">Devolvido em</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
                    <TableHead className="text-center w-20 font-semibold text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((l) => {
                    const patient = l.patient;
                    const cpf = (patient as any)?.cpf ? `CPF: ${(patient as any).cpf}` : "";
                    const sus = patient?.sus_card ? `CNS: ${patient.sus_card}` : "";
                    const contact = (patient as any)?.phone ? `Tel: ${(patient as any).phone}` : "";
                    const acs = (patient as any)?.acs ? `ACS: ${(patient as any).acs}` : "";
                    const psf = patient?.psf ? `PSF: ${patient.psf}` : "";
                    
                    const details = [cpf, sus, contact, acs, psf].filter(Boolean).join(" | ");

                    return (
                      <TableRow key={l.id} className="hover:bg-muted/5">
                        <TableCell>
                          <div className="font-semibold text-sm text-foreground">{patient?.name ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{details || "Sem dados adicionais"}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border">
                            {l.glucometer?.code ?? "—"}
                          </span>
                          {l.glucometer?.brand && (
                            <span className="text-[10px] text-muted-foreground ml-2">({l.glucometer.brand})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{fmtBR(l.loaned_at)}</TableCell>
                        <TableCell className="text-xs text-emerald-600 font-semibold">
                          {fmtBR(l.returned_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 border-0 text-[10px] py-0.5">
                            Devolvido
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Reimprimir Termo"
                              onClick={() => printLoanReceipt(l)}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                              title="Excluir Registro"
                              onClick={() => setDeleteLoan(l)}
                            >
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
          )}
        </TabsContent>

        {/* Tab 3: Glucometers Stock Management */}
        <TabsContent value="stock" className="flex-1 overflow-auto p-4 md:p-6 m-0 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Add Glucometer Card Form */}
            <div className="md:col-span-1">
              <AddGlucometerCard />
            </div>

            {/* Glucometer List Table */}
            <div className="md:col-span-2">
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/15">
                  <h3 className="font-semibold text-sm">Aparelhos no Inventário</h3>
                  <p className="text-xs text-muted-foreground">Cadastre novos aparelhos ao lado e consulte o status atual</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-xs">Código</TableHead>
                      <TableHead className="font-semibold text-xs">Marca / Modelo</TableHead>
                      <TableHead className="font-semibold text-xs">Observações</TableHead>
                      <TableHead className="font-semibold text-xs">Status</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGluc.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                          Nenhum glicosímetro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGluc.map((g) => (
                        <TableRow key={g.id} className="hover:bg-muted/10">
                          <TableCell className="font-mono font-semibold text-sm text-foreground">{g.code}</TableCell>
                          <TableCell className="text-xs font-medium">{g.brand ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {g.notes ?? "—"}
                          </TableCell>
                          <TableCell>
                            {g.status === "available" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 border-0 text-[10px]">Disponível</Badge>
                            ) : (
                              <Badge className="bg-blue-500/10 text-blue-700 border-0 text-[10px]">Emprestado</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                              disabled={g.status !== "available"}
                              title={g.status !== "available" ? "Aparelho emprestado" : "Remover aparelho"}
                              onClick={() => glucQ.remove.mutate(g.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Loan dialog */}
      <NewLoanDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={(loan) => {
          setOpenNew(false);
          printLoanReceipt(loan);
        }}
      />

      {/* Return confirmation dialog */}
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

      {/* Delete confirmation dialog */}
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

// Inline card for adding a new Glucometer device
function AddGlucometerCard() {
  const { add } = useGlucometers();
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
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Novo Aparelho</CardTitle>
        <CardDescription className="text-xs">Registre um novo glicosímetro no inventário geral da unidade</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Código / Identificação</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: GL-001" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Marca / Modelo</Label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Accu-Chek" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Observações</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Doação do Estado" />
        </div>
        <Button className="w-full mt-2 gap-1.5" onClick={submit} disabled={add.isPending}>
          <Plus className="w-4 h-4" /> Cadastrar Glicosímetro
        </Button>
      </CardContent>
    </Card>
  );
}

// Form logic for registering a new loan
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
  const { data: healthUnits = [] } = useHealthUnits();

  // Patient search state
  const [name, setName] = useState("");
  const [susCard, setSusCard] = useState("");
  const [cpf, setCpf] = useState("");
  const [acs, setAcs] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [psf, setPsf] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Loan fields
  const [glucId, setGlucId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced search
  const debouncedSearch = useDebounce(name, 250);
  const effectiveSearch = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : "";
  const { patients: searchResults, isLoading: isSearching } = usePatients(effectiveSearch);

  // Sort results: exact > starts-with > contains
  const filtered = useMemo(() => {
    if (!effectiveSearch) return [];
    const q = effectiveSearch.toUpperCase();
    const score = (p: Patient) => {
      const n = (p.name || "").toUpperCase();
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (n.includes(q)) return 2;
      return 3;
    };
    return [...searchResults]
      .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [searchResults, effectiveSearch]);

  // Reset everything when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSusCard("");
      setCpf("");
      setAcs("");
      setPhone("");
      setDob("");
      setPsf("");
      setSelectedPatient(null);
      setShowResults(false);
      setGlucId("");
      setExpected("");
      setNotes("");
      setSaving(false);
    }
  }, [open]);

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setName(p.name);
    setSusCard(p.sus_card || "");
    setCpf((p as any).cpf || "");
    setAcs((p as any).acs || "");
    setPhone((p as any).phone || "");
    setDob(p.dob || "");
    setPsf(p.psf || "");
    setShowResults(false);
  };

  const calcAge = (dobStr: string | null) => {
    if (!dobStr) return null;
    const d = new Date(dobStr + "T12:00:00");
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  };

  const highlight = (text: string, q: string) => {
    if (!q) return text as any;
    const i = text.toUpperCase().indexOf(q.toUpperCase());
    if (i < 0) return text as any;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-primary/20 text-primary rounded px-0.5">{text.slice(i, i + q.length)}</mark>
        {text.slice(i + q.length)}
      </>
    );
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do paciente");
      return;
    }
    if (!glucId || !expected) {
      toast.error("Preencha o glicosímetro e a data de devolução");
      return;
    }
    setSaving(true);

    try {
      let patientId = selectedPatient?.id;

      // If name changed or no patient selected → create new patient
      if (!patientId || name.trim().toUpperCase() !== selectedPatient?.name.toUpperCase()) {
        const { data, error } = await (supabase as any)
          .from("patients")
          .insert({
            name: name.trim().toUpperCase(),
            sus_card: susCard.trim() || null,
            cpf: cpf.trim() || null,
            acs: acs.trim() || null,
            phone: phone.trim() || null,
            dob: dob || null,
            psf: psf || null,
          })
          .select("id")
          .single();

        if (error) {
          toast.error("Erro ao cadastrar paciente: " + error.message);
          setSaving(false);
          return;
        }
        patientId = data.id;
      } else {
        // Patient exists — update changed fields
        const updates: Record<string, string | null> = {};
        if (susCard.trim() !== (selectedPatient.sus_card || "")) updates.sus_card = susCard.trim() || null;
        if (cpf.trim() !== ((selectedPatient as any).cpf || "")) updates.cpf = cpf.trim() || null;
        if (acs.trim() !== ((selectedPatient as any).acs || "")) updates.acs = acs.trim() || null;
        if (phone.trim() !== ((selectedPatient as any).phone || "")) updates.phone = phone.trim() || null;
        if (dob !== (selectedPatient.dob || "")) updates.dob = dob || null;
        if (psf !== (selectedPatient.psf || "")) updates.psf = psf || null;
        if (Object.keys(updates).length > 0) {
          await (supabase as any).from("patients").update(updates).eq("id", patientId);
        }
      }

      const loan = await create.mutateAsync({
        patient_id: patientId!,
        glucometer_id: glucId,
        expected_return_date: expected,
        notes: notes.trim() || null,
      });
      onCreated(loan);
    } catch {
      /* errors already toasted by mutateAsync */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Empréstimo</DialogTitle>
          <DialogDescription>
            Digite o nome da paciente. Se ela já existir no cadastro, selecione na lista. Se não
            existir, preencha os dados e ela será cadastrada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient name with live search */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold uppercase tracking-wide">Nome da Paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Digite o nome para buscar ou cadastrar..."
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  setShowResults(true);
                  if (!val) setSelectedPatient(null);
                }}
                onFocus={() => { if (name) setShowResults(true); }}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
            </div>

            {/* Dropdown suggestions */}
            {showResults && effectiveSearch && (
              <ScrollArea className="absolute z-50 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-56">
                {isSearching ? (
                  <div className="px-3 py-4 text-sm text-center text-muted-foreground">Buscando...</div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                    Paciente não encontrada. Preencha os dados abaixo e ela será cadastrada ao salvar.
                  </div>
                ) : (
                  filtered.map((p) => {
                    const age = calcAge(p.dob);
                    return (
                      <div
                        key={p.id}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors flex items-center justify-between"
                        onMouseDown={(e) => { e.preventDefault(); selectPatient(p); }}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{highlight(p.name, effectiveSearch)}</span>
                            {age !== null && (
                              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{age}a</span>
                            )}
                            {p.psf && <span className="text-xs text-muted-foreground">({p.psf})</span>}
                          </div>
                          {p.dob && (
                            <span className="text-xs text-muted-foreground mt-0.5">Nasc: {fmtBR(p.dob)}</span>
                          )}
                        </div>
                        {p.sus_card && (
                          <span className="text-xs text-muted-foreground font-mono">{p.sus_card}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </ScrollArea>
            )}
          </div>

          {/* Patient details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Cartão SUS</Label>
              <Input
                placeholder="Nº do cartão SUS"
                value={susCard}
                onChange={(e) => setSusCard(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">CPF</Label>
              <Input
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Contato / Telefone</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">ACS (Agente Comunitário)</Label>
              <Input
                placeholder="Nome do ACS"
                value={acs}
                onChange={(e) => setAcs(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Data de Nascimento</Label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">PSF / UBS</Label>
              <Select value={psf} onValueChange={setPsf}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar unidade..." />
                </SelectTrigger>
                <SelectContent>
                  {healthUnits.map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <hr className="border-border" />

          {/* Loan details */}
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
                    {g.code}{g.brand ? ` — ${g.brand}` : ""}
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

          <Button className="w-full" onClick={submit} disabled={saving || create.isPending}>
            {saving || create.isPending ? "Salvando..." : "Registrar e imprimir recibo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Return confirmation dialog
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

// Delete confirmation dialog
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