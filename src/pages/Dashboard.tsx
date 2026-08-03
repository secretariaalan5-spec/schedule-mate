import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useScheduling, formatDateFull } from "@/hooks/useScheduling";
import SlotPanel from "@/components/SlotPanel";
import AppointmentDialog from "@/components/AppointmentDialog";
import Sidebar from "@/components/Sidebar";
import HeaderMenu from "@/components/HeaderMenu";
const PatientManager = lazy(() => import("@/components/PatientManager"));
const HealthUnitsManager = lazy(() => import("@/components/HealthUnitsManager"));
const LoanManager = lazy(() => import("@/components/LoanManager"));
const ImplanonManager = lazy(() => import("@/components/ImplanonManager"));
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import InviteLink from "@/components/InviteLink";
import { supabase } from "@/integrations/supabase/client";
import { 
  CalendarDays, 
  Users, 
  ChevronLeft, 
  Download, 
  Filter, 
  X, 
  Building, 
  HandCoins, 
  Sun, 
  Moon,
  Search,
  Bell,
  Mail,
  Plus,
  Menu,
  LogOut,
  User,
  UserPlus,
  Syringe
} from "lucide-react";
import type { Patient, Appointment } from "@/hooks/useScheduling";
import { useAppointmentDraft } from "@/hooks/useAppointmentDraft";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

import { DEFAULT_SHIFTS, useShifts } from "@/hooks/useShifts";
import { exportDayExcel } from "@/lib/exportUtils";
import { useAuth } from "@/hooks/useAuth";
import { formatValidLocalDate, isValidDate, parseValidLocalDate, toLocalDateKey } from "@/lib/dateUtils";

type Tab = "dashboard" | "agenda" | "pacientes" | "unidades" | "implanon" | "emprestimos" | "menu";

