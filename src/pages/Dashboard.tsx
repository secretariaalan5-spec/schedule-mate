import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScheduling, formatDateFull } from "@/hooks/useScheduling";
import SlotPanel from "@/components/SlotPanel";
import PatientManager from "@/components/PatientManager";
import ImportExport from "@/components/ImportExport";
import InviteLink from "@/components/InviteLink";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { CalendarDays, Users, LogOut } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MORNING_SLOTS = Array.from({ length: 15 }, (_, i) => i + 1);
const AFTERNOON_SLOTS = Array.from({ length: 17 }, (_, i) => i + 16);

type Tab = "agenda" | "pacientes";

export default function Dashboard() {
  const { signOut } = useAuth();
  const sched = useScheduling();
  const [tab, setTab] = useState<Tab>("agenda");

  const handleRefresh = () => {
    sched.fetchReleasedDays();
    sched.fetchPatients();
    if (sched.selectedDate) sched.fetchAppointments(sched.selectedDate);
  };

  const calendarDate = sched.selectedDate ? new Date(sched.selectedDate + "T12:00:00") : undefined;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const exists = sched.releasedDays.find(d => d.date === dateStr);
    if (!exists) {
      sched.addReleasedDay(dateStr);
    }
    sched.setSelectedDate(dateStr);
  };

  const releasedDateObjects = useMemo(
    () => sched.releasedDays.map(d => new Date(d.date + "T12:00:00")),
    [sched.releasedDays]
  );

  const morningOccupied = sched.appointments.filter(a => a.slot >= 1 && a.slot <= 15).length;
  const afternoonOccupied = sched.appointments.filter(a => a.slot >= 16 && a.slot <= 32).length;
  const totalOccupied = morningOccupied + afternoonOccupied;
  const totalSlots = 32;
  const morningFree = 15 - morningOccupied;
  const afternoonFree = 17 - afternoonOccupied;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "agenda", label: "Agenda", icon: <CalendarDays className="w-4 h-4" /> },
    { id: "pacientes", label: `Pacientes (${sched.patients.length})`, icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="font-bold text-xl tracking-tight">SAÚDE DA MULHER</h1>
          <p className="text-xs opacity-80">Sistema de Agendamento — Camocim</p>
        </div>
        <div className="flex items-center gap-2">
          <InviteLink />
          <ImportExport onImportComplete={handleRefresh} />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Tab navigation */}
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

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {tab === "agenda" && (
          <>
            {/* Calendar sidebar */}
            <div className="w-[300px] border-r bg-card flex-shrink-0 flex flex-col overflow-auto p-4">
              <CalendarUI
                mode="single"
                selected={calendarDate}
                onSelect={handleCalendarSelect}
                locale={ptBR}
                modifiers={{ released: releasedDateObjects }}
                modifiersClassNames={{ released: "bg-primary/10 font-semibold" }}
                className="w-full"
              />
            </div>

            {/* Slots area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {sched.selectedDate && (
                <div className="px-6 py-3 bg-card border-b">
                  <h2 className="font-semibold text-base capitalize">
                    {formatDateFull(sched.selectedDate)}
                  </h2>
                </div>
              )}
              <div className="flex-1 flex overflow-hidden">
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
                      />
                    </div>
                    <div className="flex-1 overflow-auto border-l">
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
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Selecione um dia no calendário para ver a agenda</p>
                  </div>
                )}
              </div>
            </div>
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

      {/* Status bar */}
      {tab === "agenda" && sched.selectedDate && (
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
    </div>
  );
}
