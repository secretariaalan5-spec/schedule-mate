import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScheduling, formatDateFull } from "@/hooks/useScheduling";
import SlotPanel from "@/components/SlotPanel";
import PatientManager from "@/components/PatientManager";
import ImportExport from "@/components/ImportExport";
import InviteLink from "@/components/InviteLink";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { CalendarDays, Users, LogOut, ChevronLeft, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@/assets/logo.png";

const MORNING_SLOTS = Array.from({ length: 15 }, (_, i) => i + 1);
const AFTERNOON_SLOTS = Array.from({ length: 17 }, (_, i) => i + 16);

type Tab = "agenda" | "pacientes";

export default function Dashboard() {
  const { signOut } = useAuth();
  const sched = useScheduling();
  const [tab, setTab] = useState<Tab>("agenda");
  const [mobileShowSlots, setMobileShowSlots] = useState(false);
  const isMobile = useIsMobile();

  const handleRefresh = () => {
    sched.fetchPatients();
    if (sched.selectedDate) sched.fetchAppointments(sched.selectedDate);
  };

  const calendarDate = sched.selectedDate ? new Date(sched.selectedDate + "T12:00:00") : undefined;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    sched.setSelectedDate(dateStr);
    if (isMobile) setMobileShowSlots(true);
  };

  const appointmentDateObjects = useMemo(
    () => sched.appointmentDates.map(d => new Date(d + "T12:00:00")),
    [sched.appointmentDates]
  );

  const morningOccupied = sched.appointments.filter(a => a.slot >= 1 && a.slot <= 15).length;
  const afternoonOccupied = sched.appointments.filter(a => a.slot >= 16 && a.slot <= 32).length;
  const totalOccupied = morningOccupied + afternoonOccupied;
  const totalSlots = 32;
  const morningFree = 15 - morningOccupied;
  const afternoonFree = 17 - afternoonOccupied;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "agenda", label: "Agenda", icon: <CalendarDays className="w-5 h-5" /> },
    { id: "pacientes", label: "Pacientes", icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          {isMobile && tab === "agenda" && mobileShowSlots && (
            <Button variant="ghost" size="icon" onClick={() => setMobileShowSlots(false)} className="text-primary-foreground hover:bg-primary-foreground/10 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <img src={logo} alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain rounded-full bg-white/90 p-0.5" />
          <div className="hidden sm:block">
            <h1 className="font-bold text-base md:text-lg tracking-tight">SAÚDE DA MULHER</h1>
            <p className="text-xs opacity-80">Agendamento — Camocim</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <InviteLink />
          <ImportExport onImportComplete={handleRefresh} />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Desktop top nav */}
      {!isMobile && (
        <nav className="bg-card border-b px-4 flex items-center gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {tab === "agenda" && (
          <>
            {/* Calendar sidebar - desktop always, mobile when not showing slots */}
            {(!isMobile || !mobileShowSlots) && (
              <div className={`${isMobile ? "flex-1" : "w-[300px] border-r"} bg-card flex-shrink-0 flex flex-col overflow-auto p-4`}>
                <CalendarUI
                  mode="single"
                  selected={calendarDate}
                  onSelect={handleCalendarSelect}
                  locale={ptBR}
                  modifiers={{ hasAppointments: appointmentDateObjects }}
                  modifiersClassNames={{ hasAppointments: "hasAppointments" }}
                  className="w-full"
                />
                {isMobile && sched.selectedDate && (
                  <Button className="mt-4 w-full" onClick={() => setMobileShowSlots(true)}>
                    Ver agenda do dia
                  </Button>
                )}
                {/* Summary on mobile calendar view */}
                {isMobile && sched.selectedDate && (
                  <div className="mt-3 p-3 bg-muted rounded-lg text-sm space-y-1">
                    <p className="font-semibold text-primary">{totalOccupied}/{totalSlots} vagas ocupadas</p>
                    <p className="text-muted-foreground">{morningFree} manhã + {afternoonFree} tarde livres</p>
                  </div>
                )}
              </div>
            )}

            {/* Slots panel - desktop always, mobile when showing slots */}
            {(!isMobile || mobileShowSlots) && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {sched.selectedDate && (
                  <div className="px-4 md:px-6 py-2 md:py-3 bg-card border-b">
                    <h2 className="font-semibold text-sm md:text-base capitalize">
                      {formatDateFull(sched.selectedDate)}
                    </h2>
                  </div>
                )}
                <div className={`flex-1 flex ${isMobile ? "flex-col" : ""} overflow-hidden`}>
                  {sched.selectedDate ? (
                    <>
                      <div className="flex-1 overflow-auto">
                        <SlotPanel
                          title="MANHÃ — 08:00 — ZONA RURAL"
                          slots={MORNING_SLOTS}
                          appointments={sched.appointments}
                          patients={sched.patients}
                          date={sched.selectedDate}
                          variant="morning"
                          vacancies={15}
                          onAdd={sched.addAppointment}
                          onRemove={sched.removeAppointment}
                          onPatientsChanged={sched.fetchPatients}
                          onRefresh={() => sched.fetchAppointments(sched.selectedDate!)}
                          onUpdateTime={sched.updateAppointmentTime}
                          onUpdateAppointment={sched.updateAppointment}
                        />
                      </div>
                      <div className={`flex-1 overflow-auto ${isMobile ? "border-t" : "border-l"}`}>
                        <SlotPanel
                          title="TARDE — 14:00 — CIDADE / CAMOCIM"
                          slots={AFTERNOON_SLOTS}
                          appointments={sched.appointments}
                          patients={sched.patients}
                          date={sched.selectedDate}
                          variant="afternoon"
                          vacancies={17}
                          onAdd={sched.addAppointment}
                          onRemove={sched.removeAppointment}
                          onPatientsChanged={sched.fetchPatients}
                          onRefresh={() => sched.fetchAppointments(sched.selectedDate!)}
                          onUpdateTime={sched.updateAppointmentTime}
                          onUpdateAppointment={sched.updateAppointment}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <p>Selecione um dia no calendário</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "pacientes" && (
          <div className="flex-1 overflow-hidden">
            <PatientManager
              patients={sched.patients}
              onAdd={sched.addPatient}
              onUpdate={sched.updatePatient}
              onDelete={sched.deletePatient}
              onGetHistory={sched.getPatientHistory}
            />
          </div>
        )}
      </div>

      {/* Desktop footer */}
      {!isMobile && tab === "agenda" && sched.selectedDate && (
        <footer className="bg-card border-t px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-primary">{totalOccupied}/{totalSlots} Vagas Ocupadas</span>
            <span className="text-muted-foreground">
              {totalSlots - totalOccupied} Livres: {morningFree} Manhã, {afternoonFree} Tarde
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-morning"></span>
              Rural
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-afternoon"></span>
              Cidade
            </span>
          </div>
        </footer>
      )}

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="bg-card border-t flex items-center justify-around py-1 safe-bottom">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "agenda") setMobileShowSlots(false); }}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors ${
                tab === t.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <button
            onClick={signOut}
            className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium text-muted-foreground"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </nav>
      )}
    </div>
  );
}
