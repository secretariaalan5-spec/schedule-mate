import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImplanon, type ImplanonRecord } from "@/hooks/useImplanon";
import PatientTimeline from "@/components/PatientTimeline";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";

const db = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

function daysUntil(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

type PatientLite = { id: string; name: string; sus_card: string | null; phone: string | null; psf: string | null };

function PatientPicker({ value, onChange }: { value: PatientLite | null; onChange: (p: PatientLite | null) => void }) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data } = useQuery({
    queryKey: ["implanon-patient-search", debounced],
    enabled: debounced.trim().length >= 2 && !value,
    queryFn: async () => {
      const safe = debounced.replace(/[,()"']/g, " ").trim();
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
            {value.sus_card ? `CNS ${value.sus_card}` : "Sem CNS"} {value.psf ? `· ${value.psf}` : ""}
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

export default function ImplanonManager() {
  const { data, isLoading, create, update, remove } = useImplanon();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [timelineFor, setTimelineFor] = useState<ImplanonRecord | null>(null);

  const [patient, setPatient] = useState<PatientLite | null>(null);
  const emptyForm = {
    released_at: today(),
    applied_at: "",
    lot: "",
    lot_expiry: "",
    expected_removal_at: "",
    professional: "",
    application_site: "",
    dum: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const records = data ?? [];

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
    if (!t) return records;
    return records.filter(
      (r) =>
        r.patient?.name?.toLowerCase().includes(t) ||
        (r.lot ?? "").toLowerCase().includes(t) ||
        (r.professional ?? "").toLowerCase().includes(t),
    );
  }, [records, search]);

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
      dum: form.dum || null,
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
      <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-lg leading-tight">Implanon</h2>
            <p className="text-xs text-muted-foreground">Liberação, aplicação, lote e retirada</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo registro
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">
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

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por paciente, lote ou profissional..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando registros...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhum registro encontrado.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
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
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", meta.cls)}>
                        {meta.label}
                      </span>
                      {r.status === "applied" && d !== null && d < 0 && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                          Retirada vencida
                        </span>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Liberação: {formatValidLocalDate(r.released_at, "dd/MM/yyyy")}</span>
                      <span>Aplicação: {formatValidLocalDate(r.applied_at, "dd/MM/yyyy")}</span>
                      <span>Lote: {r.lot ?? "—"}</span>
                      <span>Validade: {formatValidLocalDate(r.lot_expiry, "dd/MM/yyyy")}</span>
                      <span>Prev. retirada: {formatValidLocalDate(r.expected_removal_at, "dd/MM/yyyy")}</span>
                      <span>Retirada: {formatValidLocalDate(r.removed_at, "dd/MM/yyyy")}</span>
                      <span>DUM: {formatValidLocalDate(r.dum, "dd/MM/yyyy")}</span>
                      <span>Prof.: {r.professional ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setTimelineFor(r)}>
                      Prontuário
                    </Button>
                    {r.status === "released" && (
                      <Button size="sm" onClick={() => update.mutate({ id: r.id, updates: { applied_at: today() } })}>
                        Aplicar
                      </Button>
                    )}
                    {r.status === "applied" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => update.mutate({ id: r.id, updates: { removed_at: today() } })}
                      >
                        Registrar retirada
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)} title="Excluir registro">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
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
                <Input type="date" value={form.released_at} onChange={(e) => setForm({ ...form, released_at: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data de aplicação</Label>
                <Input type="date" value={form.applied_at} onChange={(e) => setForm({ ...form, applied_at: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Lote</Label>
                <Input value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="Ex.: A1234" />
              </div>
              <div className="space-y-1">
                <Label>Validade do lote</Label>
                <Input type="date" value={form.lot_expiry} onChange={(e) => setForm({ ...form, lot_expiry: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Previsão de retirada</Label>
                <Input type="date" value={form.expected_removal_at} onChange={(e) => setForm({ ...form, expected_removal_at: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>DUM</Label>
                <Input type="date" value={form.dum} onChange={(e) => setForm({ ...form, dum: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Profissional responsável</Label>
                <Input value={form.professional} onChange={(e) => setForm({ ...form, professional: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Local de aplicação</Label>
                <Input value={form.application_site} onChange={(e) => setForm({ ...form, application_site: e.target.value })} placeholder="Braço esquerdo" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!patient || create.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!timelineFor} onOpenChange={(v) => !v && setTimelineFor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Prontuário · {timelineFor?.patient?.name}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
              <TabsTrigger value="dados">Dados da paciente</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="pt-3">
              <PatientTimeline patientId={timelineFor?.patient_id} />
            </TabsContent>
            <TabsContent value="dados" className="pt-3 space-y-1 text-sm">
              <p><span className="text-muted-foreground">CNS:</span> {timelineFor?.patient?.sus_card ?? "—"}</p>
              <p><span className="text-muted-foreground">CPF:</span> {timelineFor?.patient?.cpf ?? "—"}</p>
              <p><span className="text-muted-foreground">Telefone:</span> {timelineFor?.patient?.phone ?? "—"}</p>
              <p><span className="text-muted-foreground">PSF:</span> {timelineFor?.patient?.psf ?? "—"}</p>
              <p><span className="text-muted-foreground">ACS:</span> {timelineFor?.patient?.acs ?? "—"}</p>
              <p><span className="text-muted-foreground">Nascimento:</span> {formatValidLocalDate(timelineFor?.patient?.dob, "dd/MM/yyyy")}</p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
