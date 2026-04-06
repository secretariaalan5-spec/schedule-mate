import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, UserPlus } from "lucide-react";
import type { Appointment, Patient } from "@/hooks/useScheduling";
import AppointmentDialog from "./AppointmentDialog";

interface Props {
  title: string;
  slots: number[];
  appointments: Appointment[];
  patients: Patient[];
  date: string;
  variant: "morning" | "afternoon";
  vacancies: number;
  onAdd: (slot: number, date: string, patientId: string, reason: string, type: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}

export default function SlotPanel({ title, slots, appointments, patients, date, variant, vacancies, onAdd, onRemove }: Props) {
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);

  const getAppointment = (slot: number) => appointments.find(a => a.slot === slot);

  const occupied = slots.filter(s => getAppointment(s)).length;
  const dotColor = variant === "morning" ? "bg-green-500" : "bg-purple-500";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b bg-white">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${dotColor}`}></span>
          <h3 className="font-bold text-sm tracking-wide">{title}</h3>
        </div>
        <span className="text-sm text-muted-foreground">{vacancies} vagas</span>
      </div>

      {/* Slot rows */}
      <div className="flex-1 overflow-auto">
        {slots.map(slot => {
          const appt = getAppointment(slot);
          const slotNum = String(slot).padStart(2, "0");

          return (
            <div
              key={slot}
              className="flex items-center border-b px-4 py-3 hover:bg-muted/30 transition-colors group"
            >
              <span className="font-bold text-sm text-muted-foreground w-8">{slotNum}</span>
              {appt ? (
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{appt.patients?.name || "—"}</span>
                    {appt.patients?.psf && (
                      <span className="ml-2 text-xs text-muted-foreground">({appt.patients.psf})</span>
                    )}
                    {appt.reason && (
                      <span className="ml-2 text-xs text-primary font-medium">{appt.reason}</span>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(appt.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground italic">Livre</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDialogSlot(slot)}
                  >
                    <UserPlus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dialogSlot !== null && (
        <AppointmentDialog
          open={true}
          onClose={() => setDialogSlot(null)}
          slot={dialogSlot}
          date={date}
          patients={patients}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}
