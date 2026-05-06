import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus, Printer, CheckCircle, Clock, Edit2 } from "lucide-react";
import type { Appointment, Patient } from "@/hooks/useScheduling";
import { useIsMobile } from "@/hooks/use-mobile";
import AppointmentDialog from "./AppointmentDialog";

import { printAppointments } from "./PrintSlip";

interface Props {
  title: string;
  slots: number[];
  appointments: Appointment[];
  date: string;
  variant: string;
  defaultTime: string;
  vacancies: number;
  onAdd: (slot: number, date: string, patientId: string, reason: string, type: string, scheduleTime?: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onPatientsChanged: () => void;
  onRefresh?: () => void;
  onUpdateTime?: (id: string, time: string) => void;
  onUpdateAppointment?: (id: string, updates: { reason?: string; type?: string; schedule_time?: string; patient_id?: string }) => void;
}

export default function SlotPanel({ title, slots, appointments, date, variant, defaultTime, vacancies, onAdd, onRemove, onPatientsChanged, onRefresh, onUpdateTime, onUpdateAppointment }: Props) {
  const isMobile = useIsMobile();
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);

  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState("");

  const getAppointment = (slot: number) => appointments.find(a => a.slot === slot);

  const occupied = slots.filter(s => getAppointment(s)).length;
  const dotColor = variant === "morning" ? "bg-morning" : "bg-afternoon";

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = slots.map(s => getAppointment(s)?.id).filter(Boolean) as string[];
    setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
  };

  const handlePrint = () => {
    const toPrint = appointments.filter(a => selectedIds.has(a.id));
    printAppointments(toPrint, () => {
      setSelectedIds(new Set());
      onRefresh?.();
    });
  };

  const startEditTime = (appt: Appointment) => {
    setEditingTimeId(appt.id);
    setEditTimeValue(appt.schedule_time || defaultTime);
  };

  const saveTime = () => {
    if (editingTimeId && editTimeValue && onUpdateTime) {
      onUpdateTime(editingTimeId, editTimeValue);
    }
    setEditingTimeId(null);
  };

  const openEditDialog = (appt: Appointment) => {
    setEditAppointment(appt);
    setDialogSlot(appt.slot);
  };

  const closeDialog = () => {
    setDialogSlot(null);
    setEditAppointment(null);
  };

  useEffect(() => {
    // Reset transient UI state on day switch to avoid stale portal/input interactions.
    closeDialog();
    setSelectedIds(new Set());
    setEditingTimeId(null);
    setEditTimeValue("");
  }, [date]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between border-b bg-card">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${dotColor}`}></span>
          <h3 className="font-bold text-sm tracking-wide">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {occupied > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
                {selectedIds.size > 0 ? "Limpar" : "Selecionar"}
              </Button>
              {selectedIds.size > 0 && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handlePrint}>
                  <Printer className="w-3 h-3" />
                  Imprimir ({selectedIds.size})
                </Button>
              )}
            </div>
          )}
          <span className="text-sm text-muted-foreground">{occupied}/{vacancies}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {slots.map(slot => {
          const appt = getAppointment(slot);
          const slotNum = String(slot).padStart(2, "0");
          const isSelected = appt ? selectedIds.has(appt.id) : false;
          const isPrinted = appt?.printed || false;

          return (
            <div
              key={slot}
              className={`flex items-center border-b px-4 py-3 hover:bg-muted/30 transition-colors group ${isSelected ? "bg-primary/5" : ""}`}
            >
              {appt && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(appt.id)}
                  className="mr-2 accent-primary w-4 h-4 cursor-pointer"
                />
              )}
              <span className="font-bold text-sm text-muted-foreground w-8">{slotNum}</span>
              {appt ? (
                <div className="flex-1 flex items-center justify-between">
                  <div
                    className="flex items-center gap-1 flex-wrap cursor-pointer flex-1"
                    onClick={() => openEditDialog(appt)}
                    title="Clique para editar"
                  >
                    <span className="font-medium text-sm">{appt.patients?.name || "—"}</span>
                    {!!appt.patients?.psf && (
                      <span className="text-xs text-muted-foreground">({appt.patients.psf})</span>
                    )}
                    {!!appt.reason && (
                      <span className="text-xs text-primary font-medium">{appt.reason}</span>
                    )}
                    {appt.type === "RETORNO" && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Retorno</span>
                    )}
                    {/* Time display/edit */}
                    {editingTimeId === appt.id ? (
                      <Input
                        type="time"
                        value={editTimeValue}
                        onChange={e => setEditTimeValue(e.target.value)}
                        onBlur={saveTime}
                        onKeyDown={e => e.key === "Enter" && saveTime()}
                        className="w-24 h-6 text-xs ml-1"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="text-xs text-muted-foreground ml-1 cursor-pointer hover:text-primary flex items-center gap-0.5"
                        onClick={e => { e.stopPropagation(); startEditTime(appt); }}
                        title="Clique para alterar horário"
                      >
                        <Clock className="w-3 h-3" />
                        {appt.schedule_time || defaultTime}
                      </span>
                    )}
                    {isPrinted && (
                      <span className="text-xs text-green-600 flex items-center gap-0.5" title="Impresso">
                        <CheckCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 text-primary transition-opacity ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={() => openEditDialog(appt)}
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 text-primary transition-opacity ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={() => printAppointments([appt], onRefresh || onPatientsChanged)}
                      title="Imprimir"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 text-destructive transition-opacity ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={() => { if (window.confirm("Excluir agendamento?")) onRemove(appt.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground italic">Livre</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditAppointment(null); setDialogSlot(slot); }}
                  >
                    <UserPlus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AppointmentDialog
        key={`${variant}-${date}`}
        open={dialogSlot !== null}
        onClose={closeDialog}
        slot={dialogSlot ?? slots[0]}
        date={date}
        variant={variant as any}
        defaultTime={defaultTime}
        title={title}
        onAdd={onAdd}
        onPatientsChanged={onPatientsChanged}
        editAppointment={editAppointment}
        onUpdate={onUpdateAppointment}
      />
    </div>
  );
}
