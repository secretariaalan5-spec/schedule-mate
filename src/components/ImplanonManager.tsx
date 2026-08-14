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
import { addYearsToLocalDateKey, formatValidLocalDate, parseValidLocalDate } from "@/lib/dateUtils";
import { useDebounce } from "@/hooks/use-debounce";
import { printImplanonReport, printImplanonRecord } from "@/lib/printImplanon";
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
  Printer,
  Pencil,
} from "lucide-react";

const db = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

/* ─── helpers ─────────────────────────────────────────────────────────── */
function daysUntil(date: string | null) {
  const d = parseValidLocalDate(date);
  if (!d) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

function calcAge(dob: string | null | undefined): number | null {
  const birth = parseValidLocalDate(dob);
  if (!birth) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function formatRemainingTime(dateStr: string | null | undefined): { text: string; isExpired: boolean; isSoon: boolean; days: number } | null {
  const target = parseValidLocalDate(dateStr);
  if (!target) return null;

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const diffTime = target.getTime() - now.getTime();
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) {
    const absDays = Math.abs(days);
    if (absDays >= 365) {
      const years = Math.floor(absDays / 365);
      const months = Math.floor((absDays % 365) / 30);
      const yearStr = years > 1 ? `${years} anos` : `${years} ano`;
      const monthStr = months > 0 ? ` e ${months} ${months > 1 ? "meses" : "mês"}` : "";
      return { text: `Vencido há ${yearStr}${monthStr} (${absDays} dias)`, isExpired: true, isSoon: false, days };
    }
    if (absDays >= 30) {
      const months = Math.floor(absDays / 30);
      const monthStr = months > 1 ? `${months} meses` : `${months} mês`;
      return { text: `Vencido há ${monthStr} (${absDays} dias)`, isExpired: true, isSoon: false, days };
    }
    return { text: `Vencido há ${absDays} ${absDays === 1 ? "dia" : "dias"}`, isExpired: true, isSoon: false, days };
  }

  if (days === 0) {
    return { text: "Vence hoje!", isExpired: false, isSoon: true, days: 0 };
  }

  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const yearStr = years > 1 ? `${years} anos` : `${years} ano`;
    const monthStr = months > 0 ? ` e ${months} ${months > 1 ? "meses" : "mês"}` : "";
    return { text: `Faltam ${yearStr}${monthStr} (${days} dias)`, isExpired: false, isSoon: false, days };
  }

  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    const dayStr = remainingDays > 0 ? ` e ${remainingDays}d` : "";
    return { text: `Faltam ${months} ${months > 1 ? "meses" : "mês"}${dayStr} (${days} dias)`, isExpired: false, isSoon: days <= 90, days };
  }

  return { text: `Faltam ${days} ${days === 1 ? "dia" : "dias"}`, isExpired: false, isSoon: true, days };
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
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ImplanonRecord | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  /* ── form state ──────────────────────────────────────────────────── */
  const [nameTerm, setNameTerm]         = useState("");
  const [matchedPatient, setMatchedPatient] = useState<PatientLite | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cpf, setCpf]                   = useState("");
  const [dob, setDob]                   = useState("");
  const [phone, setPhone]               = useState("");
  const [psf, setPsf]                   = useState("");
  const [initialStatus, setInitialStatus] = useState<"pending" | "released" | "applied">("pending");
  const [releasedAt, setReleasedAt]     = useState(today());
  const [appliedAt, setAppliedAt]       = useState("");
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
    const applied  = records.filter((r) => r.status === "applied");
    const expiring = applied.filter((r) => { const d = daysUntil(r.expected_removal_at); return d !== null && d >= 0 && d <= 90; });
    const overdue  = applied.filter((r) => { const d = daysUntil(r.expected_removal_at); return d !== null && d < 0; });
    return {
      pending:  records.filter((r) => r.status === "pending").length,
      released: records.filter((r) => r.status === "released").length,
      applied:  applied.length,
      removed:  records.filter((r) => r.status === "removed").length,
      expiring: expiring.length,
      overdue:  overdue.length,
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
    setDob(p.dob ?? "");
    setPhone(p.phone ?? "");
    setPsf(p.psf ?? "");
    setShowDropdown(false);
  };

  /* clear selection */
  const clearPatient = () => {
    setMatchedPatient(null);
    setNameTerm("");
    setCpf("");
    setDob("");
    setPhone("");
    setPsf("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /* reset whole dialog */
  const resetDialog = () => {
    setMatchedPatient(null);
    setNameTerm("");
    setCpf("");
    setDob("");
    setPhone("");
    setPsf("");
    setInitialStatus("pending");
    setReleasedAt(today());
    setAppliedAt("");
    setIndication("");
  };

  /* auto-compute expected removal: applied + 3 years */
  const computedRemoval = useMemo(() => {
    const refDate = appliedAt || today();
    return addYearsToLocalDateKey(refDate, 3);
  }, [appliedAt]);

  const toggleUnit = (unit: string) => {
    setCollapsedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  };

  const toggleRecord = (id: string) => {
    setExpandedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (r: ImplanonRecord) => {
    setEditing(r);
    setEditForm({
      name: r.patient?.name ?? "",
      cpf: maskCpf(r.patient?.cpf ?? ""),
      dob: r.patient?.dob ?? "",
      psf: r.patient?.psf ?? "",
      phone: r.patient?.phone ?? "",
      status: r.status,
      released_at: r.released_at ?? "",
      applied_at: r.applied_at ?? "",
      expected_removal_at: r.expected_removal_at ?? "",
      removed_at: r.removed_at ?? "",
      notes: r.notes ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const v = (k: string) => (editForm[k]?.trim() ? editForm[k].trim() : null);

    if (editing.patient_id) {
      const patientUpdates: Record<string, any> = {};
      if (editForm.name?.trim()) patientUpdates.name = editForm.name.trim();
      const cpfClean = editForm.cpf ? editForm.cpf.replace(/\D/g, "") : null;
      patientUpdates.cpf = cpfClean;
      patientUpdates.dob = v("dob");
      patientUpdates.psf = v("psf");
      patientUpdates.phone = editForm.phone ? editForm.phone.replace(/\D/g, "") : null;
      await db.from("patients").update(patientUpdates).eq("id", editing.patient_id);
    }

    await update.mutateAsync({
      id: editing.id,
      updates: {
        status: (editForm.status as ImplanonRecord["status"]) || editing.status,
        released_at: v("released_at"),
        applied_at: v("applied_at"),
        expected_removal_at: v("expected_removal_at"),
        removed_at: v("removed_at"),
        notes: v("notes"),
        health_unit_id: healthUnits?.find((u) => u.name === editForm.psf)?.id ?? editing.health_unit_id,
      },
    });
    setEditing(null);
  };

  /* ── submit ─────────────────────────────────────────────────────── */
  const submit = async () => {
    const nameClean  = nameTerm.trim();
    if (!nameClean) { toast.error("Informe o nome da paciente"); return; }

    setSaving(true);
    try {
      let patientId: string;

      if (matchedPatient) {
        patientId = matchedPatient.id;
        const updates: Record<string, unknown> = {};
        const cpfClean = cpf.replace(/\D/g, "") || null;
        if (cpfClean && cpfClean !== (matchedPatient.cpf ?? "").replace(/\D/g, "")) {
          updates.cpf = cpfClean;
        }
        if (dob && dob !== matchedPatient.dob) updates.dob = dob;
        if (phone && phone !== matchedPatient.phone) updates.phone = phone.replace(/\D/g, "");
        if (psf  && psf  !== matchedPatient.psf)   updates.psf   = psf.trim();
        if (Object.keys(updates).length) {
          const { error: upErr } = await db.from("patients").update(updates).eq("id", patientId);
          if (upErr) throw upErr;
        }
      } else {
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
            dob:   dob || null,
            phone: phone.replace(/\D/g, "") || null,
            psf:   psf.trim() || null,
          }).eq("id", existingId);
        } else {
          const { data: inserted, error } = await db
            .from("patients")
            .insert({
              name:  nameClean,
              cpf:   cpfClean,
              dob:   dob || null,
              phone: phone.replace(/\D/g, "") || null,
              psf:   psf.trim() || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          patientId = inserted.id;
        }
      }

      await create.mutateAsync({
        patient_id:  patientId,
        released_at: (initialStatus === "released" || initialStatus === "applied") ? (releasedAt || today()) : null,
        applied_at:  initialStatus === "applied" ? (appliedAt || today()) : null,
        expected_removal_at: initialStatus === "applied" ? computedRemoval : null,
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
    { label: "Aguardando liberação", value: indicators.pending,  icon: ClipboardList, cls: "text-amber-600 bg-amber-50" },
    { label: "Liberados",            value: indicators.released, icon: FileClock,     cls: "text-sky-600 bg-sky-50" },
    { label: "Aplicados ativos",     value: indicators.applied,  icon: CheckCircle2,  cls: "text-emerald-600 bg-emerald-50" },
    { label: "Vencendo (até 90d)",   value: indicators.expiring, icon: CalendarClock, cls: "text-amber-600 bg-amber-50" },
    { label: "Retirada vencida",     value: indicators.overdue,  icon: AlertTriangle, cls: "text-red-600 bg-red-50" },
    { label: "Retirados",            value: indicators.removed,  icon: Syringe,       cls: "text-slate-600 bg-slate-100" },
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
            <p className="text-xs text-muted-foreground">Liberação, aplicação (validade de 3 anos) e retirada por unidade de saúde</p>
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
                placeholder="Buscar por paciente, indicação ou unidade..."
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
                        const remaining = r.status === "applied" ? formatRemainingTime(r.expected_removal_at) : null;
                        const patAge = calcAge(r.patient?.dob);
                        const isExpanded = expandedRecords.has(r.id);
                        const timeline =
                          r.status === "pending" ? null
                          : r.status === "released" ? `Liberado em ${formatValidLocalDate(r.released_at, "dd/MM/yyyy")}`
                          : r.status === "applied" ? `Aplicado em ${formatValidLocalDate(r.applied_at, "dd/MM/yyyy")} · Validade (3 anos) até ${formatValidLocalDate(r.expected_removal_at, "dd/MM/yyyy")}`
                          : `Retirado em ${formatValidLocalDate(r.removed_at, "dd/MM/yyyy")}`;
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
                            <div className="flex-1 min-w-0 px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm truncate">{r.patient?.name ?? "Paciente"}</h3>
                                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", meta.cls)}>
                                  {meta.label}
                                </span>
                                {r.status === "applied" && remaining && (
                                  <span className={cn(
                                    "text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5",
                                    remaining.isExpired
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : remaining.isSoon
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  )}>
                                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                                    {remaining.text}
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                {r.patient?.cpf && <span className="flex items-center gap-1"><BadgeCheck className="w-3 h-3" />{maskCpf(r.patient.cpf)}</span>}
                                {patAge !== null && (
                                  <span className="flex items-center gap-1 font-medium text-foreground/80">
                                    <Cake className="w-3 h-3 text-emerald-600" />
                                    <b>{patAge} anos</b>
                                  </span>
                                )}
                                {r.patient?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.patient.phone}</span>}
                                {timeline && <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" />{timeline}</span>}
                              </div>

                              {r.notes && !isExpanded && (
                                <p className="mt-1 text-[11px] text-foreground/70 truncate">
                                  <span className="font-semibold">Indicação:</span> {r.notes}
                                </p>
                              )}

                              {isExpanded && (
                                <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 space-y-1.5">
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                    <span>Liberação: {formatValidLocalDate(r.released_at, "dd/MM/yyyy")}</span>
                                    <span>Aplicação: {formatValidLocalDate(r.applied_at, "dd/MM/yyyy")}</span>
                                    <span>Validade (3 anos): {formatValidLocalDate(r.expected_removal_at, "dd/MM/yyyy")}</span>
                                    <span>Retirada realizada: {formatValidLocalDate(r.removed_at, "dd/MM/yyyy")}</span>
                                  </div>
                                  {(r.patient?.address || r.patient?.neighborhood) && (
                                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <MapPin className="w-3 h-3" />
                                      {[r.patient.address, r.patient.neighborhood].filter(Boolean).join(", ")}
                                    </p>
                                  )}
                                  {r.notes && (
                                    <p className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                                      <ClipboardList className="w-3.5 h-3.5 mt-[1px] shrink-0 text-primary" />
                                      <span><b className="font-semibold">Indicação:</b> {r.notes}</span>
                                    </p>
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleRecord(r.id)}
                                className="mt-1.5 text-[11px] font-semibold text-primary hover:underline"
                              >
                                {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 px-4 pb-3 md:py-3 md:pl-0 flex-wrap">
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
                                    onClick={() => {
                                      const appliedDate = applyDates[r.id] || today();
                                      const expectedRemoval = addYearsToLocalDateKey(appliedDate, 3);
                                      update.mutate({
                                        id: r.id,
                                        updates: {
                                          applied_at: appliedDate,
                                          expected_removal_at: expectedRemoval,
                                          status: "applied",
                                        },
                                      });
                                    }}
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
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Editar registro">
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printImplanonRecord(r)} title="Imprimir ficha">
                                <Printer className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove.mutate(r.id)} title="Excluir">
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

                  {nameTerm.trim().length >= 2 && (suggestions ?? []).length === 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <UserPlus className="w-3.5 h-3.5 text-primary" />
                      <span>Nova paciente — será cadastrada ao salvar</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CPF e Data de Nascimento ─────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
                {calcAge(dob) !== null && (
                  <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-1 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 w-fit">
                    <Cake className="w-3.5 h-3.5 text-emerald-600" />
                    {calcAge(dob)} anos de idade
                  </p>
                )}
              </div>
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

            {/* ── Unidade de Saúde (Posto de Saúde) ─────────────────── */}
            <div className="space-y-1">
              <Label>Unidade de Saúde (Posto de Saúde / PSF)</Label>
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

            {/* ── Situação inicial (Lista do posto) ────────────────── */}
            <div className="space-y-1">
              <Label>Situação inicial (Lista do posto)</Label>
              <Select value={initialStatus} onValueChange={(v) => setInitialStatus(v as "pending" | "released" | "applied")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Aguardando liberação (lista do posto)</SelectItem>
                  <SelectItem value="released">Já liberado</SelectItem>
                  <SelectItem value="applied">Já aplicado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(initialStatus === "released" || initialStatus === "applied") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data de liberação</Label>
                  <Input
                    type="date"
                    value={releasedAt}
                    onChange={(e) => setReleasedAt(e.target.value)}
                  />
                </div>
                {initialStatus === "applied" && (
                  <div className="space-y-1">
                    <Label>Data de aplicação</Label>
                    <Input
                      type="date"
                      value={appliedAt}
                      onChange={(e) => setAppliedAt(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {initialStatus === "applied" && computedRemoval && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <CalendarClock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Validade do Implanon (3 anos)</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Data limite: <b>{formatValidLocalDate(computedRemoval, "dd/MM/yyyy")}</b>
                </p>
                {(() => {
                  const rem = formatRemainingTime(computedRemoval);
                  return rem ? (
                    <p className="text-[11px] font-bold text-emerald-900 mt-1">
                      ⏳ {rem.text}
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            {/* ── Indicação ─────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label>Indicação</Label>
              <Input
                placeholder="Ex.: 18 anos, situação de vulnerabilidade, planejamento familiar..."
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

      {/* ══════════════════════════════════════════════════════════════
          Dialog — Editar registro
      ══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar registro — {editing?.patient?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-1">
            {/* ── Dados da Paciente ─────────────────────────────────── */}
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados da Paciente</Label>
            </div>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                value={editForm.cpf ?? ""}
                maxLength={14}
                onChange={(e) => setEditForm((p) => ({ ...p, cpf: maskCpf(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={editForm.dob ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, dob: e.target.value }))}
              />
              {calcAge(editForm.dob) !== null && (
                <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-1 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 w-fit">
                  <Cake className="w-3.5 h-3.5 text-emerald-600" />
                  {calcAge(editForm.dob)} anos de idade
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Posto de Saúde (PSF)</Label>
              <Select
                value={editForm.psf || "none"}
                onValueChange={(v) => setEditForm((p) => ({ ...p, psf: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem unidade definida</SelectItem>
                  {(healthUnits ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                  {editForm.psf && !(healthUnits ?? []).some((u) => u.name === editForm.psf) && (
                    <SelectItem value={editForm.psf}>{editForm.psf}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ── Dados do Implanon ────────────────────────────────── */}
            <div className="space-y-1 md:col-span-2 mt-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados do Implanon & Situação</Label>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Situação (Lista do posto)</Label>
              <Select
                value={editForm.status ?? "pending"}
                onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Aguardando liberação (lista do posto)</SelectItem>
                  <SelectItem value="released">Liberado</SelectItem>
                  <SelectItem value="applied">Aplicado</SelectItem>
                  <SelectItem value="removed">Retirado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {[
              { k: "released_at", l: "Data de liberação", t: "date" },
              { k: "applied_at", l: "Data de aplicação", t: "date" },
              { k: "expected_removal_at", l: "Validade (Previsão de retirada 3 anos)", t: "date" },
              { k: "removed_at", l: "Data de retirada", t: "date" },
            ].map((f) => (
              <div key={f.k} className="space-y-1">
                <Label>{f.l}</Label>
                <Input
                  type={f.t}
                  value={editForm[f.k] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditForm((p) => {
                      const next = { ...p, [f.k]: val };
                      if (f.k === "applied_at" && val) {
                        next.expected_removal_at = addYearsToLocalDateKey(val, 3) ?? "";
                      }
                      return next;
                    });
                  }}
                />
              </div>
            ))}

            {editForm.status === "applied" && (
              <div className="space-y-1 md:col-span-2">
                {(() => {
                  const rem = formatRemainingTime(editForm.expected_removal_at);
                  return (
                    <div className={cn(
                      "rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 mt-1",
                      rem?.isExpired
                        ? "border-red-200 bg-red-50 text-red-900"
                        : rem?.isSoon
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-900"
                    )}>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="font-semibold">Validade do Implanon (3 anos)</p>
                          {editForm.expected_removal_at && (
                            <p className="text-[11px] opacity-80">
                              Data limite: <b>{formatValidLocalDate(editForm.expected_removal_at, "dd/MM/yyyy")}</b>
                            </p>
                          )}
                        </div>
                      </div>
                      {rem && (
                        <span className="font-bold px-2 py-1 rounded bg-white/80 border shadow-xs">
                          {rem.text}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-1 md:col-span-2">
              <Label>Indicação</Label>
              <Input
                placeholder="Ex.: 18 anos, situação de vulnerabilidade..."
                value={editForm.notes ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => editing && printImplanonRecord(editing)}
            >
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
            <Button onClick={saveEdit} disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
