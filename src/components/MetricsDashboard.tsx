import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Users, CalendarDays, Printer, Baby, Building2, AlertTriangle,
  TrendingUp, Clock, CheckCircle2, FileWarning, Activity, Stethoscope,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, parseISO, differenceInYears, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = ["hsl(207 70% 38%)", "hsl(175 55% 45%)", "hsl(35 90% 55%)", "hsl(340 75% 55%)", "hsl(260 60% 55%)", "hsl(150 55% 45%)"];

type KpiTone = "primary" | "accent" | "amber" | "rose" | "emerald" | "violet";
const toneMap: Record<KpiTone, { bg: string; text: string; ring: string; icon: string }> = {
  primary: { bg: "bg-primary/5", text: "text-primary", ring: "ring-primary/10", icon: "bg-primary/10 text-primary" },
  accent:  { bg: "bg-accent/5",  text: "text-accent",  ring: "ring-accent/10",  icon: "bg-accent/10 text-accent" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-500/5",   text: "text-amber-600 dark:text-amber-400",   ring: "ring-amber-500/10",   icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  rose:    { bg: "bg-rose-50 dark:bg-rose-500/5",     text: "text-rose-600 dark:text-rose-400",     ring: "ring-rose-500/10",    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/10", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-500/5", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/10", icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

function Kpi({ label, value, sub, icon, tone = "primary" }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; tone?: KpiTone;
}) {
  const t = toneMap[tone];
  return (
    <Card className={`${t.bg} border-0 ring-1 ${t.ring} shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className={`text-2xl md:text-3xl font-bold mt-1 ${t.text} tabular-nums`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.icon}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, icon, children, className = "" }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export default function MetricsDashboard() {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const last30Start = subDays(today, 29);
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");
  const last30StartStr = format(last30Start, "yyyy-MM-dd");

  // Aggregate counts via HEAD requests (fast, no data pulled)
  const kpisQuery = useQuery({
    queryKey: ["metrics", "kpis", todayStr, monthStartStr],
    queryFn: async () => {
      const [
        patientsRes, apptTodayRes, apptMonthRes, printedMonthRes,
        pregnantRes, highRiskRes, incompletePatientsRes, unitsRes,
      ] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", todayStr),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("date", monthStartStr).lte("date", monthEndStr).eq("printed", true),
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("is_pregnant", true),
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("is_pregnant", true).eq("risk_classification", "ALTO"),
        supabase.from("patients").select("*", { count: "exact", head: true }).or("sus_card.is.null,dob.is.null,psf.is.null"),
        supabase.from("health_units").select("*", { count: "exact", head: true }),
      ]);
      return {
        patients: patientsRes.count ?? 0,
        apptToday: apptTodayRes.count ?? 0,
        apptMonth: apptMonthRes.count ?? 0,
        printedMonth: printedMonthRes.count ?? 0,
        pregnant: pregnantRes.count ?? 0,
        highRisk: highRiskRes.count ?? 0,
        incomplete: incompletePatientsRes.count ?? 0,
        units: unitsRes.count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  // Appointments in last 30 days for trend, weekday, shift, type charts
  const trendQuery = useQuery({
    queryKey: ["metrics", "trend30", last30StartStr, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("date, slot, type, printed, patient_id, patients(psf)")
        .gte("date", last30StartStr)
        .lte("date", todayStr)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // Age distribution: sample patient DOBs
  const patientDobsQuery = useQuery({
    queryKey: ["metrics", "patient-dobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("dob, is_pregnant").not("dob", "is", null).limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const trendData = useMemo(() => {
    const days = eachDayOfInterval({ start: last30Start, end: today });
    const map = new Map<string, number>();
    (trendQuery.data ?? []).forEach((a: any) => {
      map.set(a.date, (map.get(a.date) ?? 0) + 1);
    });
    return days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      return {
        date: key,
        label: format(d, "dd/MM"),
        total: map.get(key) ?? 0,
      };
    });
  }, [trendQuery.data]);

  const weekdayData = useMemo(() => {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    (trendQuery.data ?? []).forEach((a: any) => {
      const d = parseISO(a.date);
      buckets[d.getDay()]++;
    });
    return names.map((n, i) => ({ day: n, total: buckets[i] }));
  }, [trendQuery.data]);

  const shiftData = useMemo(() => {
    let manha = 0, tarde = 0;
    (trendQuery.data ?? []).forEach((a: any) => {
      if (a.slot <= 15) manha++;
      else tarde++;
    });
    return [
      { name: "Manhã", value: manha },
      { name: "Tarde", value: tarde },
    ];
  }, [trendQuery.data]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    (trendQuery.data ?? []).forEach((a: any) => {
      const t = a.type || "NORMAL";
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [trendQuery.data]);

  const topPsfs = useMemo(() => {
    const counts: Record<string, number> = {};
    (trendQuery.data ?? []).forEach((a: any) => {
      const psf = a.patients?.psf || "Sem PSF";
      counts[psf] = (counts[psf] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [trendQuery.data]);

  const ageData = useMemo(() => {
    const buckets = [
      { name: "0-14", min: 0, max: 14, value: 0 },
      { name: "15-24", min: 15, max: 24, value: 0 },
      { name: "25-34", min: 25, max: 34, value: 0 },
      { name: "35-44", min: 35, max: 44, value: 0 },
      { name: "45-59", min: 45, max: 59, value: 0 },
      { name: "60+", min: 60, max: 200, value: 0 },
    ];
    (patientDobsQuery.data ?? []).forEach((p: any) => {
      if (!p.dob) return;
      const age = differenceInYears(today, parseISO(p.dob));
      const b = buckets.find(x => age >= x.min && age <= x.max);
      if (b) b.value++;
    });
    return buckets;
  }, [patientDobsQuery.data]);

  const isLoading = kpisQuery.isLoading || trendQuery.isLoading;
  const kpis = kpisQuery.data;

  const printedRate = kpis && kpis.apptMonth > 0 ? Math.round((kpis.printedMonth / kpis.apptMonth) * 100) : 0;
  const pendingMonth = kpis ? kpis.apptMonth - kpis.printedMonth : 0;

  return (
    <div className="h-full overflow-auto bg-muted/30">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 md:w-7 md:h-7 text-primary" />
              Painel de Métricas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada · {format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="text-xs text-muted-foreground bg-card border rounded-full px-3 py-1.5 shadow-sm">
            Atualizado em {format(new Date(), "HH:mm")}
          </div>
        </div>

        {/* KPI grid */}
        {isLoading || !kpis ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Kpi label="Pacientes" value={kpis.patients} sub="Total cadastradas" icon={<Users className="w-5 h-5" />} tone="primary" />
            <Kpi label="Consultas Hoje" value={kpis.apptToday} sub={format(today, "dd/MM/yyyy")} icon={<CalendarDays className="w-5 h-5" />} tone="accent" />
            <Kpi label="Consultas no Mês" value={kpis.apptMonth} sub={format(today, "MMMM 'de' yyyy", { locale: ptBR })} icon={<TrendingUp className="w-5 h-5" />} tone="violet" />
            <Kpi label="Taxa de Impressão" value={`${printedRate}%`} sub={`${kpis.printedMonth} de ${kpis.apptMonth} impressos`} icon={<Printer className="w-5 h-5" />} tone="emerald" />
            <Kpi label="Gestantes" value={kpis.pregnant} sub={`${kpis.highRisk} de alto risco`} icon={<Baby className="w-5 h-5" />} tone="rose" />
            <Kpi label="Alto Risco" value={kpis.highRisk} sub="Acompanhamento prioritário" icon={<AlertTriangle className="w-5 h-5" />} tone="amber" />
            <Kpi label="Unidades" value={kpis.units} sub="PSF / UBS ativos" icon={<Building2 className="w-5 h-5" />} tone="primary" />
            <Kpi label="Cadastros Incompletos" value={kpis.incomplete} sub="Sem SUS, DN ou PSF" icon={<FileWarning className="w-5 h-5" />} tone="amber" />
          </div>
        )}

        {/* Print status progress */}
        {kpis && kpis.apptMonth > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-semibold">Status de impressão — {format(today, "MMMM", { locale: ptBR })}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-bold text-emerald-600">{kpis.printedMonth}</span> impressos ·{" "}
                  <span className="font-bold text-amber-600">{pendingMonth}</span> pendentes
                </p>
              </div>
              <Progress value={printedRate} className="h-2.5" />
            </CardContent>
          </Card>
        )}

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard
            title="Consultas nos últimos 30 dias"
            subtitle="Tendência diária de agendamentos"
            icon={<TrendingUp className="w-4 h-4 text-primary" />}
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(207 70% 38%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(207 70% 38%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  labelFormatter={(l) => `Dia ${l}`}
                  formatter={(v: any) => [`${v} consultas`, "Total"]}
                />
                <Area type="monotone" dataKey="total" stroke="hsl(207 70% 38%)" strokeWidth={2.5} fill="url(#trendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Turno"
            subtitle="Distribuição manhã × tarde"
            icon={<Clock className="w-4 h-4 text-primary" />}
          >
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={shiftData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {shiftData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Consultas por dia da semana"
            subtitle="Últimos 30 dias"
            icon={<CalendarDays className="w-4 h-4 text-primary" />}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekdayData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: any) => [`${v} consultas`, "Total"]} />
                <Bar dataKey="total" fill="hsl(175 55% 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Tipo de consulta"
            subtitle="Normal × Retorno"
            icon={<Stethoscope className="w-4 h-4 text-primary" />}
          >
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 11 }}>
                  {typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Faixa etária das pacientes"
            subtitle="Distribuição do cadastro"
            icon={<Users className="w-4 h-4 text-primary" />}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ageData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: any) => [`${v} pacientes`, "Total"]} />
                <Bar dataKey="value" fill="hsl(260 60% 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Top PSFs por consultas"
            subtitle="Últimos 30 dias · 8 primeiros"
            icon={<Building2 className="w-4 h-4 text-primary" />}
            className="lg:col-span-3"
          >
            {topPsfs.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                Sem dados no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, topPsfs.length * 36)}>
                <BarChart data={topPsfs} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={140} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: any) => [`${v} consultas`, "Total"]} />
                  <Bar dataKey="total" fill="hsl(207 70% 38%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <p className="text-[11px] text-center text-muted-foreground pb-4">
          Métricas calculadas em tempo real · Consultas dos últimos 30 dias
        </p>
      </div>
    </div>
  );
}