export default function Dashboard() {
  const sched = useScheduling();
  const { user, signOut } = useAuth();

  // Team management
  const [teamOpen, setTeamOpen] = useState(false);
  const [pendingTeamCount, setPendingTeamCount] = useState(0);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfileName(data.name || data.email.split("@")[0]);
    };
    fetchProfile();
    const fetchPending = async () => {
      const { count } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingTeamCount(count ?? 0);
    };
    fetchPending();
    const channelName = `dashboard_team_badge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, fetchPending)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);
  const { data: shifts = DEFAULT_SHIFTS } = useShifts();
  const [tab, setTab] = useState<Tab>("agenda");
  const [mobileShowSlots, setMobileShowSlots] = useState(false);
  const isMobile = useIsMobile();
  const [preselectedPatient, setPreselectedPatient] = useState<Patient | null>(null);

  // Active shift for mobile view
  const [mobileShift, setMobileShift] = useState<"morning" | "afternoon">("morning");

  // ---- Persistent dialog state (survives tab switches within the app) ----
  const { hasDraft, clearDraft } = useAppointmentDraft();
  const DIALOG_KEY = "appt_dialog_state_v1";

  type DialogState = {
    slot: number;
    variant: "morning" | "afternoon";
    editAppointment: Appointment | null;
    dialogResetKey: number;
  } | null;

  const loadDialogState = useCallback((): DialogState => {
    try {
      const raw = sessionStorage.getItem(DIALOG_KEY);
      if (!raw) return null;
      const s: DialogState = JSON.parse(raw);
      if (!s) return null;
      // Only restore new-appointment dialogs that have a live draft
      if (!s.editAppointment && !hasDraft(s.slot, sched.selectedDate, s.variant)) {
        sessionStorage.removeItem(DIALOG_KEY);
        return null;
      }
      return s;
    } catch { return null; }
  }, [hasDraft, sched.selectedDate]);

  const [dialogState, setDialogState] = useState<DialogState>(() => loadDialogState());

  const openNewDialog = useCallback((slot: number, variant: string) => {
    const state: DialogState = {
      slot,
      variant: variant as "morning" | "afternoon",
      editAppointment: null,
      dialogResetKey: Date.now(),
    };
    sessionStorage.setItem(DIALOG_KEY, JSON.stringify(state));
    setDialogState(state);
  }, []);

  const openEditDialog = useCallback((appt: Appointment, variant: string) => {
    const state: DialogState = {
      slot: appt.slot,
      variant: variant as "morning" | "afternoon",
      editAppointment: appt,
      dialogResetKey: Date.now(),
    };
    sessionStorage.setItem(DIALOG_KEY, JSON.stringify(state));
    setDialogState(state);
  }, []);

  const closeDialog = useCallback(() => {
    sessionStorage.removeItem(DIALOG_KEY);
    setDialogState(null);
    setPreselectedPatient(null);
  }, []);

  // Find which shift corresponds to the current dialog variant
  const dialogShift = useMemo(() => {
    if (!dialogState) return null;
    return shifts.find(s => s.label === dialogState.variant) ?? null;
  }, [dialogState, shifts]);

  const queryClient = useQueryClient();

  // Agenda filters
  const [filterPsf, setFilterPsf] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPrinted, setFilterPrinted] = useState<string>("all");

  // Reset filters when date changes
  useEffect(() => {
    setFilterPsf("all");
    setFilterType("all");
    setFilterPrinted("all");
  }, [sched.selectedDate]);

  // Mobile horizontal scroll date picker memo
  const mobileDays = useMemo(() => {
    const baseDate = parseValidLocalDate(sched.selectedDate);
    if (!baseDate) return [];
    
    const dayOfWeek = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - dayOfWeek);
    
    const labels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = toLocalDateKey(d);
      if (!dateStr) return null;
      
      return {
        dateStr,
        dayNum: d.getDate(),
        dayLabel: labels[i],
        isOccupied: (sched.appointmentCounts[dateStr] ?? 0) > 0
      };
    }).filter((d): d is NonNullable<typeof d> => !!d);
  }, [sched.selectedDate, sched.appointmentCounts]);

  const currentMonthLabel = useMemo(() => {
    return formatValidLocalDate(sched.selectedDate, "MMMM yyyy", "", { locale: ptBR });
  }, [sched.selectedDate]);

  const handlePrevWeek = () => {
    const d = parseValidLocalDate(sched.selectedDate);
    if (!d) return;
    d.setDate(d.getDate() - 7);
    const key = toLocalDateKey(d);
    if (key) sched.setSelectedDate(key);
  };

  const handleNextWeek = () => {
    const d = parseValidLocalDate(sched.selectedDate);
    if (!d) return;
    d.setDate(d.getDate() + 7);
    const key = toLocalDateKey(d);
    if (key) sched.setSelectedDate(key);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patients-stats"] });
    queryClient.invalidateQueries({ queryKey: ["health_units"] });
    queryClient.invalidateQueries({ queryKey: ["health_units_patient_counts"] });
    if (sched.selectedDate) sched.fetchAppointments();
  };

  const calendarDate = useMemo(() => parseValidLocalDate(sched.selectedDate) ?? undefined, [sched.selectedDate]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!isValidDate(date)) return;
    const dateStr = toLocalDateKey(date);
    if (dateStr) sched.setSelectedDate(dateStr);
  };

  // Occupancy metrics
  const occupancyModifiers = useMemo(() => {
    const total = shifts.reduce((acc, s) => acc + (s.end_slot - s.start_slot + 1), 0) || 32;
    const low: Date[] = [];
    const medium: Date[] = [];
    const high: Date[] = [];
    const full: Date[] = [];
    Object.entries(sched.appointmentCounts).forEach(([d, count]) => {
      const date = parseValidLocalDate(d);
      if (!date) return;
      const ratio = count / total;
      if (count >= total) full.push(date);
      else if (ratio >= 0.8) high.push(date);
      else if (ratio >= 0.5) medium.push(date);
      else low.push(date);
    });
    return { low, medium, high, full };
  }, [sched.appointmentCounts, shifts]);

  const totalOccupied = sched.appointments.length;

  const { totalSlots, morningOccupied, afternoonOccupied, morningTotal, afternoonTotal } = useMemo(() => {
    const morningShift = shifts.find(s => s.label === "morning");
    const afternoonShift = shifts.find(s => s.label === "afternoon");

    const mTotal = morningShift ? (morningShift.end_slot - morningShift.start_slot + 1) : 16;
    const aTotal = afternoonShift ? (afternoonShift.end_slot - afternoonShift.start_slot + 1) : 16;
    const total = mTotal + aTotal;

    const mOcc = morningShift
      ? sched.appointments.filter(a => a.slot >= morningShift.start_slot && a.slot <= morningShift.end_slot).length
      : 0;
    const aOcc = afternoonShift
      ? sched.appointments.filter(a => a.slot >= afternoonShift.start_slot && a.slot <= afternoonShift.end_slot).length
      : 0;

    return {
      totalSlots: total,
      morningOccupied: mOcc,
      afternoonOccupied: aOcc,
      morningTotal: mTotal,
      afternoonTotal: aTotal
    };
  }, [shifts, sched.appointments]);

  // Distinct PSFs options
  const psfOptions = useMemo(() => {
    const set = new Set<string>();
    sched.appointments.forEach(a => {
      if (a.patients?.psf) set.add(a.patients.psf);
    });
    return Array.from(set).sort();
  }, [sched.appointments]);

  // Apply filters
  const filteredAppointments = useMemo(() => {
    return sched.appointments.filter(a => {
      if (filterPsf !== "all" && a.patients?.psf !== filterPsf) return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      if (filterPrinted === "printed" && !a.printed) return false;
      if (filterPrinted === "not_printed" && a.printed) return false;
      return true;
    });
  }, [sched.appointments, filterPsf, filterType, filterPrinted]);

  const hasActiveFilters = filterPsf !== "all" || filterType !== "all" || filterPrinted !== "all";
  const clearFilters = () => {
    setFilterPsf("all");
    setFilterType("all");
    setFilterPrinted("all");
  };

  const handleExport = () => {
    exportDayExcel(sched.selectedDate, sched.appointments, shifts);
    toast.success("Excel exportado com sucesso", {
      description: "O arquivo foi baixado para sua pasta de Downloads.",
    });
  };

  const getHeaderTitle = () => {
    switch (tab) {
      case "dashboard":
        return "Dashboard";
      case "agenda":
        return sched.selectedDate ? formatDateFull(sched.selectedDate) : "Selecione uma data";
      case "pacientes":
        return "Pacientes";
      case "unidades":
        return "Unidades";
      case "emprestimos":
        return "Empréstimos";
      case "implanon":
        return "Implanon";
      default:
        return "Dashboard";
    }
  };

  return (
    <>
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <Sidebar activeTab={tab} onTabChange={(t) => setTab(t as Tab)} onSignOut={signOut} />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Mobile Top App Bar */}
        {isMobile && (
          <header className="h-14 w-full bg-gradient-to-r from-[#0369a1] to-[#0284c7] flex justify-between items-center px-4 border-b border-sky-400/30 shrink-0 shadow-md z-30">
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-7 h-7 object-contain bg-white rounded-full p-0.5 shadow-xs" alt="Logo Saúde da Mulher" />
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">Saúde da Mulher</h1>
            </div>
            <button
              onClick={handleExport}
              className="bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all shadow-xs backdrop-blur-sm border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </button>
          </header>
        )}

        {/* Desktop Header */}
        {!isMobile && (
          tab === "agenda" ? (
            <header className="h-16 w-full flex justify-between items-center px-6 bg-white border-b border-outline-variant shadow-sm sticky top-0 z-40 shrink-0">
              <div className="flex flex-col">
                <span className="text-label-bold uppercase text-on-surface-variant opacity-60">Agenda Selecionada</span>
                <h2 className="text-headline-md font-headline-md font-bold text-primary capitalize">
                  {sched.selectedDate ? formatDateFull(sched.selectedDate) : "Selecione uma data"}
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                {!!sched.selectedDate && (
                  <div className="flex bg-surface-container-low rounded-lg p-1 mr-4 border border-outline-variant/50">
                    <select
                      value={filterPsf}
                      onChange={(e) => setFilterPsf(e.target.value)}
                      className="bg-transparent border-none text-[12px] font-bold text-on-surface-variant focus:ring-0 cursor-pointer py-1 px-2"
                    >
                      <option value="all">Todos PSF</option>
                      {psfOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="bg-transparent border-none text-[12px] font-bold text-on-surface-variant focus:ring-0 cursor-pointer py-1 px-2 border-l border-outline-variant/40"
                    >
                      <option value="all">Todos tipos</option>
                      <option value="NORMAL">Normal</option>
                      <option value="RETORNO">Retorno</option>
                    </select>
                    <select
                      value={filterPrinted}
                      onChange={(e) => setFilterPrinted(e.target.value)}
                      className="bg-transparent border-none text-[12px] font-bold text-on-surface-variant focus:ring-0 cursor-pointer py-1 px-2 border-l border-outline-variant/40"
                    >
                      <option value="all">Todos status</option>
                      <option value="printed">Impressos</option>
                      <option value="not_printed">Pendentes</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-outline rounded-lg text-body-md font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors active:scale-95 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Exportar Dados
                </button>
              </div>
            </header>
          ) : (
            <header className="flex justify-between items-center h-16 w-full px-6 border-b border-outline-variant bg-white sticky top-0 z-40 shrink-0 shadow-sm">
              <h2 className="text-headline-md font-headline-md font-bold text-primary">
                {getHeaderTitle()}
              </h2>
              
              <div className="flex items-center gap-3">
              </div>
            </header>
          )
        )}

        {/* Dashboard tab */}
        {tab === "dashboard" && (
          <div className="flex-1 overflow-auto p-6 space-y-6 pb-24 md:pb-6">
            <div>
              <h3 className="text-xl font-bold" style={{ color: "#161d1f" }}>Painel Geral</h3>
              <p className="text-sm text-on-surface-variant">Resumo operacional e estatísticas do Saúde da Mulher Portal Clínico.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Atendimentos Hoje", value: totalOccupied, Icon: CalendarDays, color: "#871e47" },
                { label: "Total Pacientes", value: 128, Icon: Users, color: "#4a88de" },
                { label: "Unidades de Saúde", value: 4, Icon: Building, color: "#34a47c" },
                { label: "Equipamentos Emprestados", value: 8, Icon: HandCoins, color: "#e8a030" },
              ].map(({ label, value, Icon, color }) => (
                <div key={label} className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#887176" }}>{label}</p>
                    <p className="text-2xl font-black" style={{ color: "#161d1f" }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm">
                <h3 className="text-[12px] font-bold uppercase tracking-wide mb-4" style={{ color: "#554246" }}>Ações Rápidas</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTab("agenda")} className="h-11 rounded-lg text-white font-bold text-sm transition-all active:scale-95" style={{ background: "#6c0029" }}>Visualizar Agenda</button>
                  <button onClick={() => setTab("pacientes")} className="h-11 rounded-lg border font-bold text-sm transition-all active:scale-95 hover:bg-[#e8eff1]" style={{ borderColor: "#ddbfc3", color: "#554246" }}>Gerenciar Pacientes</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agenda tab */}
        {tab === "agenda" && (
          isMobile ? (
            /* MOBILE AGENDA VIEW — Scrollable single page */
            <div className="flex-1 overflow-y-auto w-full max-w-full overflow-x-hidden box-border p-4 space-y-6 pb-28 bg-slate-50/50">
              {/* Header Section */}
              <div className="w-full max-w-full overflow-hidden">
                <p className="text-label-bold text-on-surface-variant uppercase tracking-widest mb-1 text-[10px]">Agenda Selecionada</p>
                <h2 className="text-headline-md font-headline-md text-on-surface uppercase font-bold text-lg leading-tight truncate">
                  {sched.selectedDate ? formatDateFull(sched.selectedDate) : "Selecione uma data"}
                </h2>
              </div>

              {/* Horizontal Scrollable Date Picker */}
              <div className="mb-4 w-full max-w-full overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-title-sm text-on-surface text-sm capitalize font-bold">{currentMonthLabel}</span>
                  <div className="flex gap-2">
                    <button onClick={handlePrevWeek} className="p-1 hover:bg-surface-container rounded-full border border-outline-variant bg-white active:scale-95 transition-all shadow-xs">
                      <ChevronLeft className="w-4 h-4 text-on-surface" />
                    </button>
                    <button onClick={handleNextWeek} className="p-1 hover:bg-surface-container rounded-full border border-outline-variant bg-white active:scale-95 transition-all shadow-xs">
                      <ChevronLeft className="w-4 h-4 text-on-surface rotate-180" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2 w-full max-w-full">
                  {mobileDays.map((day) => {
                    const isSelected = day.dateStr === sched.selectedDate;
                    return (
                      <div
                        key={day.dateStr}
                        onClick={() => sched.setSelectedDate(day.dateStr)}
                        className={cn(
                          "flex-shrink-0 flex flex-col items-center justify-center w-12 h-16 rounded-xl border transition-all cursor-pointer shadow-xs",
                          isSelected
                            ? "bg-primary text-white shadow-md scale-105 ring-2 ring-primary/30 border-primary font-bold"
                            : day.isOccupied
                              ? "bg-emerald-50/60 border-emerald-300 text-emerald-900 font-bold"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <span className={cn("text-[9px] font-bold tracking-wider", isSelected ? "text-white" : "text-slate-500")}>
                          {day.dayLabel}
                        </span>
                        <span className="text-sm font-black mt-0.5">{day.dayNum}</span>
                        {day.isOccupied && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Occupancy Summary Card with 3D Depth */}
              <article className="bg-white rounded-xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] p-4.5 w-full max-w-full box-border">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-title-sm text-primary text-sm font-bold">Status de Ocupação</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-primary-fixed text-on-primary-fixed rounded">
                    {Math.round((totalOccupied / (totalSlots || 32)) * 100)}%
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-black text-primary">{totalOccupied}</span>
                  <span className="text-sm font-bold text-on-surface-variant">/ {totalSlots || 32}</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 mb-4 relative overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((totalOccupied / (totalSlots || 32)) * 100))}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-0.5">Manhã</p>
                    <p className="text-sm font-bold text-primary">{morningTotal - morningOccupied}</p>
                    <p className="text-[9px] text-on-surface-variant font-medium">vagas livres</p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-2.5 text-center">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-0.5">Tarde</p>
                    <p className="text-sm font-bold text-secondary">{afternoonTotal - afternoonOccupied}</p>
                    <p className="text-[9px] text-on-surface-variant font-medium">vagas livres</p>
                  </div>
                </div>
              </article>

              {/* Segmented Control for Turnos */}
              <div className="flex bg-surface-container-high p-1 rounded-xl">
                <button
                  onClick={() => setMobileShift("morning")}
                  className={cn(
                    "flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5",
                    mobileShift === "morning"
                      ? "bg-white text-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-white/40"
                  )}
                >
                  <Sun className="w-3.5 h-3.5" />
                  MANHÃ
                </button>
                <button
                  onClick={() => setMobileShift("afternoon")}
                  className={cn(
                    "flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5",
                    mobileShift === "afternoon"
                      ? "bg-white text-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-white/40"
                )}
                >
                  <Moon className="w-3.5 h-3.5" />
                  TARDE
                </button>
              </div>

              {/* Turn Content List */}
              {shifts.filter(s => s.label === mobileShift).map(shift => (
                <div key={shift.id} className="bg-transparent">
                  <SlotPanel
                    title={shift.display_title}
                    slots={Array.from({ length: shift.end_slot - shift.start_slot + 1 }, (_, i) => i + shift.start_slot)}
                    appointments={filteredAppointments}
                    date={sched.selectedDate}
                    variant={shift.label as any}
                    defaultTime={shift.default_time}
                    vacancies={shift.end_slot - shift.start_slot + 1}
                    onAdd={sched.addAppointment}
                    onRemove={sched.removeAppointment}
                    onPatientsChanged={handleRefresh}
                    onRefresh={() => sched.fetchAppointments()}
                    onUpdateTime={sched.updateAppointmentTime}
                    onUpdateAppointment={sched.updateAppointment}
                    onOpenNewDialog={openNewDialog}
                    onOpenEditDialog={openEditDialog}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* DESKTOP AGENDA VIEW — Side by Side */
            <div className="flex flex-1 overflow-hidden p-margin-md gap-margin-md bg-[#F7FAFC]">
              {/* LEFT: Calendar + Resumo */}
              <section className="flex-shrink-0 flex flex-col gap-6 overflow-y-auto no-scrollbar" style={{ width: "288px" }}>
                
                {/* CALENDAR CARD */}
                <article className="bg-white rounded-xl border border-outline-variant shadow-sm p-6">
                  <ErrorBoundary>
                    <CalendarUI
                      mode="single"
                      selected={calendarDate}
                      onSelect={handleCalendarSelect}
                      locale={ptBR}
                      modifiers={{
                        occLow: occupancyModifiers.low,
                        occMedium: occupancyModifiers.medium,
                        occHigh: occupancyModifiers.high,
                        occFull: occupancyModifiers.full,
                      }}
                      modifiersClassNames={{
                        occLow: "occLow",
                        occMedium: "occMedium",
                        occHigh: "occHigh",
                        occFull: "occFull",
                      }}
                      className="w-full p-0"
                    />
                  </ErrorBoundary>

                  {/* Legend */}
                  <div className="mt-6 pt-5 border-t border-outline-variant flex flex-wrap gap-2 justify-between">
                    {[
                      { color: "bg-secondary-fixed", label: "Baixa" },
                      { color: "bg-yellow-400", label: "Média" },
                      { color: "bg-orange-400", label: "Alta" },
                      { color: "bg-primary", label: "Lotado" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1">
                        <div className={cn("w-2 h-2 rounded-full", color)}></div>
                        <span className="text-[9px] font-bold text-on-surface-variant">{label}</span>
                      </div>
                    ))}
                  </div>
                </article>

                {/* OCCUPATION SUMMARY CARD */}
                <article className="bg-white rounded-xl border border-outline-variant shadow-sm p-6">
                  <h3 className="text-label-bold uppercase text-on-surface-variant opacity-60 mb-4">Resumo do Dia</h3>
                  <div className="p-4 rounded-lg bg-primary/5 mb-6">
                    <p className="text-body-sm font-bold text-primary mb-1">Status de Ocupação</p>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-extrabold text-primary">{totalOccupied}</span>
                      <span className="text-body-sm font-bold text-on-surface-variant">/ {totalSlots || 32}</span>
                    </div>
                    <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((totalOccupied / (totalSlots || 32)) * 100))}%` }}
                      ></div>
                    </div>
                    <p className="text-right text-[10px] font-bold text-primary">
                      {Math.round((totalOccupied / (totalSlots || 32)) * 100)}%
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-lg text-center">
                      <span className="text-[10px] font-bold uppercase text-secondary">Manhã</span>
                      <p className="text-2xl font-extrabold text-secondary">{morningOccupied}</p>
                      <span className="text-[9px] text-on-surface-variant">{morningTotal - morningOccupied} livres</span>
                    </div>
                    <div className="p-3 bg-tertiary/5 border border-tertiary/10 rounded-lg text-center">
                      <span className="text-[10px] font-bold uppercase text-tertiary">Tarde</span>
                      <p className="text-2xl font-extrabold text-tertiary">{afternoonOccupied}</p>
                      <span className="text-[9px] text-on-surface-variant">{afternoonTotal - afternoonOccupied} livres</span>
                    </div>
                  </div>
                </article>
              </section>

              {/* RIGHT: Slot panels side-by-side */}
              <section className="flex-1 flex flex-col overflow-hidden gap-4">
                <div className="flex-1 flex overflow-hidden gap-6">
                  {shifts.map(shift => (
                    <article key={shift.id} className="flex-1 flex flex-col bg-transparent overflow-hidden">
                    <SlotPanel
                        title={shift.display_title}
                        slots={Array.from({ length: shift.end_slot - shift.start_slot + 1 }, (_, i) => i + shift.start_slot)}
                        appointments={filteredAppointments}
                        date={sched.selectedDate}
                        variant={shift.label as any}
                        defaultTime={shift.default_time}
                        vacancies={shift.end_slot - shift.start_slot + 1}
                        onAdd={sched.addAppointment}
                        onRemove={sched.removeAppointment}
                        onPatientsChanged={handleRefresh}
                        onRefresh={() => sched.fetchAppointments()}
                        onUpdateTime={sched.updateAppointmentTime}
                        onUpdateAppointment={sched.updateAppointment}
                        onOpenNewDialog={openNewDialog}
                        onOpenEditDialog={openEditDialog}
                      />
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )
        )}

        {/* Patients tab */}
        {tab === "pacientes" && (
          <div className="flex-1 overflow-hidden p-6 pb-28 md:pb-6">
            <div className="h-full bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#871e47" }}></div></div>}>
                <PatientManager onGetHistory={sched.getPatientHistory} />
              </Suspense>
            </div>
          </div>
        )}

        {/* Health Units tab */}
        {tab === "unidades" && (
          <div className="flex-1 overflow-hidden p-6 pb-28 md:pb-6">
            <div className="h-full bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#871e47" }}></div></div>}>
                <HealthUnitsManager />
              </Suspense>
            </div>
          </div>
        )}

        {/* Implanon tab */}
        {tab === "implanon" && (
          <div className="flex-1 overflow-hidden p-6 pb-28 md:pb-6">
            <div className="h-full bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#871e47" }}></div></div>}>
                <ImplanonManager />
              </Suspense>
            </div>
          </div>
        )}

        {/* Loans tab */}
        {tab === "emprestimos" && (
          <div className="flex-1 overflow-hidden p-6 pb-28 md:pb-6">
            <div className="h-full bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#871e47" }}></div></div>}>
                <LoanManager />
              </Suspense>
            </div>
          </div>
        )}

        {/* MOBILE MENU TAB */}
        {tab === "menu" && isMobile && (
          <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-50/70 pb-28">
            {/* User Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0369a1] to-[#0284c7] text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
                {profileName ? profileName.substring(0, 2).toUpperCase() : <User className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-slate-800 truncate">{profileName || "Administradora"}</h3>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full mt-1">
                  Equipe Portal Clínico
                </span>
              </div>
            </div>

            {/* Team & Access Management Section */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">Equipe & Acessos</p>
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100">
                <button
                  onClick={() => setTeamOpen(true)}
                  className="w-full text-left p-4 hover:bg-sky-50/50 active:bg-sky-50 transition-colors flex items-center justify-between font-bold text-sm text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0369a1] flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span>Gerenciar Equipe & Convites</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingTeamCount > 0 ? (
                      <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                        {pendingTeamCount} pendente{pendingTeamCount > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setTab("unidades")}
                  className="w-full text-left p-4 hover:bg-sky-50/50 active:bg-sky-50 transition-colors flex items-center justify-between font-bold text-sm text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <span>Unidades de Saúde (PSF/UBS)</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Clinical Services Section */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">Serviços Clínicos</p>
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100">
                <button
                  onClick={() => setTab("emprestimos")}
                  className="w-full text-left p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between font-bold text-sm text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <HandCoins className="w-4 h-4" />
                    </div>
                    <span>Controle de Empréstimos</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400" />
                </button>

                <button
                  onClick={() => setTab("implanon")}
                  className="w-full text-left p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between font-bold text-sm text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Syringe className="w-4 h-4" />
                    </div>
                    <span>Implanon</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400" />
                </button>

                <button
                  onClick={() => setTab("dashboard")}
                  className="w-full text-left p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between font-bold text-sm text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <span>Painel de Estatísticas</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Logout Button */}
            <div className="pt-2">
              <button
                onClick={signOut}
                className="w-full p-3.5 rounded-2xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all flex items-center justify-center gap-2 font-bold text-sm shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* InviteLink dialog - available from menu tab */}
      <InviteLink open={teamOpen} onOpenChange={setTeamOpen} />

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <nav className="fixed bottom-3 left-3 right-3 z-50 flex justify-around items-center px-2 py-2 bg-[#0369a1]/95 backdrop-blur-xl border border-sky-400/40 shadow-[0_8px_32px_rgba(3,105,161,0.3)] rounded-2xl pb-safe">
          <button
            onClick={() => setTab("agenda")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-3 transition-all duration-200 active:scale-95 rounded-xl flex-1 max-w-[80px]",
              tab === "agenda"
                ? "bg-white text-[#0369a1] font-bold shadow-md scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[9px] font-extrabold uppercase leading-none mt-1">Agenda</span>
          </button>
          
          <button
            onClick={() => setTab("pacientes")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-3 transition-all duration-200 active:scale-95 rounded-xl flex-1 max-w-[80px]",
              tab === "pacientes"
                ? "bg-white text-[#0369a1] font-bold shadow-md scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-extrabold uppercase leading-none mt-1">Pacientes</span>
          </button>

          <button
            onClick={() => setTab("unidades")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-3 transition-all duration-200 active:scale-95 rounded-xl flex-1 max-w-[80px]",
              tab === "unidades"
                ? "bg-white text-[#0369a1] font-bold shadow-md scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <Building className="w-5 h-5" />
            <span className="text-[9px] font-extrabold uppercase leading-none mt-1">Unidades</span>
          </button>

          <button
            onClick={() => setTab("menu")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-3 transition-all duration-200 active:scale-95 rounded-xl flex-1 max-w-[80px]",
              tab === "menu"
                ? "bg-white text-[#0369a1] font-bold shadow-md scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-extrabold uppercase leading-none mt-1">Menu</span>
          </button>
        </nav>
      )}
    </div>

      {/* AppointmentDialog lives OUTSIDE the tab conditional so it never unmounts
          when the user switches to Pacientes/Unidades tabs */}
      {dialogState && dialogShift && (
        <AppointmentDialog
          key={dialogState.dialogResetKey}
          open={true}
          onClose={closeDialog}
          slot={dialogState.slot}
          date={sched.selectedDate}
          variant={dialogState.variant}
          defaultTime={dialogShift.default_time}
          title={dialogShift.display_title}
          onAdd={sched.addAppointment}
          onPatientsChanged={handleRefresh}
          editAppointment={dialogState.editAppointment}
          onUpdate={sched.updateAppointment}
          preselectedPatient={preselectedPatient}
        />
      )}
    </>
  );
}
