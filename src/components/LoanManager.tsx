import { syncPatientRegistry } from "@/lib/patientRegistry";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlucometers, useLoans, type Loan } from "@/hooks/useLoans";
import { printLoanReceipt } from "@/lib/printLoan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  Phone,
  User,
  MapPin,
  CalendarDays,
  CreditCard,
  Activity,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { usePatients } from "@/hooks/usePatients";
import { useHealthUnits } from "@/hooks/useHealthUnits";
import type { Patient } from "@/hooks/useScheduling";
import { parseValidLocalDate, toLocalDateKey } from "@/lib/dateUtils";

function fmtBR(d?: string | null) {
  const parsed = parseValidLocalDate(d);
  if (!parsed) return "—";
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
}

function daysDiff(dateStr: string) {
  const target = parseValidLocalDate(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function totalLoanDays(startDateStr: string, endDateStr: string) {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseValidLocalDate(startDateStr);
  const end = parseValidLocalDate(endDateStr);
  if (!start || !end) return 0;
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/** Formata numero de telefone para link do WhatsApp (abre app no celular ou WhatsApp Web no desktop) */
function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://api.whatsapp.com/send?phone=${withCountry}`;
}

export default function LoanManager() {
  const loansQ = useLoans();
  const glucQ = useGlucometers();
  const { data: healthUnits = [] } = useHealthUnits();

  // Dialog states
  const [openNew, setOpenNew] = useState(false);
  const [renewLoan, setRenewLoan] = useState<Loan | null>(null);
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
  const overdue = active.filter((l) => {
    const diff = daysDiff(l.expected_return_date);
    return diff !== null && diff < 0;
  });

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
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="p-4 md:p-6 border-b bg-card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-primary" /> Painel de Empréstimos
            </h1>
            <p className="text-xs text-muted-foreground">
              Controle de glicosímetros emprestados às pacientes
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)} className="w-full sm:w-auto gap-1.5 shadow-sm justify-center">
            <Plus className="w-4 h-4" /> Novo Empréstimo
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="shadow-none border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{available}</p>
                <p className="text-xs text-emerald-700/80 font-medium">Aparelhos Disponíveis</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <HandCoins className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 tabular-nums">{loanedCount}</p>
                <p className="text-xs text-blue-700/80 font-medium">Emprestados (Ativos)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border-rose-500/20 bg-rose-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600 tabular-nums">{overdue.length}</p>
                <p className="text-xs text-rose-700/80 font-medium">Empréstimos Vencidos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Filter toolbar ───────────────────────────────────────────── */}
      <div className="bg-card px-4 md:px-6 py-2.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
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

          {activeTab !== "stock" && (
            <Select value={selectedPsf} onValueChange={setSelectedPsf}>
              <SelectTrigger className="w-full md:w-56 h-9 text-xs">
                <SelectValue placeholder="Filtrar por unidade (PSF)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Unidades (PSF)</SelectItem>
                {healthUnits.map((u) => (
                  <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(searchQuery || selectedPsf !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <FilterX className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {activeTab === "active" && `${filteredActive.length} empréstimo(s)`}
          {activeTab === "history" && `${filteredHistory.length} devolução(ões)`}
          {activeTab === "stock" && `${filteredGluc.length} aparelho(s)`}
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-card border-b px-4 md:px-6 py-0.5 overflow-x-auto no-scrollbar">
          <TabsList className="bg-transparent h-10 p-0 justify-start gap-4 flex shrink-0 whitespace-nowrap">
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
              Histórico
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
                {historyList.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="stock"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 text-sm font-medium shadow-none gap-1.5"
            >
              <HardDrive className="w-4 h-4" />
              Estoque
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
                {gluc.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab 1: Active Loans — CARD GRID ─────────────────────────── */}
        <TabsContent value="active" className="flex-1 overflow-auto p-4 md:p-6 m-0">
          {filteredActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-card border-dashed text-center gap-2">
              <SlidersHorizontal className="w-9 h-9 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum empréstimo ativo.</p>
              <Button variant="outline" size="sm" onClick={() => setOpenNew(true)} className="mt-1 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Registrar Empréstimo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredActive.map((l) => {
                const diff = daysDiff(l.expected_return_date);
                const patient = l.patient;
                const phone = (patient as any)?.phone as string | undefined;
                const cpf = (patient as any)?.cpf as string | undefined;
                const acs = (patient as any)?.acs as string | undefined;

                let statusColor = "emerald";
                let StatusIcon = CheckCircle2;
                let statusLabel = diff === null ? "Data de devolução inválida" : `Vence em ${diff} dias`;

                if (diff === null) {
                  statusColor = "slate";
                  StatusIcon = AlertTriangle;
                } else if (diff < 0) {
                  statusColor = "rose";
                  StatusIcon = AlertTriangle;
                  statusLabel = `Vencido há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}`;
                } else if (diff === 0) {
                  statusColor = "amber";
                  StatusIcon = Clock;
                  statusLabel = "Vence HOJE!";
                } else if (diff === 1) {
                  statusColor = "amber";
                  StatusIcon = Clock;
                  statusLabel = "Vence amanhã (1d)";
                } else if (diff <= 7) {
                  statusColor = "amber";
                  StatusIcon = Clock;
                  statusLabel = `Vence em ${diff} dias`;
                } else {
                  statusColor = "emerald";
                  StatusIcon = CheckCircle2;
                  statusLabel = `Vence em ${diff} dias`;
                }

                const statusClasses: Record<string, string> = {
                  emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-200/60 font-bold",
                  amber:   "bg-amber-500/10  text-amber-700  border-amber-200/60 font-bold",
                  rose:    "bg-rose-500/10   text-rose-700   border-rose-200/60 font-bold animate-pulse",
                };
                const cardBorder: Record<string, string> = {
                  emerald: "border-l-4 border-l-emerald-400",
                  amber:   "border-l-4 border-l-amber-400",
                  rose:    "border-l-4 border-l-rose-400",
                };

                return (
                  <Card key={l.id} className={`shadow-sm ${cardBorder[statusColor]} bg-card hover:shadow-md transition-shadow`}>
                    <CardContent className="p-4 space-y-3">
                      {/* Row 1: name + status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate leading-tight">
                              {patient?.name ?? "—"}
                            </p>
                            {patient?.psf && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {patient.psf}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge className={`flex-shrink-0 text-[10px] px-2 py-0.5 border font-semibold ${statusClasses[statusColor]}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusLabel}
                        </Badge>
                      </div>

                      {/* Separator */}
                      <div className="border-t border-dashed border-border/70" />

                      {/* Row 2: patient details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                        {cpf && (
                          <div className="flex items-center gap-1 text-muted-foreground col-span-2">
                            <CreditCard className="w-3 h-3 flex-shrink-0" />
                            <span className="font-mono">{cpf}</span>
                          </div>
                        )}
                        {phone && (
                          <a
                            href={whatsappLink(phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 col-span-2 font-medium hover:underline transition-colors"
                            title="Abrir no WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            {phone}
                          </a>
                        )}
                        {acs && (
                          <div className="flex items-center gap-1 text-muted-foreground col-span-2">
                            <Activity className="w-3 h-3 flex-shrink-0" />
                            <span>ACS: {acs}</span>
                          </div>
                        )}
                      </div>

                      {/* Row 3: Glucometer info & Prazo */}
                      <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Glicosímetro</p>
                          <p className="font-mono font-bold text-sm text-primary">{l.glucometer?.code ?? "—"}</p>
                          {l.glucometer?.brand && (
                            <p className="text-[10px] text-muted-foreground">{l.glucometer.brand}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Devolução Prevista</p>
                          <p className="flex items-center justify-end gap-1 text-xs font-bold text-foreground">
                            <CalendarDays className="w-3.5 h-3.5 text-primary" />
                            {fmtBR(l.expected_return_date)}
                          </p>
                          <p
                            className={cn(
                              "text-[11px] font-extrabold mt-0.5",
                              diff < 0
                                ? "text-rose-600 animate-pulse"
                                : diff === 0
                                ? "text-amber-600 font-black"
                                : diff <= 3
                                ? "text-amber-600"
                                : "text-emerald-700"
                            )}
                          >
                            {diff < 0
                              ? `⚠️ Vencido há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}`
                              : diff === 0
                              ? "⚡ Vence Hoje"
                              : diff === 1
                              ? "⏳ Falta 1 dia para vencer"
                              : `⏳ Faltam ${diff} dias para vencer`}
                          </p>
                          {l.loaned_at && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Saída: {fmtBR(l.loaned_at)} ({totalLoanDays(l.loaned_at, l.expected_return_date)} dias total)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {l.notes && (
                        <p className="text-[11px] text-muted-foreground italic border-l-2 border-muted pl-2">{l.notes}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 font-semibold"
                          onClick={() => setReturnLoan(l)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Devolver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "flex-1 h-8 text-xs gap-1.5 font-semibold transition-all",
                            diff < 0
                              ? "bg-amber-500/15 text-amber-800 border-amber-300 hover:bg-amber-500/25 shadow-xs"
                              : "text-sky-700 border-sky-200 hover:bg-sky-50"
                          )}
                          onClick={() => setRenewLoan(l)}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Renovar
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          title="Reimprimir Recibo"
                          onClick={() => printLoanReceipt(l)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/5 hover:border-destructive/40 shrink-0"
                          title="Excluir"
                          onClick={() => setDeleteLoan(l)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: History — TABLE ───────────────────────────────────── */}
        <TabsContent value="history" className="flex-1 overflow-auto p-4 md:p-6 m-0">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-card border-dashed text-center gap-2">
              <History className="w-9 h-9 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma devolução registrada.</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="font-semibold text-xs">Paciente</TableHead>
                    <TableHead className="font-semibold text-xs">Contato</TableHead>
                    <TableHead className="font-semibold text-xs">Glicosímetro</TableHead>
                    <TableHead className="font-semibold text-xs">Retirado em</TableHead>
                    <TableHead className="font-semibold text-xs">Devolvido em</TableHead>
                    <TableHead className="text-center w-20 font-semibold text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((l) => {
                    const patient = l.patient;
                    const phone = (patient as any)?.phone as string | undefined;
                    return (
                      <TableRow key={l.id} className="hover:bg-muted/5">
                        <TableCell>
                          <div className="font-semibold text-sm">{patient?.name ?? "—"}</div>
                          {patient?.psf && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5" /> {patient.psf}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {phone ? (
                            <a
                              href={whatsappLink(phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium hover:underline text-xs transition-colors"
                              title="Abrir no WhatsApp"
                            >
                              <Phone className="w-3 h-3" /> {phone}
                            </a>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
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
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Reimprimir Recibo"
                              onClick={() => printLoanReceipt(l)}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                              title="Excluir"
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

        {/* ── Tab 3: Glucometers Stock ─────────────────────────────────── */}
        <TabsContent value="stock" className="flex-1 overflow-auto p-4 md:p-6 m-0 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <AddGlucometerCard />
            </div>
            <div className="md:col-span-2">
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/15">
                  <h3 className="font-semibold text-sm">Aparelhos no Inventário</h3>
                  <p className="text-xs text-muted-foreground">Status atual de todos os glicosímetros cadastrados</p>
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
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{g.notes ?? "—"}</TableCell>
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

      {/* ── New Loan Dialog ─────────────────────────────────────────── */}
      <NewLoanDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={(loan) => {
          setOpenNew(false);
          printLoanReceipt(loan);
        }}
      />

      {/* ── Renew Loan Dialog ────────────────────────────────────────── */}
      <RenewLoanModal
        loan={renewLoan}
        open={!!renewLoan}
        onOpenChange={(o) => {
          if (!o) setRenewLoan(null);
        }}
      />

      {/* ── Return confirmation dialog ──────────────────────────────── */}
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

      {/* ── Delete confirmation dialog ──────────────────────────────── */}
      <AlertDialog open={!!deleteLoan} onOpenChange={(o) => !o && setDeleteLoan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empréstimo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se o empréstimo estiver ativo, o aparelho voltará para disponível.
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

// ─── AddGlucometerCard ───────────────────────────────────────────────────────
function AddGlucometerCard() {
  const { add } = useGlucometers();
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!code.trim()) { toast.error("Informe o código do aparelho"); return; }
    await add.mutateAsync({ code, brand, notes });
    setCode(""); setBrand(""); setNotes("");
  };

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Novo Aparelho</CardTitle>
        <CardDescription className="text-xs">Registre um novo glicosímetro no inventário</CardDescription>
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

// ─── NewLoanDialog ────────────────────────────────────────────────────────────
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

  const [name, setName] = useState("");
  const [susCard, setSusCard] = useState("");
  const [cpf, setCpf] = useState("");
  const [acs, setAcs] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [psf, setPsf] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [glucId, setGlucId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(name, 250);
  const effectiveSearch = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : "";
  const { patients: searchResults, isLoading: isSearching } = usePatients(effectiveSearch);

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

  const loanDurationDays = useMemo(() => {
    if (!expected) return null;
    const target = parseValidLocalDate(expected);
    if (!target) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }, [expected]);

  useEffect(() => {
    if (!open) {
      setName(""); setSusCard(""); setCpf(""); setAcs(""); setPhone("");
      setDob(""); setPsf(""); setSelectedPatient(null); setShowResults(false);
      setGlucId(""); setExpected(""); setNotes(""); setSaving(false);
    } else if (!expected) {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setExpected(d.toISOString().split("T")[0]);
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
    const d = parseValidLocalDate(dobStr);
    if (!d) return null;
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
    if (!name.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (!glucId || !expected) { toast.error("Preencha o glicosímetro e a data de devolução"); return; }
    setSaving(true);
    try {
      let patientId = selectedPatient?.id;
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
        if (error) { toast.error("Erro ao cadastrar paciente: " + error.message); setSaving(false); return; }
        patientId = data.id;
      } else {
        // Cadastro único compartilhado entre módulos
        await syncPatientRegistry(patientId!, {
          sus_card: susCard,
          cpf,
          acs,
          phone,
          dob,
          psf,
        });
      }
      const loan = await create.mutateAsync({
        patient_id: patientId!,
        glucometer_id: glucId,
        expected_return_date: expected,
        notes: notes.trim() || null,
      });
      onCreated(loan);
    } catch { /* errors already toasted by mutateAsync */ }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Empréstimo</DialogTitle>
          <DialogDescription>
            Digite o nome da paciente. Se ela já existir, selecione na lista. Caso contrário, preencha
            os dados abaixo e ela será cadastrada automaticamente ao salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Patient name with live search ── */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold uppercase tracking-wide">Nome da Paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Digite o nome para buscar ou cadastrar..."
                value={name}
                onChange={(e) => { setName(e.target.value); setShowResults(true); if (!e.target.value) setSelectedPatient(null); }}
                onFocus={() => { if (name) setShowResults(true); }}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
            </div>
            {showResults && effectiveSearch && (
              <ScrollArea className="absolute z-50 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-56">
                {isSearching ? (
                  <div className="px-3 py-4 text-sm text-center text-muted-foreground">Buscando...</div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                    Paciente não encontrada — preencha os dados abaixo para cadastrá-la.
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
                          {p.dob && <span className="text-xs text-muted-foreground mt-0.5">Nasc: {fmtBR(p.dob)}</span>}
                        </div>
                        {p.sus_card && <span className="text-xs text-muted-foreground font-mono">{p.sus_card}</span>}
                      </div>
                    );
                  })
                )}
              </ScrollArea>
            )}
          </div>

          {/* ── Patient details ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Cartão SUS</Label>
              <Input placeholder="Nº do cartão SUS" value={susCard} onChange={(e) => setSusCard(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">CPF</Label>
              <Input placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp / Telefone
              </Label>
              <Input placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">ACS (Agente Comunitário)</Label>
              <Input placeholder="Nome do ACS" value={acs} onChange={(e) => setAcs(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">Data de Nascimento</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide">PSF / UBS</Label>
              <Select value={psf} onValueChange={setPsf}>
                <SelectTrigger><SelectValue placeholder="Selecionar unidade..." /></SelectTrigger>
                <SelectContent>
                  {healthUnits.map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <hr className="border-border" />

          {/* ── Loan details & Return date ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Glicosímetro disponível ({available.length})
            </Label>
            <Select value={glucId} onValueChange={setGlucId}>
              <SelectTrigger><SelectValue placeholder="Selecionar glicosímetro" /></SelectTrigger>
              <SelectContent>
                {available.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum aparelho disponível</div>
                )}
                {available.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.code}{g.brand ? ` — ${g.brand}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                <CalendarDays className="w-4 h-4 text-primary" /> Data Prevista de Devolução
              </Label>
              {loanDurationDays !== null && loanDurationDays > 0 && (
                <Badge variant="outline" className="text-[11px] font-extrabold bg-primary/10 text-primary border-primary/30 px-2 py-0.5">
                  ⏱️ {loanDurationDays} {loanDurationDays === 1 ? "dia" : "dias"} de empréstimo
                </Badge>
              )}
            </div>

            <Input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="bg-background font-medium"
            />

            {/* Dynamic summary banner */}
            {expected && loanDurationDays !== null && (
              <div
                className={cn(
                  "p-2.5 rounded-lg border text-xs flex items-center justify-between font-semibold mt-2 shadow-xs transition-colors",
                  loanDurationDays > 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                    : loanDurationDays === 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-800"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800"
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    {loanDurationDays > 0
                      ? `Devolução em ${fmtBR(expected)} — Empréstimo de ${loanDurationDays} ${loanDurationDays === 1 ? "dia" : "dias"}`
                      : loanDurationDays === 0
                      ? "Devolução prevista para HOJE"
                      : `Atenção: A data escolhida já passou (${Math.abs(loanDurationDays)} dias atrás)`}
                  </span>
                </div>
              </div>
            )}
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

// ─── RenewLoanModal ──────────────────────────────────────────────────────────
function RenewLoanModal({
  loan,
  open,
  onOpenChange,
}: {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { renew } = useLoans();
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loan) {
      const today = new Date();
      const currentExpected = parseValidLocalDate(loan.expected_return_date);
      const baseDate = currentExpected && currentExpected > today ? currentExpected : today;
      baseDate.setDate(baseDate.getDate() + 14);
      setNewDate(toLocalDateKey(baseDate) ?? "");
    }
  }, [loan, open]);

  const durationDays = useMemo(() => {
    if (!newDate) return null;
    const target = parseValidLocalDate(newDate);
    if (!target) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }, [newDate]);

  const handleRenewSubmit = async () => {
    if (!loan || !newDate) return;
    setSaving(true);
    try {
      await renew.mutateAsync({
        id: loan.id,
        expected_return_date: newDate,
      });
      onOpenChange(false);
    } catch {
      // Toast handles errors
    } finally {
      setSaving(false);
    }
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <RefreshCw className="w-5 h-5 text-primary" /> Renovar Prazo de Empréstimo
          </DialogTitle>
          <DialogDescription>
            Escolha no calendário a nova data prevista para a devolução do glicosímetro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted/40 rounded-xl border space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Paciente:</span>
              <span className="font-bold text-foreground">{loan.patient?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Glicosímetro:</span>
              <span className="font-mono font-bold text-primary">{loan.glucometer?.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Prazo Anterior:</span>
              <span className="font-bold text-muted-foreground">{fmtBR(loan.expected_return_date)}</span>
            </div>
          </div>

          <div className="space-y-2 p-3 bg-background rounded-xl border border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                <CalendarDays className="w-4 h-4 text-primary" /> Nova Data de Devolução
              </Label>
              {durationDays !== null && durationDays > 0 && (
                <Badge variant="outline" className="text-[11px] font-extrabold bg-sky-500/10 text-sky-700 border-sky-300 px-2 py-0.5">
                  ⏱️ {durationDays} {durationDays === 1 ? "dia" : "dias"} a partir de hoje
                </Badge>
              )}
            </div>

            <Input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="bg-background font-medium"
            />

            {newDate && durationDays !== null && (
              <div
                className={cn(
                  "p-2.5 rounded-lg border text-xs flex items-center justify-between font-semibold mt-2 shadow-xs transition-colors",
                  durationDays > 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                    : durationDays === 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-800"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800"
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    {durationDays > 0
                      ? `Novo prazo até ${fmtBR(newDate)} (mais ${durationDays} ${durationDays === 1 ? "dia" : "dias"})`
                      : durationDays === 0
                      ? "Prazo renovado para HOJE"
                      : `Atenção: A nova data já passou (${Math.abs(durationDays)} dias atrás)`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleRenewSubmit}
              disabled={saving || renew.isPending || !newDate}
              className="gap-1.5 font-bold"
            >
              <RefreshCw className="w-4 h-4" />
              {saving || renew.isPending ? "Renovando..." : "Confirmar Renovação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReturnConfirm ────────────────────────────────────────────────────────────
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

// ─── DeleteConfirm ────────────────────────────────────────────────────────────
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