import { useEffect, useState, useCallback } from "react";
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
  preselectedPatient?: Patient | null;
  onClearPreselectedPatient?: () => void;
}

export default function SlotPanel({ title, slots, appointments, date, variant, defaultTime, vacancies, onAdd, onRemove, onPatientsChanged, onRefresh, onUpdateTime, onUpdateAppointment, preselectedPatient, onClearPreselectedPatient }: Props) {
  const isMobile = useIsMobile();
  const [dialogSlot, setDialogSlot] = useState<number | null>(null);

  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState("");
  // Counter to force AppointmentDialog to remount when we need a fresh state
  const [dialogResetKey, setDialogResetKey] = useState(0);

  const getAppointment = (slot: number) => appointments.find(a => a.slot === slot);

  const occupied = slots.filter(s => getAppointment(s)).length;
  const printedCount = appointments.filter(a => a.printed).length;
  const pendingCount = occupied - printedCount;
  const freeCount = vacancies - occupied;
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

  const handlePatientClick = (e: React.MouseEvent, appt: Appointment) => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim().length > 0) {
      return;
    }
    openEditDialog(appt);
  };

  const openNewDialog = useCallback((slot: number) => {
    setEditAppointment(null);
    setDialogResetKey(k => k + 1);
    setDialogSlot(slot);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogSlot(null);
    setEditAppointment(null);
    onClearPreselectedPatient?.();
  }, [onClearPreselectedPatient]);

  useEffect(() => {
    // Close dialog PROPERLY (set open=false) before any key change, so Radix
    // cleans up its portal overlay correctly.
    closeDialog();
    setEditingTimeId(null);
    setEditTimeValue("");
  }, [date, closeDialog]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between border-b bg-card">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${dotColor}`}></span>
          <div className="flex flex-col leading-tight">
            <h3 className="font-bold text-sm tracking-wide">{title}</h3>
            <div className="flex items-center gap-2 text-[10px] font-medium mt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400">✓ {printedCount}</span>
              <span className="text-amber-600 dark:text-amber-400">⏳ {pendingCount}</span>
              <span className="text-muted-foreground">{freeCount} livre{freeCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
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
              className={`flex items-center border-b px-4 py-3 hover:bg-muted/30 transition-colors group border-l-4 ${
                appt
                  ? isPrinted
                    ? "border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
                  : "border-l-transparent"
              } ${isSelected ? "bg-primary/10" : ""}`}
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
                    className="flex items-center gap-2 flex-wrap cursor-pointer flex-1"
                    onClick={(e) => handlePatientClick(e, appt)}
                    title="Clique para editar"
                  >
                    <span className="font-semibold text-[15px] leading-tight select-text">{appt.patients?.name || "—"}</span>

                    {appt.patients?.sus_card && (
                      <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0 select-text">
                        {appt.patients.sus_card}
                      </span>
                    )}

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
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-1 ${
                        isPrinted
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }`}
                      title={isPrinted ? "Impresso" : "Pendente"}
                    >
                      {isPrinted ? (
                        <span className="flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" /> Impresso</span>
                      ) : (
                        "Pendente"
                      )}
                    </span>
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
                /* ── Empty slot: entire row is tappable on mobile ── */
                <div
                  className="flex-1 flex items-center justify-between cursor-pointer"
                  onClick={() => openNewDialog(slot)}
                >
                  <span className="text-sm text-muted-foreground italic">Livre</span>
                  <UserPlus className={`w-4 h-4 text-primary transition-opacity ${isMobile ? "opacity-60" : "opacity-0 group-hover:opacity-100"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AppointmentDialog
        key={`${variant}-${dialogResetKey}`}
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
        preselectedPatient={preselectedPatient}
      />
    </div>
  );
}
