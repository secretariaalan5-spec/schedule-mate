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
} from "lucide-react";

const db = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

function daysUntil(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

type PatientLite = {
  id: string;
  name: string;
  sus_card: string | null;
  phone: string | null;
  psf: string | null;
};

function PatientPicker({
  value,
  onChange,
}: {
  value: PatientLite | null;
  onChange: (p: PatientLite | null) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data } = useQuery({
    queryKey: ["implanon-patient-search", debounced],
    enabled: debounced.trim().length >= 2 && !value,
    queryFn: async () => {
      const safe = debounced.replace(/[,()\"']/g, " ").trim();
      const { data, error } = await db
        .from("patients")
        .select("id,name,sus_card,phone,psf")
        .ilike("name", `%${safe}%`)
        .order("name")
        .limit(8);
      if (error) throw error;
      return (data ?? []) as PatientLite[];
    },
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {value.sus_card ? `CNS ${value.sus_card}` : "Sem CNS"}{" "}
            {value.psf ? `· ${value.psf}` : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar paciente pelo nome..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      {(data ?? []).length > 0 && (
        <div className="max-h-44 overflow-auto rounded-lg border border-border divide-y">
          {(data ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p)}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
            >
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {p.sus_card ?? "sem CNS"} {p.psf ? `· ${p.psf}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  released: { label: "Liberado", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  applied: { label: "Aplicado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  removed: { label: "Retirado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const SEM_UNIDADE = "— Sem unidade definida";

/** Groups records by the patient's PSF unit */
function groupByUnit(records: ImplanonRecord[]): Map<string, ImplanonRecord[]> {
  const map = new Map<string, ImplanonRecord[]>();
  for (const r of records) {
    const key = r.patient?.psf?.trim() || SEM_UNIDADE;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  // Sort keys alphabetically, putting SEM_UNIDADE last
  const sorted = new Map(
    [...map.entries()].sort(([a], [b]) => {
      if (a === SEM_UNIDADE) return 1;
      if (b === SEM_UNIDADE) return -1;
      return a.localeCompare(b, "pt-BR");
    }),
  );
  return sorted;
}

export default function ImplanonManager() {
  const { data, isLoading, create, update, remove } = useImplanon();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());

  const [patient, setPatient] = useState<PatientLite | null>(null);
  const emptyForm = {
    released_at: today(),
    applied_at: "",
    lot: "",
    lot_expiry: "",
    expected_removal_at: "",
    professional: "",
    application_site: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const records = data ?? [];

  // Distinct PSF units from all records
  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      const u = r.patient?.psf?.trim();
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records]);

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

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return records.filter((r) => {
      // Unit filter
      if (filterUnit !== "all") {
        const unit = r.patient?.psf?.trim() || SEM_UNIDADE;
        if (unit !== filterUnit) return false;
      }
      // Text search
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

  const resetForm = () => {
    setPatient(null);
    setForm({ ...emptyForm, released_at: today() });
  };

  const submit = async () => {
    if (!patient) return;
    await create.mutateAsync({
      patient_id: patient.id,
      released_at: form.released_at || null,
      applied_at: form.applied_at || null,
      lot: form.lot || null,
      lot_expiry: form.lot_expiry || null,
      expected_removal_at: form.expected_removal_at || null,
      professional: form.professional || null,
      application_site: form.application_site || null,
      notes: form.notes || null,
    } as any);
    setOpen(false);
    resetForm();
  };

  const cards = [
    { label: "Liberados", value: indicators.released, icon: FileClock, cls: "text-sky-600 bg-sky-50" },
    { label: "Aplicados ativos", value: indicators.applied, icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50" },
    { label: "Retirada próxima", value: indicators.expiring, icon: CalendarClock, cls: "text-amber-600 bg-amber-50" },
    { label: "Retirada vencida", value: indicators.overdue, icon: AlertTriangle, cls: "text-red-600 bg-red-50" },
    { label: "Lote vencendo", value: indicators.lotExpiring, icon: PackageCheck, cls: "text-orange-600 bg-orange-50" },
    { label: "Retirados", value: indicators.removed, icon: Syringe, cls: "text-slate-600 bg-slate-100" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-lg leading-tight">Implanon</h2>
            <p className="text-xs text-muted-foreground">Liberação, aplicação, lote e retirada por unidade de saúde</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo registro
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {cards.map((c) => {
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
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por paciente, lote, profissional ou unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Unit Filter */}
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

        {/* Records — grouped by unit */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando registros...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhum registro encontrado.</p>
        ) : (
          <div className="space-y-6">
            {[...groupedFiltered.entries()].map(([unit, unitRecords]) => {
              const isCollapsed = collapsedUnits.has(unit);
              const isSemUnidade = unit === SEM_UNIDADE;

              return (
                <section key={unit}>
                  {/* Unit Section Header */}
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
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                  </button>

                  {/* Unit Records */}
                  {!isCollapsed && (
                    <div className="space-y-2 pl-1">
                      {unitRecords.map((r) => {
                        const meta = STATUS_META[r.status] ?? STATUS_META.released;
                        const d = daysUntil(r.expected_removal_at);

                        return (
                          <article
                            key={r.id}
                            className="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm truncate">{r.patient?.name ?? "Paciente"}</h3>
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

                              {/* Patient info row */}
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                {r.patient?.sus_card && <span>CNS: {r.patient.sus_card}</span>}
                                {r.patient?.phone && <span>Tel: {r.patient.phone}</span>}
                                {r.patient?.acs && <span>ACS: {r.patient.acs}</span>}
                              </div>

                              {/* Implanon dates row */}
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                <span>Liberação: {formatValidLocalDate(r.released_at, "dd/MM/yyyy")}</span>
                                <span>Aplicação: {formatValidLocalDate(r.applied_at, "dd/MM/yyyy")}</span>
                                <span>Lote: {r.lot ?? "—"}</span>
                                <span>Validade: {formatValidLocalDate(r.lot_expiry, "dd/MM/yyyy")}</span>
                                <span>Prev. retirada: {formatValidLocalDate(r.expected_removal_at, "dd/MM/yyyy")}</span>
                                <span>Retirada: {formatValidLocalDate(r.removed_at, "dd/MM/yyyy")}</span>
                                <span className="md:col-span-2">Prof.: {r.professional ?? "—"}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {r.status === "released" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    update.mutate({ id: r.id, updates: { applied_at: today() } })
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
                                    update.mutate({ id: r.id, updates: { removed_at: today() } })
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

      {/* New Record Dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Novo registro de Implanon</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Paciente</Label>
              <PatientPicker value={patient} onChange={setPatient} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de liberação</Label>
                <Input
                  type="date"
                  value={form.released_at}
                  onChange={(e) => setForm({ ...form, released_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Data de aplicação</Label>
                <Input
                  type="date"
                  value={form.applied_at}
                  onChange={(e) => setForm({ ...form, applied_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Lote</Label>
                <Input
                  value={form.lot}
                  onChange={(e) => setForm({ ...form, lot: e.target.value })}
                  placeholder="Ex.: A1234"
                />
              </div>
              <div className="space-y-1">
                <Label>Validade do lote</Label>
                <Input
                  type="date"
                  value={form.lot_expiry}
                  onChange={(e) => setForm({ ...form, lot_expiry: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Previsão de retirada</Label>
                <Input
                  type="date"
                  value={form.expected_removal_at}
                  onChange={(e) => setForm({ ...form, expected_removal_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Profissional responsável</Label>
                <Input
                  value={form.professional}
                  onChange={(e) => setForm({ ...form, professional: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Local de aplicação</Label>
                <Input
                  value={form.application_site}
                  onChange={(e) => setForm({ ...form, application_site: e.target.value })}
                  placeholder="Braço esquerdo"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!patient || create.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
