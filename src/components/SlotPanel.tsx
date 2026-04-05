import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import type { Appointment, Patient } from "@/hooks/useScheduling";
import AppointmentDialog from "./AppointmentDialog";

interface Props {
  title: string;
  subtitle: string;
  slots: number[];
  appointments: Appointment[];
  patients: Patient[];
  date: string;
  variant: "morning" | "afternoon";
  onAdd: (slot: number, date: string, patientId: string, reason: string, type: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}

export default function SlotPanel({ title, subtitle, slots, appointments, patients, date, variant, onAdd, onRemove }: Props) {
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);

  const getAppointment = (slot: number) => appointments.find(a => a.slot === slot);

  const bgClass = variant === "morning" ? "bg-[hsl(var(--morning))]" : "bg-[hsl(var(--afternoon))]";
  const fgClass = variant === "morning" ? "text-[hsl(var(--morning-foreground))]" : "text-[hsl(var(--afternoon-foreground))]";

  return (
    <div className="flex flex-col h-full">
      <div className={`${bgClass} ${fgClass} px-4 py-3 rounded-t-lg`}>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-xs opacity-80">{subtitle}</p>
      </div>
      <div className="flex-1 overflow-auto border border-t-0 rounded-b-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-1.5 text-left w-10">#</th>
              <th className="px-2 py-1.5 text-left">Paciente</th>
              <th className="px-2 py-1.5 text-left w-28">PSF</th>
              <th className="px-2 py-1.5 text-left">Motivo</th>
              <th className="px-2 py-1.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => {
              const appt = getAppointment(slot);
              return (
                <tr key={slot} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{slot}</td>
                  {appt ? (
                    <>
                      <td className="px-2 py-1.5 font-medium">{appt.patients?.name || "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{appt.patients?.psf || "—"}</td>
                      <td className="px-2 py-1.5">
                        {appt.reason && (
                          <Badge variant="secondary" className="text-xs font-normal">{appt.reason}</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onRemove(appt.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td colSpan={3} className="px-2 py-1.5 text-muted-foreground/50 italic">Vaga livre</td>
                      <td className="px-2 py-1.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => setDialogSlot(slot)}>
                          <UserPlus className="w-3 h-3" />
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
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
