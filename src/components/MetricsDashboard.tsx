import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Filter, Users, CalendarDays, RotateCcw, Medal, Stethoscope } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type ShiftFilter = "all" | "morning" | "afternoon";
type TypeFilter = "all" | "NORMAL" | "RETORNO";

export default function MetricsDashboard() {
  const today = new Date();
  const defaultStart = format(startOfMonth(today), "yyyy-MM-dd");
  const defaultEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [shift, setShift] = useState<ShiftFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [psf, setPsf] = useState<string>("all");
  const [limit, setLimit] = useState<string>("10");

  const psfsQuery = useQuery({
    queryKey: ["metrics", "psfs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("psf").not("psf", "is", null).limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((p: any) => p.psf && set.add(p.psf));
      return Array.from(set).sort();
    },
    staleTime: 1000 * 60 * 10,
  });

  const apptsQuery = useQuery({
    queryKey: ["metrics", "appts", startDate, endDate, shift, type, psf],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("date, slot, type, patient_id, patients(name, psf)")
        .gte("date", startDate)
        .lte("date", endDate)
        .limit(10000);
      if (type !== "all") q = q.eq("type", type);
      if (shift === "morning") q = q.lte("slot", 15);
      else if (shift === "afternoon") q = q.gte("slot", 16);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60,
  });

  const filtered = useMemo(() => {
    const rows = apptsQuery.data ?? [];
    if (psf === "all") return rows;
    return rows.filter((r: any) => r.patients?.psf === psf);
  }, [apptsQuery.data, psf]);

  const totals = useMemo(() => {
    const rows = filtered;
    const total = rows.length;
    const uniquePatients = new Set(rows.map((r: any) => r.patient_id)).size;
    const uniqueDays = new Set(rows.map((r: any) => r.date)).size;
    return { total, uniquePatients, uniqueDays };
  }, [filtered]);

  const topPatients = useMemo(() => {
    const counts = new Map<string, { name: string; psf: string | null; total: number }>();
    filtered.forEach((r: any) => {
      const name = r.patients?.name || "—";
      const existing = counts.get(r.patient_id);
      if (existing) existing.total++;
      else counts.set(r.patient_id, { name, psf: r.patients?.psf ?? null, total: 1 });
    });
    const n = limit === "all" ? Infinity : parseInt(limit, 10);
    return Array.from(counts.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, isFinite(n) ? n : counts.size);
  }, [filtered, limit]);

  const maxTotal = topPatients[0]?.total ?? 1;

  const reset = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setShift("all");
    setType("all");
    setPsf("all");
    setLimit("10");
  };

  const quick = (days: number) => {
    setStartDate(format(subDays(today, days - 1), "yyyy-MM-dd"));
    setEndDate(format(today, "yyyy-MM-dd"));
  };

  const isLoading = apptsQuery.isLoading;

  return (
    <div className="h-full overflow-auto bg-muted/30">
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-lg">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary-foreground/10 blur-2xl" aria-hidden />
          <div className="absolute -right-8 -bottom-12 w-40 h-40 rounded-full bg-accent/30 blur-2xl" aria-hidden />
          <div className="relative p-5 md:p-6 flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ranking de Consultas</h1>
              <p className="text-xs md:text-sm text-primary-foreground/80 mt-0.5">
                Pacientes com mais atendimentos no período · {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-primary/10 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/40 rounded-t-lg">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Filter className="w-4 h-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="col-span-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Turno</Label>
                <Select value={shift} onValueChange={(v) => setShift(v as ShiftFilter)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="morning">Manhã (1-15)</SelectItem>
                    <SelectItem value="afternoon">Tarde (16-32)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="RETORNO">Retorno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs">PSF</Label>
                <Select value={psf} onValueChange={setPsf}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(psfsQuery.data ?? []).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Top</Label>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="25">Top 25</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mr-1 mt-2">Atalhos:</span>
              <Button size="sm" variant="outline" className="h-8 rounded-full mt-1" onClick={() => quick(7)}>7 dias</Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full mt-1" onClick={() => quick(30)}>30 dias</Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full mt-1" onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); }}>Este mês</Button>
              <Button size="sm" variant="ghost" onClick={reset} className="ml-auto h-8 mt-1 text-muted-foreground">
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Consultas", value: totals.total, icon: <Stethoscope className="w-4 h-4" />, tone: "bg-primary/10 text-primary ring-primary/15" },
            { label: "Pacientes únicas", value: totals.uniquePatients, icon: <Users className="w-4 h-4" />, tone: "bg-accent/10 text-accent ring-accent/15" },
            { label: "Dias atendidos", value: totals.uniqueDays, icon: <CalendarDays className="w-4 h-4" />, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/15" },
          ].map((s) => (
            <Card key={s.label} className="shadow-sm hover:shadow-md transition-shadow border-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${s.tone}`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ranking */}
        <Card className="border-primary/10 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/5 via-accent/5 to-transparent">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Medal className="w-4 h-4" /> Top pacientes por consultas
              </CardTitle>
              {!isLoading && topPatients.length > 0 && (
                <Badge variant="secondary" className="font-semibold">
                  {topPatients.length} {topPatients.length === 1 ? "paciente" : "pacientes"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-md" />)}
              </div>
            ) : topPatients.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-14 h-14 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                  <Trophy className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">Nenhuma consulta encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros ou o período selecionado.</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {topPatients.map((p, i) => {
                  const pct = (p.total / maxTotal) * 100;
                  const isPodium = i < 3;
                  const medal =
                    i === 0 ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 ring-amber-400/40 shadow-sm shadow-amber-500/30"
                    : i === 1 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 ring-slate-400/40"
                    : i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950 ring-orange-400/40"
                    : "bg-muted text-muted-foreground ring-border";
                  const bar =
                    i === 0 ? "bg-gradient-to-r from-amber-400/25 to-amber-400/5"
                    : i === 1 ? "bg-gradient-to-r from-slate-400/25 to-slate-400/5"
                    : i === 2 ? "bg-gradient-to-r from-orange-400/25 to-orange-400/5"
                    : "bg-gradient-to-r from-primary/10 to-primary/0";
                  return (
                    <li
                      key={i}
                      className={`relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 overflow-hidden transition-all hover:shadow-md hover:border-primary/20 ${isPodium ? "border-primary/10" : ""}`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 ${bar} transition-all`}
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                      <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-2 ${medal}`}>
                        {i + 1}
                      </div>
                      <div className="relative z-10 min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate leading-tight">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {p.psf || "Sem PSF"}
                        </p>
                      </div>
                      <div className="relative z-10 flex flex-col items-end">
                        <span className="text-lg font-bold text-primary tabular-nums leading-none">{p.total}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {p.total === 1 ? "consulta" : "consultas"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}