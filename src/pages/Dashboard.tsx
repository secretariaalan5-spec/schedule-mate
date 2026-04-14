import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useScheduling, formatDateFull } from "@/hooks/useScheduling";
import SlotPanel from "@/components/SlotPanel";
import PatientManager from "@/components/PatientManager";
import ImportExport from "@/components/ImportExport";
import InviteLink from "@/components/InviteLink";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { CalendarDays, Users, LogOut, ChevronLeft, Download } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

import { useShifts } from "@/hooks/useShifts";
import logo from "@/assets/logo.png";
import { exportDayExcel } from "@/lib/exportUtils";



type Tab = "agenda" | "pacientes";

export default function Dashboard() {
  const { signOut } = useAuth();
  const sched = useScheduling();
  const { data: shifts = [] } = useShifts();
  const [tab, setTab] = useState<Tab>("agenda");
  const [mobileShowSlots, setMobileShowSlots] = useState(false);
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patients-stats"] });
    if (sched.selectedDate) sched.fetchAppointments(sched.selectedDate);
  };

  const calendarDate = sched.selectedDate ? new Date(sched.selectedDate + "T12:00:00") : undefined;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    sched.setSelectedDate(dateStr);
    // REMOVED: if (isMobile) setMobileShowSlots(true); 
    // Now the user must explicitly click "Abrir Agenda do Dia" as requested.
  };

  const appointmentDateObjects = useMemo(
    () => sched.appointmentDates.map(d => new Date(d + "T12:00:00")),
    [sched.appointmentDates]
  );

  const totalOccupied = sched.appointments.length;
  const totalSlots = shifts.reduce((acc, s) => acc + (s.end_slot - s.start_slot + 1), 0);
  
  const morningShift = shifts.find(s => s.label === "morning");
  const afternoonShift = shifts.find(s => s.label === "afternoon");

  const morningFree = morningShift ? (morningShift.end_slot - morningShift.start_slot + 1) - sched.appointments.filter(a => a.slot >= morningShift.start_slot && a.slot <= morningShift.end_slot).length : 0;
  const afternoonFree = afternoonShift ? (afternoonShift.end_slot - afternoonShift.start_slot + 1) - sched.appointments.filter(a => a.slot >= afternoonShift.start_slot && a.slot <= afternoonShift.end_slot).length : 0;

  const handleExport = () => {
    exportDayExcel(sched.selectedDate, sched.appointments, shifts);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "agenda", label: "Agenda", icon: <CalendarDays className="w-5 h-5" /> },
    { id: "pacientes", label: "Pacientes", icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">

      {/* Header */}
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 md:py-4 flex items-center justify-between shadow-sm z-30 pt-[calc(12px+env(safe-area-inset-top))]">


        <div className="flex items-center gap-3">
          {isMobile && tab === "agenda" && mobileShowSlots && (
            <Button variant="ghost" size="icon" onClick={() => setMobileShowSlots(false)} className="text-primary-foreground hover:bg-primary-foreground/10 -ml-2 h-9 w-9">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <img src={logo} alt="Logo" className="w-8 h-8 md:w-9 md:h-9 object-contain rounded-xl bg-white p-1 shadow-sm flex-shrink-0" />
          <div className="hidden xs:block overflow-hidden">
            <h1 className="font-bold text-xs md:text-sm lg:text-lg tracking-tight leading-none truncate">SAÚDE DA MULHER</h1>
            <p className="text-[9px] md:text-xs opacity-80 mt-0.5 truncate">Agendamento • Camocim</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <InviteLink />
          <ImportExport onImportComplete={handleRefresh} />
          <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10 h-10 px-1 flex flex-col items-center justify-center gap-0">
            <LogOut className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase leading-none mt-0.5">Sair</span>
          </Button>
        </div>

      </header>


      {/* Desktop/Tablet top nav */}
      {!isMobile && (
        <nav className="bg-card border-b px-4 flex items-center gap-1 z-20">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all border-b-2 ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary/20"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {tab === "agenda" && (
          <>
            {/* Calendar sidebar */}
            {(!isMobile || !mobileShowSlots) && (
              <div className={`${isMobile ? "flex-1" : "w-[320px] border-r"} bg-card flex-shrink-0 flex flex-col overflow-auto p-4 md:p-6 animate-in fade-in slide-in-from-left-4 duration-300`}>
                <div className="bg-muted/30 rounded-2xl p-2 mb-4 border border-border/50 shadow-inner">
                  <CalendarUI
                    mode="single"
                    selected={calendarDate}
                    onSelect={handleCalendarSelect}
                    locale={ptBR}
                    modifiers={{ hasAppointments: appointmentDateObjects }}
                    modifiersClassNames={{ hasAppointments: "hasAppointments" }}
                    className="w-full"
                  />
                </div>
                
                {isMobile && sched.selectedDate && (
                  <Button className="mt-2 w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all" onClick={() => setMobileShowSlots(true)}>
                    <CalendarDays className="w-5 h-5 mr-2" />
                    Abrir Agenda do Dia
                  </Button>
                )}
                
                {/* Summary Section */}
                <div className="mt-6 space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Resumo do Dia</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl transition-all hover:bg-primary/10">
                      <p className="text-xs text-primary/70 font-medium mb-1">Status de Ocupação</p>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-primary">{totalOccupied}<span className="text-sm font-normal text-muted-foreground ml-1">/ {totalSlots || 0}</span></span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {totalSlots > 0 ? Math.round((totalOccupied / totalSlots) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-primary/10 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-500" style={{ width: `${totalSlots > 0 ? (totalOccupied / totalSlots) * 100 : 0}%` }}></div>
                      </div>

                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-morning/5 border border-morning/10 rounded-xl">
                        <p className="text-[10px] text-morning font-bold uppercase mb-1">Manhã</p>
                        <p className="text-xl font-bold text-morning-foreground bg-morning rounded-lg px-2 py-0.5 inline-block">{morningFree}</p>
                        <p className="text-[9px] text-muted-foreground mt-1 font-medium">vagas livres</p>
                      </div>
                      <div className="p-3 bg-afternoon/5 border border-afternoon/10 rounded-xl">
                        <p className="text-[10px] text-afternoon font-bold uppercase mb-1">Tarde</p>
                        <p className="text-xl font-bold text-afternoon-foreground bg-afternoon rounded-lg px-2 py-0.5 inline-block">{afternoonFree}</p>
                        <p className="text-[9px] text-muted-foreground mt-1 font-medium">vagas livres</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slots panel */}
            {(!isMobile || mobileShowSlots) && (
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                {sched.selectedDate && (
                  <div className="px-4 md:px-6 py-3 bg-card border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Agenda Selecionada</span>
                      <h2 className="font-bold text-sm md:text-base capitalize text-foreground">
                        {formatDateFull(sched.selectedDate)}
                      </h2>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-2 rounded-xl border-2 hover:bg-muted" onClick={handleExport}>
                      <Download className="w-4 h-4" />
                      Exportar Excel
                    </Button>
                  </div>
                )}
                <div className={`flex-1 flex ${isMobile ? "flex-col" : ""} overflow-hidden`}>
                  {sched.selectedDate ? (
                    <>
                      {shifts.map((shift, idx) => (
                        <div key={shift.id} className={`flex-1 overflow-auto ${isMobile && idx > 0 ? "border-t" : !isMobile && idx > 0 ? "border-l" : ""}`}>
                          <SlotPanel
                            title={shift.display_title}
                            slots={Array.from({ length: shift.end_slot - shift.start_slot + 1 }, (_, i) => i + shift.start_slot)}
                            appointments={sched.appointments}
                            date={sched.selectedDate}
                            variant={shift.label as any}
                            defaultTime={shift.default_time}
                            vacancies={shift.end_slot - shift.start_slot + 1}
                            onAdd={sched.addAppointment}
                            onRemove={sched.removeAppointment}
                            onPatientsChanged={handleRefresh}
                            onRefresh={() => sched.fetchAppointments(sched.selectedDate!)}
                            onUpdateTime={sched.updateAppointmentTime}
                            onUpdateAppointment={sched.updateAppointment}
                          />
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <CalendarDays className="w-8 h-8 opacity-20" />
                      </div>
                      <p className="font-medium">Nenhum dia selecionado</p>
                      <p className="text-xs max-w-[200px] mt-1">Toque em uma data no calendário para visualizar os horários.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "pacientes" && (
          <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
            <PatientManager
              onGetHistory={sched.getPatientHistory}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="bg-primary border-t border-white/10 flex items-center justify-around h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.3)]">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { 
                setTab(t.id); 
                if (t.id === "agenda") setMobileShowSlots(false); 
              }}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-all active:scale-95 relative ${
                tab === t.id && !mobileShowSlots ? "text-white" : "text-white/50"
              }`}
            >
              <div className={`transition-all duration-300 ${tab === t.id && !mobileShowSlots ? "scale-110" : "scale-100 opacity-80"}`}>
                {t.icon}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                {t.label}
              </span>
              {tab === t.id && !mobileShowSlots && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
              )}
            </button>
          ))}
        </nav>
      )}





      {/* Desktop footer replaced by in-sidebar summary */}
    </div>

  );
}
