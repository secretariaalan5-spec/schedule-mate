import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImplanon, type ImplanonRecord } from "@/hooks/useImplanon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  Syringe,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  CalendarClock,
  FileClock,
  Trash2,
  Building2,
  ChevronDown,
  ChevronRight,
  UserPlus,
  UserSearch,
  User,
  Phone,
  MapPin,
  Cake,
  BadgeCheck,
  X,
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

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function formatCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
}

/* ─── types ────────────────────────────────────────────────────────────── */
type PatientLite = {
  id: string;
  name: string;
  cpf: string | null;
  sus_card: string | null;
  phone: string | null;
  dob: string | null;
  address: string | null;
  neighborhood: string | null;
  psf: string | null;
};

/* ─── PatientSearch: busca paciente existente ──────────────────────────── */
function PatientSearch({
  onSelect,
}: {
  onSelect: (p: PatientLite) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data } = useQuery({
    queryKey: ["implanon-patient-search", debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: async () => {
      const safe = debounced.replace(/[,()\"']/g, " ").trim();
      const { data, error } = await db
        .from("patients")
        .select("id,name,cpf,sus_card,phone,dob,address,neighborhood,psf")
        .or(`name.ilike.%${safe}%,cpf.ilike.%${safe}%`)
        .order("name")
        .limit(8);
      if (error) throw error;
      return (data ?? []) as PatientLite[];
    },
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou CPF..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      {(data ?? []).length > 0 && (
        <div className="max-h-48 overflow-auto rounded-lg border border-border divide-y shadow-sm">
          {(data ?? []).map((p) => {
            const age = calcAge(p.dob ?? "");
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors"
              >
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.cpf ?? "Sem CPF"} {age !== null ? `· ${age} anos` : ""}{" "}
                  {p.psf ? `· ${p.psf}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
      {debounced.trim().length >= 2 && (data ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhuma paciente encontrada com esse nome/CPF.
        </p>
      )}
    </div>
  );
}

/* ─── Status badges ─────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  released: { label: "Liberado", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  applied: { label: "Aplicado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  removed: { label: "Retirado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
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

/* ─── empty form state ─────────────────────────────────────────────────── */
const emptyPatientForm = {
  name: "",
  cpf: "",
  dob: "",
  phone: "",
  address: "",
  neighborhood: "",
  psf: "",
};
const emptyImplanonForm = {
  released_at: today(),
  applied_at: "",
  lot: "",
  lot_expiry: "",
  expected_removal_at: "",
  professional: "",
  application_site: "",
  notes: "",
};

/* ═══════════════════════════════════════════════════════════════════════
   ImplanonManager
═══════════════════════════════════════════════════════════════════════ */
export default function ImplanonManager() {
  const { data, isLoading, create, update, remove } = useImplanon();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());

  /* Dialog mode: "new" = cadastrar nova paciente | "existing" = buscar existente */
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [implanonForm, setImplanonForm] = useState(emptyImplanonForm);
  const [saving, setSaving] = useState(false);

  const records = data ?? [];

  /* Idade calculada automaticamente */
  const age = useMemo(
    () => (mode === "new" ? calcAge(patientForm.dob) : calcAge(selectedPatient?.dob ?? "")),
    [mode, patientForm.dob, selectedPatient?.dob],
  );

  /* Unidades distintas */
  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      const u = r.patient?.psf?.trim();
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records]);

  /* KPIs */
  const indicators = useMemo(() => {
    const applied = records.filter((r) => r.status === "applied");
    const expiring = applied.filter((r) => {
      const d = daysUntil(r.expected_removal_at);
      return d !== null && d >= 0 && d <= 90;
    });
    const overdue = applied.filter((r) => {
      const d = daysUntil(r.expected_removal_at);
      return d !== null && d < 0;
    });
    const lotExpiring = records.filter((r) => {
      const d = daysUntil(r.lot_expiry);
      return r.status !== "removed" && d !== null && d <= 60;
    });
    return {
      released: records.filter((r) => r.status === "released").length,
      applied: applied.length,
      removed: records.filter((r) => r.status === "removed").length,
      expiring: expiring.length,
      overdue: overdue.length,
      lotExpiring: lotExpiring.length,
    };
  }, [records]);

  /* Filtro + busca */
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return records.filter((r) => {
      if (filterUnit !== "all") {
        const unit = r.patient?.psf?.trim() || SEM_UNIDADE;
        if (unit !== filterUnit) return false;
      }
      if (t) {
        return (
          r.patient?.name?.toLowerCase().includes(t) ||
          (r.lot ?? "").toLowerCase().includes(t) ||
          (r.professional ?? "").toLowerCase().includes(t) ||
          (r.patient?.psf ?? "").toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [records, search, filterUnit]);

  const groupedFiltered = useMemo(() => groupByUnit(filtered), [filtered]);

  const toggleUnit = (unit: string) => {
    setCollapsedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  };

  /* Reset form */
  const resetDialog = () => {
    setMode("new");
    setSelectedPatient(null);
    setPatientForm(emptyPatientForm);
    setImplanonForm({ ...emptyImplanonForm, released_at: today() });
  };

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const submit = async () => {
    setSaving(true);
    try {
      let patientId: string;

      if (mode === "new") {
        /* Validações mínimas */
        if (!patientForm.name.trim()) {
          toast.error("Nome completo é obrigatório");
          return;
        }
        /* Upsert paciente pelo CPF (se informado) ou inserir novo */
        const cpfClean = patientForm.cpf.replace(/\D/g, "") || null;
        const phoneClean = patientForm.phone.replace(/\D/g, "") || null;

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
          /* Atualiza dados da paciente existente */
          await db.from("patients").update({
            name: patientForm.name.trim(),
            dob: patientForm.dob || null,
            phone: phoneClean,
            address: patientForm.address.trim() || null,
            neighborhood: patientForm.neighborhood.trim() || null,
            psf: patientForm.psf.trim() || null,
          }).eq("id", existingId);
          patientId = existingId;
        } else {
          /* Insere nova paciente */
          const { data: inserted, error } = await db
            .from("patients")
            .insert({
              name: patientForm.name.trim(),
              cpf: cpfClean,
              dob: patientForm.dob || null,
              phone: phoneClean,
              address: patientForm.address.trim() || null,
              neighborhood: patientForm.neighborhood.trim() || null,
              psf: patientForm.psf.trim() || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          patientId = inserted.id;
        }
      } else {
        if (!selectedPatient) {
          toast.error("Selecione uma paciente");
          return;
        }
        patientId = selectedPatient.id;
      }

      /* Cria o registro de Implanon */
      await create.mutateAsync({
        patient_id: patientId,
        released_at: implanonForm.released_at || null,
        applied_at: implanonForm.applied_at || null,
        lot: implanonForm.lot || null,
        lot_expiry: implanonForm.lot_expiry || null,
        expected_removal_at: implanonForm.expected_removal_at || null,
        professional: implanonForm.professional || null,
        application_site: implanonForm.application_site || null,
        notes: implanonForm.notes || null,
      } as any);

      setOpen(false);
      resetDialog();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  /* KPI cards */
  const kpiCards = [
    { label: "Liberados", value: indicators.released, icon: FileClock, cls: "text-sky-600 bg-sky-50" },
    { label: "Aplicados ativos", value: indicators.applied, icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50" },
    { label: "Retirada próxima", value: indicators.expiring, icon: CalendarClock, cls: "text-amber-600 bg-amber-50" },
    { label: "Retirada vencida", value: indicators.overdue, icon: AlertTriangle, cls: "text-red-600 bg-red-50" },
    { label: "Lote vencendo", value: indicators.lotExpiring, icon: PackageCheck, cls: "text-orange-600 bg-orange-50" },
    { label: "Retirados", value: indicators.removed, icon: Syringe, cls: "text-slate-600 bg-slate-100" },
  ];

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-lg leading-tight">Implanon</h2>
            <p className="text-xs text-muted-foreground">
              Liberação, aplicação, lote e retirada por unidade de saúde
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo registro
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* KPI Cards */}
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

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por paciente, lote, profissional ou unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {unitOptions.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Records list — grouped by unit */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando registros...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Nenhum registro encontrado.
          </p>
        ) : (
          <div className="space-y-6">
            {[...groupedFiltered.entries()].map(([unit, unitRecords]) => {
              const isCollapsed = collapsedUnits.has(unit);
              const isSemUnidade = unit === SEM_UNIDADE;
              return (
                <section key={unit}>
                  <button
                    type="button"
                    onClick={() => toggleUnit(unit)}
                    className="w-full flex items-center gap-2 mb-3 group"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors",
                        isSemUnidade
                          ? "bg-slate-50 border-slate-200 text-slate-500"
                          : "bg-primary/5 border-primary/20 text-primary",
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {unit}
                      <span
                        className={cn(
                          "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black",
                          isSemUnidade
                            ? "bg-slate-200 text-slate-600"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {unitRecords.length}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2 pl-1">
                      {unitRecords.map((r) => {
                        const meta = STATUS_META[r.status] ?? STATUS_META.released;
                        const d = daysUntil(r.expected_removal_at);
                        const patAge = calcAge(r.patient?.dob ?? "");
                        return (
                          <article
                            key={r.id}
                            className="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              {/* Name + status badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm truncate">
                                  {r.patient?.name ?? "Paciente"}
                                </h3>
                                <span
                                  className={cn(
                                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                                    meta.cls,
                                  )}
                                >
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

                              {/* Patient details */}
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                                {r.patient?.cpf && (
                                  <span className="flex items-center gap-1">
                                    <BadgeCheck className="w-3 h-3" />
                                    CPF: {r.patient.cpf}
                                  </span>
                                )}
                                {patAge !== null && (
                                  <span className="flex items-center gap-1">
                                    <Cake className="w-3 h-3" />
                                    {patAge} anos
                                  </span>
                                )}
                                {r.patient?.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {r.patient.phone}
                                  </span>
                                )}
                                {(r.patient?.address || r.patient?.neighborhood) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {[r.patient.address, r.patient.neighborhood]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </span>
                                )}
                              </div>

                              {/* Implanon dates */}
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                <span>
                                  Liberação: {formatValidLocalDate(r.released_at, "dd/MM/yyyy")}
                                </span>
                                <span>
                                  Aplicação: {formatValidLocalDate(r.applied_at, "dd/MM/yyyy")}
                                </span>
                                <span>Lote: {r.lot ?? "—"}</span>
                                <span>
                                  Validade: {formatValidLocalDate(r.lot_expiry, "dd/MM/yyyy")}
                                </span>
                                <span>
                                  Prev. retirada:{" "}
                                  {formatValidLocalDate(r.expected_removal_at, "dd/MM/yyyy")}
                                </span>
                                <span>
                                  Retirada: {formatValidLocalDate(r.removed_at, "dd/MM/yyyy")}
                                </span>
                                <span className="md:col-span-2">
                                  Prof.: {r.professional ?? "—"}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {r.status === "released" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    update.mutate({
                                      id: r.id,
                                      updates: { applied_at: today() },
                                    })
                                  }
                                >
                                  Aplicar
                                </Button>
                              )}
                              {r.status === "applied" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    update.mutate({
                                      id: r.id,
                                      updates: { removed_at: today() },
                                    })
                                  }
                                >
                                  Registrar retirada
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => remove.mutate(r.id)}
                                title="Excluir registro"
                              >
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

      {/* ── New Record Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="w-4 h-4 text-primary" />
              Novo registro de Implanon
            </DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => { setMode("new"); setSelectedPatient(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold transition-colors",
                mode === "new"
                  ? "bg-primary text-white"
                  : "bg-white text-muted-foreground hover:bg-muted/40",
              )}
            >
              <UserPlus className="w-4 h-4" />
              Nova paciente
            </button>
            <button
              type="button"
              onClick={() => { setMode("existing"); setPatientForm(emptyPatientForm); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold transition-colors",
                mode === "existing"
                  ? "bg-primary text-white"
                  : "bg-white text-muted-foreground hover:bg-muted/40",
              )}
            >
              <UserSearch className="w-4 h-4" />
              Paciente existente
            </button>
          </div>

          {/* ── PATIENT SECTION ──────────────────────────────────────────── */}
          {mode === "new" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <User className="w-3.5 h-3.5" />
                Dados da paciente
              </div>

              {/* Nome + CPF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label>
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Ex.: Maria das Graças Silva"
                    value={patientForm.name}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={patientForm.cpf}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, cpf: formatCpf(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={patientForm.phone}
                    onChange={(e) =>
                      setPatientForm({
                        ...patientForm,
                        phone: formatPhone(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={patientForm.dob}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, dob: e.target.value })
                    }
                  />
                </div>

                {/* Idade calculada automaticamente */}
                <div className="space-y-1">
                  <Label>Idade</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-sm font-semibold text-muted-foreground">
                    {age !== null ? `${age} anos` : "—"}
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, número, complemento"
                    value={patientForm.address}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, address: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input
                    placeholder="Ex.: Centro"
                    value={patientForm.neighborhood}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, neighborhood: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Unidade de Saúde (PSF/UBS)</Label>
                  <Input
                    placeholder="Ex.: PSF Vila Nova"
                    value={patientForm.psf}
                    onChange={(e) =>
                      setPatientForm({ ...patientForm, psf: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ── EXISTING PATIENT SEARCH ─────────────────────────────── */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <UserSearch className="w-3.5 h-3.5" />
                Buscar paciente existente
              </div>
              {selectedPatient ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{selectedPatient.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                      {selectedPatient.cpf && <span>CPF: {selectedPatient.cpf}</span>}
                      {calcAge(selectedPatient.dob ?? "") !== null && (
                        <span>{calcAge(selectedPatient.dob ?? "")} anos</span>
                      )}
                      {selectedPatient.phone && <span>Tel: {selectedPatient.phone}</span>}
                      {selectedPatient.psf && <span>PSF: {selectedPatient.psf}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <PatientSearch onSelect={setSelectedPatient} />
              )}
            </div>
          )}

          {/* ── IMPLANON SECTION ────────────────────────────────────────── */}
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Syringe className="w-3.5 h-3.5" />
              Dados do Implanon
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de liberação</Label>
                <Input
                  type="date"
                  value={implanonForm.released_at}
                  onChange={(e) =>
                    setImplanonForm({ ...implanonForm, released_at: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Data de aplicação</Label>
                <Input
                  type="date"
                  value={implanonForm.applied_at}
                  onChange={(e) =>
                    setImplanonForm({ ...implanonForm, applied_at: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Lote</Label>
                <Input
                  placeholder="Ex.: A1234"
                  value={implanonForm.lot}
                  onChange={(e) =>
                    setImplanonForm({ ...implanonForm, lot: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Validade do lote</Label>
                <Input
                  type="date"
                  value={implanonForm.lot_expiry}
                  onChange={(e) =>
                    setImplanonForm({ ...implanonForm, lot_expiry: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Previsão de retirada</Label>
                <Input
                  type="date"
                  value={implanonForm.expected_removal_at}
                  onChange={(e) =>
                    setImplanonForm({
                      ...implanonForm,
                      expected_removal_at: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Profissional responsável</Label>
                <Input
                  value={implanonForm.professional}
                  onChange={(e) =>
                    setImplanonForm({ ...implanonForm, professional: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Local de aplicação</Label>
                <Input
                  placeholder="Ex.: Braço esquerdo"
                  value={implanonForm.application_site}
                  onChange={(e) =>
                    setImplanonForm({
                      ...implanonForm,
                      application_site: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={implanonForm.notes}
                onChange={(e) =>
                  setImplanonForm({ ...implanonForm, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={
                saving ||
                (mode === "new" && !patientForm.name.trim()) ||
                (mode === "existing" && !selectedPatient)
              }
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
