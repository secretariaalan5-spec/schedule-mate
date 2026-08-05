import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImplanon, type ImplanonRecord } from "@/hooks/useImplanon";
import { useHealthUnits } from "@/hooks/useHealthUnits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatValidLocalDate } from "@/lib/dateUtils";
import { useDebounce } from "@/hooks/use-debounce";
import { printImplanonReport } from "@/lib/printImplanon";
import { toast } from "sonner";
import {
  Syringe,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  FileClock,
  Trash2,
  Building2,
  ChevronDown,
  ChevronRight,
  Phone,
  MapPin,
  Cake,
  BadgeCheck,
  UserCheck,
  UserPlus,
  FileDown,
  ClipboardList,
  Filter,
} from "lucide-react";

const db = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

/* ─── helpers ─────────────────────────────────────────────────────────── */
function daysUntil(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/* ─── types ────────────────────────────────────────────────────────────── */
function maskCpf(value: string): string {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

type PatientLite = {
  id: string;
  name: string;
  cpf: string | null;
  sus_card: string | null;
  phone: string | null;
  dob: string | null;
  psf: string | null;
  address: string | null;
  neighborhood: string | null;
};

/* ─── Status badges ─────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Aguardando liberação", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  released: { label: "Liberado", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  applied:  { label: "Aplicado",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  removed:  { label: "Retirado",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const SEM_UNIDADE = "— Sem unidade definida";

function groupByUnit(records: ImplanonRecord[]): Map<string, ImplanonRecord[]> {
  const map = new Map<string, ImplanonRecord[]>();
  for (const r of records) {
    const key = r.patient?.psf?.trim() || SEM_UNIDADE;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      if (a === SEM_UNIDADE) return 1;
      if (b === SEM_UNIDADE) return -1;
      return a.localeCompare(b, "pt-BR");
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ImplanonManager
═══════════════════════════════════════════════════════════════════════ */
export default function ImplanonManager() {
  const { data, isLoading, create, update, remove } = useImplanon();
  const [open, setOpen]             = useState(false);
  const [search, setSearch]         = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo]     = useState("");
  const [applyDates, setApplyDates] = useState<Record<string, string>>({});
  const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());

  /* ── form state ──────────────────────────────────────────────────── */
  const [nameTerm, setNameTerm]         = useState("");        // o que o user está digitando
  const [matchedPatient, setMatchedPatient] = useState<PatientLite | null>(null); // paciente encontrada
  const [showDropdown, setShowDropdown] = useState(false);
  const [cpf, setCpf]                   = useState("");
  const [phone, setPhone]               = useState("");
  const [psf, setPsf]                   = useState("");
  const [releasedAt, setReleasedAt]     = useState(today());
  const [initialStatus, setInitialStatus] = useState<"pending" | "released">("pending");
  const [indication, setIndication]     = useState("");
  const [saving, setSaving]             = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: healthUnits } = useHealthUnits();

  /* autocomplete search */
  const debouncedName = useDebounce(nameTerm, 280);
  const { data: suggestions } = useQuery({
    queryKey: ["implanon-name-search", debouncedName],
    enabled: debouncedName.trim().length >= 2 && !matchedPatient,
    queryFn: async () => {
      const safe = debouncedName.replace(/[,()\"']/g, " ").trim();
      const { data, error } = await db
        .from("patients")
        .select("id,name,cpf,sus_card,phone,dob,psf,address,neighborhood")
        .ilike("name", `%${safe}%`)
        .order("name")
        .limit(6);
      if (error) throw error;
      return (data ?? []) as PatientLite[];
    },
  });

  const records    = data ?? [];
  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of healthUnits ?? []) if (u.name?.trim()) set.add(u.name.trim());
    for (const r of records) {
      const u = r.patient?.psf?.trim();
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records, healthUnits]);

  const indicators = useMemo(() => {
    const applied    = records.filter((r) => r.status === "applied");
    const expiring   = applied.filter((r) => { const d = daysUntil(r.expected_removal_at); return d !== null && d >= 0 && d <= 90; });
    const overdue    = applied.filter((r) => { const d = daysUntil(r.expected_removal_at); return d !== null && d < 0; });
    const lotExpiring = records.filter((r) => { const d = daysUntil(r.lot_expiry); return r.status !== "removed" && d !== null && d <= 60; });
    return {
      pending:     records.filter((r) => r.status === "pending").length,
      released:    records.filter((r) => r.status === "released").length,
      applied:     applied.length,
      removed:     records.filter((r) => r.status === "removed").length,
      expiring:    expiring.length,
      overdue:     overdue.length,
      lotExpiring: lotExpiring.length,
    };
  }, [records]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return records.filter((r) => {
      if (filterUnit !== "all") {
        const unit = r.patient?.psf?.trim() || SEM_UNIDADE;
        if (unit !== filterUnit) return false;
      }
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      const ref = r.applied_at ?? r.released_at ?? (r.created_at ?? "").slice(0, 10);
      if (filterFrom && (!ref || ref < filterFrom)) return false;
      if (filterTo && (!ref || ref > filterTo)) return false;
      if (t) return (
        r.patient?.name?.toLowerCase().includes(t) ||
        (r.lot ?? "").toLowerCase().includes(t) ||
        (r.professional ?? "").toLowerCase().includes(t) ||
        (r.notes ?? "").toLowerCase().includes(t) ||
        (r.patient?.psf ?? "").toLowerCase().includes(t)
      );
      return true;
    });
  }, [records, search, filterUnit, filterStatus, filterFrom, filterTo]);

  const groupedFiltered = useMemo(() => groupByUnit(filtered), [filtered]);

  /* select patient from dropdown */
  const selectPatient = (p: PatientLite) => {
    setMatchedPatient(p);
    setNameTerm(p.name);
    setCpf(maskCpf(p.cpf ?? ""));
    setPhone(p.phone ?? "");
    setPsf(p.psf ?? "");
    setShowDropdown(false);
  };

  /* clear selection */
  const clearPatient = () => {
    setMatchedPatient(null);
    setNameTerm("");
    setCpf("");
    setPhone("");
    setPsf("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /* reset whole dialog */
  const resetDialog = () => {
    setMatchedPatient(null);
    setNameTerm("");
    setCpf("");
    setPhone("");
    setPsf("");
    setReleasedAt(today());
    setInitialStatus("pending");
    setIndication("");
  };

  const toggleUnit = (unit: string) => {
    setCollapsedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  };

  /* ── submit ─────────────────────────────────────────────────────── */
  const submit = async () => {
    const nameClean  = nameTerm.trim();
    if (!nameClean) { toast.error("Informe o nome da paciente"); return; }

    setSaving(true);
    try {
      let patientId: string;

      if (matchedPatient) {
        /* paciente já existe — usa o ID dela */
        patientId = matchedPatient.id;
        /* atualiza contato/unidade se o usuário mudou */
        const updates: Record<string, unknown> = {};
        const cpfClean = cpf.replace(/\D/g, "") || null;
        if (cpfClean && cpfClean !== (matchedPatient.cpf ?? "").replace(/\D/g, "")) {
          updates.cpf = cpfClean;
        }
        if (phone && phone !== matchedPatient.phone) updates.phone = phone.replace(/\D/g, "");
        if (psf  && psf  !== matchedPatient.psf)   updates.psf   = psf.trim();
        if (Object.keys(updates).length) {
          const { error: upErr } = await db.from("patients").update(updates).eq("id", patientId);
          if (upErr) throw upErr;
        }
      } else {
        /* nova paciente — verifica duplicata por CPF antes de inserir */
        const cpfClean = cpf.replace(/\D/g, "") || null;
        let existingId: string | null = null;

        if (cpfClean) {
          const { data: found } = await db
            .from("patients")
            .select("id")
            .eq("cpf", cpfClean)
            .maybeSingle();
          if (found) existingId = found.id;
        }

        if (existingId) {
          patientId = existingId;
          await db.from("patients").update({
            name:  nameClean,
            cpf:   cpfClean,
            phone: phone.replace(/\D/g, "") || null,
            psf:   psf.trim() || null,
          }).eq("id", existingId);
        } else {
          const { data: inserted, error } = await db
            .from("patients")
            .insert({
              name:  nameClean,
              cpf:   cpfClean,
              phone: phone.replace(/\D/g, "") || null,
              psf:   psf.trim() || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          patientId = inserted.id;
        }
      }

      /* cria o registro de implanon */
      await create.mutateAsync({
        patient_id:  patientId,
        released_at: initialStatus === "released" ? (releasedAt || today()) : null,
        status: initialStatus,
        notes: indication.trim() || null,
        health_unit_id: healthUnits?.find((u) => u.name === psf)?.id ?? null,
      } as any);

      setOpen(false);
      resetDialog();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  /* ── KPI cards ──────────────────────────────────────────────────── */
  const kpiCards = [
    { label: "Aguardando",      value: indicators.pending,     icon: ClipboardList,cls: "text-amber-600 bg-amber-50" },
    { label: "Liberados",       value: indicators.released,    icon: FileClock,    cls: "text-sky-600 bg-sky-50" },
    { label: "Aplicados ativos",value: indicators.applied,     icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50" },
    { label: "Retirada próxima",value: indicators.expiring,    icon: CalendarClock,cls: "text-amber-600 bg-amber-50" },
    { label: "Retirada vencida",value: indicators.overdue,     icon: AlertTriangle,cls: "text-red-600 bg-red-50" },
    { label: "Retirados",       value: indicators.removed,     icon: Syringe,      cls: "text-slate-600 bg-slate-100" },
  ];

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-lg leading-tight">Implanon</h2>
            <p className="text-xs text-muted-foreground">Liberação, aplicação e retirada por unidade de saúde</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => printImplanonReport(filtered, { unit: filterUnit, status: filterStatus, search })}
          >
            <FileDown className="w-4 h-4" /> Exportar PDF
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo registro
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">

        {/* ── KPI Cards ───────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpiCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-xl border border-border bg-white p-3 shadow-sm">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", c.cls)}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-2xl font-black leading-none">{c.value}</p>
                <p className="text-[11px] font-semibold text-muted-foreground mt-1">{c.label}</p>
              </div>
            );
          })}
        </section>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-white p-3 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Filter className="w-3.5 h-3.5" /> Filtros
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por paciente, lote, profissional, indicação ou unidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="md:w-56">
                <Building2 className="w-4 h-4 text-muted-foreground mr-1 shrink-0" />
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {unitOptions.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
                <SelectItem value={SEM_UNIDADE}>Sem unidade definida</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder="Todas as situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="pending">Aguardando liberação</SelectItem>
                <SelectItem value="released">Liberado</SelectItem>
                <SelectItem value="applied">Aplicado</SelectItem>
                <SelectItem value="removed">Retirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">De</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="md:w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Até</Label>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="md:w-40" />
            </div>
            {(filterUnit !== "all" || filterStatus !== "all" || search || filterFrom || filterTo) && (
              <Button
                variant="ghost"
                onClick={() => { setSearch(""); setFilterUnit("all"); setFilterStatus("all"); setFilterFrom(""); setFilterTo(""); }}
              >
                Limpar
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} registro(s) encontrados — a exportação em PDF segue estes filtros.
          </p>
        </div>

        {/* ── Records list ────────────────────────────────────────────── */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando registros...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhum registro encontrado.</p>
        ) : (
          <div className="space-y-6">
            {[...groupedFiltered.entries()].map(([unit, unitRecords]) => {
              const isCollapsed  = collapsedUnits.has(unit);
              const isSemUnidade = unit === SEM_UNIDADE;
              return (
                <section key={unit}>
                  <button
                    type="button"
                    onClick={() => toggleUnit(unit)}
                    className="w-full flex items-center gap-2 mb-3 group"
                  >
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider",
                      isSemUnidade
                        ? "bg-slate-50 border-slate-200 text-slate-500"
                        : "bg-primary/5 border-primary/20 text-primary",
                    )}>
                      <Building2 className="w-3.5 h-3.5" />
                      {unit}
                      <span className={cn(
                        "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black",
                        isSemUnidade ? "bg-slate-200 text-slate-600" : "bg-primary/15 text-primary",
                      )}>
                        {unitRecords.length}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown  className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2 pl-1">
                      {unitRecords.map((r) => {
                        const meta   = STATUS_META[r.status] ?? STATUS_META.released;
                        const d      = daysUntil(r.expected_removal_at);
                        const patAge = calcAge(r.patient?.dob);
                        return (
                          <article key={r.id} className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col md:flex-row">
                            <span
                              className={cn(
                                "w-full h-1 md:h-auto md:w-1.5 shrink-0",
                                r.status === "applied" ? "bg-emerald-500"
                                  : r.status === "removed" ? "bg-slate-300"
                                  : r.status === "pending" ? "bg-amber-400" : "bg-primary",
                              )}
                              aria-hidden
                            />
                            <div className="flex-1 min-w-0 p-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm truncate">{r.patient?.name ?? "Paciente"}</h3>
                                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", meta.cls)}>
                                  {meta.label}
                                </span>
                                {r.status === "applied" && d !== null && d < 0 && (
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                                    Retirada vencida
                                  </span>
                                )}
                                {r.status === "applied" && d !== null && d >= 0 && d <= 90 && (
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                    Retirada em {d}d
                                  </span>
                                )}
                              </div>

                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                                {r.patient?.cpf && <span className="flex items-center gap-1"><BadgeCheck className="w-3 h-3" />CPF: {r.patient.cpf}</span>}
                                {patAge !== null && <span className="flex items-center gap-1"><Cake className="w-3 h-3" />{patAge} anos</span>}
                                {r.patient?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.patient.phone}</span>}
                                {(r.patient?.address || r.patient?.neighborhood) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {[r.patient.address, r.patient.neighborhood].filter(Boolean).join(", ")}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                <span>Liberação: {formatValidLocalDate(r.released_at, "dd/MM/yyyy")}</span>
                                <span>Aplicação: {formatValidLocalDate(r.applied_at, "dd/MM/yyyy")}</span>
                                <span>Lote: {r.lot ?? "—"}</span>
                                <span>Validade: {formatValidLocalDate(r.lot_expiry, "dd/MM/yyyy")}</span>
                                <span>Prev. retirada: {formatValidLocalDate(r.expected_removal_at, "dd/MM/yyyy")}</span>
                                <span>Retirada: {formatValidLocalDate(r.removed_at, "dd/MM/yyyy")}</span>
                                <span className="md:col-span-2">Prof.: {r.professional ?? "—"}</span>
                              </div>

                              {r.notes && (
                                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-foreground/80 bg-muted/50 border border-border rounded-lg px-2.5 py-1.5">
                                  <ClipboardList className="w-3.5 h-3.5 mt-[1px] shrink-0 text-primary" />
                                  <span><b className="font-semibold">Indicação:</b> {r.notes}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 px-4 pb-4 md:py-4 md:pl-0 flex-wrap">
                              {r.status === "pending" && (
                                <Button size="sm" onClick={() => update.mutate({ id: r.id, updates: { released_at: today() } })}>
                                  Liberar
                                </Button>
                              )}
                              {r.status === "released" && (
                                <>
                                  <Input
                                    type="date"
                                    className="h-8 w-[140px] text-xs"
                                    value={applyDates[r.id] ?? today()}
                                    onChange={(e) => setApplyDates((p) => ({ ...p, [r.id]: e.target.value }))}
                                    title="Data de aplicação informada pelo posto"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      update.mutate({ id: r.id, updates: { applied_at: applyDates[r.id] || today() } })
                                    }
                                  >
                                    Aplicar
                                  </Button>
                                </>
                              )}
                              {r.status === "applied" && (
                                <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: r.id, updates: { removed_at: today() } })}>
                                  Registrar retirada
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)} title="Excluir">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          Dialog — Novo registro
      ══════════════════════════════════════════════════════════════ */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="w-4 h-4 text-primary" />
              Novo registro de Implanon
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">

            {/* ── Nome com autocomplete ────────────────────────────── */}
            <div className="space-y-1">
              <Label>Nome da paciente <span className="text-destructive">*</span></Label>

              {matchedPatient ? (
                /* Paciente selecionada — exibe card compacto */
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-900 truncate">{matchedPatient.name}</p>
                    <p className="text-[11px] text-emerald-700 truncate">
                      Cadastro existente {matchedPatient.psf ? `· ${matchedPatient.psf}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPatient}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 shrink-0 underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                /* Campo de busca + dropdown */
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      className="pl-9"
                      placeholder="Digite o nome da paciente..."
                      value={nameTerm}
                      onChange={(e) => { setNameTerm(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                      autoFocus
                    />
                  </div>

                  {/* Dropdown de sugestões */}
                  {showDropdown && (suggestions ?? []).length > 0 && (
                    <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-white shadow-lg divide-y overflow-hidden">
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40">
                        Pacientes cadastradas
                      </p>
                      {(suggestions ?? []).map((p) => {
                        const age = calcAge(p.dob);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => selectPatient(p)}
                            className="w-full text-left px-3 py-2.5 hover:bg-primary/5 transition-colors flex items-center gap-2"
                          >
                            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {p.cpf ? `CPF ${p.cpf}` : "Sem CPF"}
                                {age !== null ? ` · ${age} anos` : ""}
                                {p.psf ? ` · ${p.psf}` : ""}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Indicador de nova paciente */}
                  {nameTerm.trim().length >= 2 && (suggestions ?? []).length === 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <UserPlus className="w-3.5 h-3.5 text-primary" />
                      <span>Nova paciente — será cadastrada ao salvar</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CPF ──────────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                placeholder="000.000.000-00"
                value={cpf}
                inputMode="numeric"
                maxLength={14}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
              />
              {matchedPatient && (
                <p className="text-[11px] text-muted-foreground">
                  Alterar o CPF atualiza o cadastro da paciente.
                </p>
              )}
            </div>

            {/* ── Contato ───────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label>Telefone / Contato</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* ── Unidade de Saúde ──────────────────────────────────── */}
            <div className="space-y-1">
              <Label>Unidade de Saúde (PSF/UBS)</Label>
              <Select value={psf || "none"} onValueChange={(v) => setPsf(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem unidade definida</SelectItem>
                  {(healthUnits ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                  {psf && !(healthUnits ?? []).some((u) => u.name === psf) && (
                    <SelectItem value={psf}>{psf}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ── Situação inicial ──────────────────────────────────── */}
            <div className="space-y-1">
              <Label>Situação inicial</Label>
              <Select value={initialStatus} onValueChange={(v) => setInitialStatus(v as "pending" | "released")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Aguardando liberação (lista do posto)</SelectItem>
                  <SelectItem value="released">Já liberado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {initialStatus === "released" && (
              <div className="space-y-1">
                <Label>Data de liberação</Label>
                <Input
                  type="date"
                  value={releasedAt}
                  onChange={(e) => setReleasedAt(e.target.value)}
                />
              </div>
            )}

            {/* ── Indicação ─────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label>Indicação</Label>
              <Input
                placeholder="Ex.: planejamento familiar, contraindicação a estrogênio..."
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving || !nameTerm.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
