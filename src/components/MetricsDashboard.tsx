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
import { Trophy, Filter, Users, CalendarDays, RotateCcw } from "lucide-react";
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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Ranking de Consultas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pacientes com mais atendimentos no período · {format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => quick(7)}>Últimos 7 dias</Button>
              <Button size="sm" variant="outline" onClick={() => quick(30)}>Últimos 30 dias</Button>
              <Button size="sm" variant="outline" onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); }}>Este mês</Button>
              <Button size="sm" variant="ghost" onClick={reset} className="ml-auto">
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Consultas</p>
              <p className="text-2xl font-bold text-primary tabular-nums mt-1">{totals.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" /> Pacientes únicas
              </p>
              <p className="text-2xl font-bold text-accent tabular-nums mt-1">{totals.uniquePatients}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Dias atendidos
              </p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-1">{totals.uniqueDays}</p>
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Top pacientes por consultas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-md" />)}
              </div>
            ) : topPatients.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhuma consulta encontrada para os filtros selecionados.
              </div>
            ) : (
              <ol className="space-y-1.5">
                {topPatients.map((p, i) => {
                  const pct = (p.total / maxTotal) * 100;
                  const medal = i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-slate-300 text-slate-800" : i === 2 ? "bg-orange-400 text-orange-950" : "bg-muted text-muted-foreground";
                  return (
                    <li key={i} className="relative flex items-center gap-3 rounded-md border bg-card px-3 py-2 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/5"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${medal}`}>
                        {i + 1}
                      </div>
                      <div className="relative z-10 min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                        {p.psf && <p className="text-[11px] text-muted-foreground truncate">{p.psf}</p>}
                      </div>
                      <Badge variant="secondary" className="relative z-10 tabular-nums font-bold">
                        {p.total} {p.total === 1 ? "consulta" : "consultas"}
                      </Badge>
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