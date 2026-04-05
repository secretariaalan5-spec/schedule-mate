import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScheduling, formatDateFull } from "@/hooks/useScheduling";
import DateSidebar from "@/components/DateSidebar";
import SlotPanel from "@/components/SlotPanel";
import PatientManager from "@/components/PatientManager";
import ImportExport from "@/components/ImportExport";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, LogOut, CalendarDays, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const MORNING_SLOTS = Array.from({ length: 15 }, (_, i) => i + 1);
const AFTERNOON_SLOTS = Array.from({ length: 17 }, (_, i) => i + 16);

export default function Dashboard() {
  const { signOut } = useAuth();
  const sched = useScheduling();
  const [tab, setTab] = useState("agenda");
  const [globalSearch, setGlobalSearch] = useState("");

  const handleRefresh = () => {
    sched.fetchReleasedDays();
    sched.fetchPatients();
    if (sched.selectedDate) sched.fetchAppointments(sched.selectedDate);
  };

  // Global search across appointments
  const searchResults = globalSearch
    ? sched.appointments.filter(a =>
        a.patients?.name.toUpperCase().includes(globalSearch.toUpperCase()) ||
        a.patients?.sus_card?.includes(globalSearch)
      )
    : [];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6" />
          <h1 className="font-bold text-lg">Saúde da Mulher</h1>
        </div>
        <div className="flex items-center gap-3">
          <ImportExport onImportComplete={handleRefresh} />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/60" />
            <Input
              placeholder="Buscar..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="pl-8 w-48 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 h-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-10">
              <TabsTrigger value="agenda" className="gap-1.5"><CalendarDays className="w-4 h-4" /> Agenda</TabsTrigger>
              <TabsTrigger value="pacientes" className="gap-1.5"><Users className="w-4 h-4" /> Pacientes</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="agenda" className="flex-1 flex overflow-hidden m-0">
            {/* Date sidebar */}
            <div className="w-52 border-r bg-card flex-shrink-0 overflow-hidden">
              <DateSidebar
                releasedDays={sched.releasedDays}
                selectedDate={sched.selectedDate}
                onSelectDate={sched.setSelectedDate}
                onAddDay={sched.addReleasedDay}
                onRemoveDay={sched.removeReleasedDay}
              />
            </div>

            {/* Slots */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {sched.selectedDate && (
                <div className="px-4 py-2 border-b bg-card">
                  <h2 className="font-semibold capitalize">{formatDateFull(sched.selectedDate)}</h2>
                </div>
              )}
              <div className="flex-1 flex overflow-hidden">
                {sched.selectedDate ? (
                  <>
                    <div className="flex-1 p-3 overflow-auto">
                      <SlotPanel
                        title="Manhã"
                        subtitle="Zona Rural"
                        slots={MORNING_SLOTS}
                        appointments={sched.appointments}
                        patients={sched.patients}
                        date={sched.selectedDate}
                        variant="morning"
                        onAdd={sched.addAppointment}
                        onRemove={sched.removeAppointment}
                      />
                    </div>
                    <div className="flex-1 p-3 overflow-auto border-l">
                      <SlotPanel
                        title="Tarde"
                        subtitle="Cidade / Camocim"
                        slots={AFTERNOON_SLOTS}
                        appointments={sched.appointments}
                        patients={sched.patients}
                        date={sched.selectedDate}
                        variant="afternoon"
                        onAdd={sched.addAppointment}
                        onRemove={sched.removeAppointment}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Selecione um dia liberado para ver a agenda</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pacientes" className="flex-1 overflow-hidden m-0">
            <PatientManager
              patients={sched.patients}
              onAdd={sched.addPatient}
              onUpdate={sched.updatePatient}
              onDelete={sched.deletePatient}
              onGetHistory={sched.getPatientHistory}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
