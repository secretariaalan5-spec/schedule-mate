import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus, Printer, CheckCircle, Clock, Edit2 } from "lucide-react";
import type { Appointment, Patient } from "@/hooks/useScheduling";
import { useIsMobile } from "@/hooks/use-mobile";
import AppointmentDialog from "./AppointmentDialog";
import { printAppointments } from "./PrintSlip";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Header — matches the template style */}
      <header className="p-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-transparent">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 animate-pulse",
            variant === "morning" ? "bg-orange-500" : "bg-primary"
          )} />
          <h3 className="text-title-sm font-bold uppercase text-on-surface">{title}</h3>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
          <div className="text-[11px] font-bold text-on-surface-variant flex gap-3">
            <span className="text-secondary" title="Impressos">✓ {printedCount}</span>
            <span className="text-orange-500" title="Pendentes">-{pendingCount}</span>
            <span className="opacity-60">{freeCount} livres</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[10px] font-bold uppercase hover:bg-white/60 border border-outline-variant/60 rounded-lg text-on-surface-variant"
              onClick={selectAll}
            >
              {selectedIds.size > 0 ? "Limpar" : "Selecionar"}
            </Button>
            
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                className="h-7 px-2.5 text-[10px] font-bold uppercase text-white gap-1 rounded-lg shadow-sm"
                style={{ background: "#6c0029" }}
                onClick={handlePrint}
              >
                <Printer className="w-3 h-3" />
                Imprimir ({selectedIds.size})
              </Button>
            )}
          </div>

          <span className="text-body-sm font-bold text-on-surface-variant bg-white px-2.5 py-0.5 border border-outline-variant/60 rounded-md shrink-0">
            {occupied}/{vacancies}
          </span>
        </div>
      </header>

      {/* Cards container — spaced lists */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-1 pb-10 space-y-3">
        {slots.map(slot => {
          const appt = getAppointment(slot);
          const slotNum = String(slot).padStart(2, "0");
          const isSelected = appt ? selectedIds.has(appt.id) : false;
          const isPrinted = appt?.printed || false;

          return (
            <div key={slot}>
              {appt ? (
                /* Patient Card */
                <div
                  className={cn(
                    "border rounded-lg shadow-sm flex gap-4 p-4 hover:shadow-md transition-all cursor-pointer group border-l-4",
                    isPrinted
                      ? "bg-emerald-50/30 border-emerald-200 border-l-emerald-600"
                      : "bg-amber-50/40 border-amber-200 border-l-amber-500",
                    isSelected ? "ring-2 ring-primary/40 border-primary" : ""
                  )}
                  onClick={(e) => handlePatientClick(e, appt)}
                >
                  <div className="flex flex-col items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(appt.id)}
                      className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-title-sm font-bold text-on-surface-variant opacity-40">{slotNum}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-body-md font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                      {appt.patients?.name || "—"}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] font-bold text-on-surface-variant/80">
                      {appt.patients?.sus_card && (
                        <span className="font-mono text-[10px] bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                          {appt.patients.sus_card}
                        </span>
                      )}
                      
                      {appt.patients?.psf && (
                        <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px] uppercase font-black">
                          ({appt.patients.psf})
                        </span>
                      )}

                      {/* Health Conditions / Risk badges */}
                      {appt.patients?.risk_classification === "ALTO" && (
                        <span className="text-error font-extrabold uppercase text-[10px]">Alto Risco</span>
                      )}
                      {appt.patients?.is_pregnant && (
                        <span className="text-error font-extrabold uppercase text-[10px]">Gestante</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      {/* Time display/edit */}
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {editingTimeId === appt.id ? (
                          <Input
                            type="time"
                            value={editTimeValue}
                            onChange={e => setEditTimeValue(e.target.value)}
                            onBlur={saveTime}
                            onKeyDown={e => e.key === "Enter" && saveTime()}
                            className="w-20 h-6 text-[11px] p-1 border-[#E7E9EF] focus:border-primary"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="text-[11px] text-on-surface-variant/70 cursor-pointer hover:text-primary flex items-center gap-1 font-bold"
                            onClick={() => startEditTime(appt)}
                            title="Clique para alterar"
                          >
                            <Clock className="w-3.5 h-3.5 opacity-60" />
                            {appt.schedule_time || defaultTime}
                          </span>
                        )}
                      </div>

                      {/* Reason */}
                      {appt.reason && (
                        <span className="text-primary font-extrabold text-[10px] uppercase tracking-wider">
                          {appt.reason}
                        </span>
                      )}

                      {/* Status Badge — GREEN for Printed, YELLOW for Pending */}
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tighter shrink-0 flex items-center gap-1.5",
                          isPrinted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-amber-100 text-amber-900 border border-amber-300"
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", isPrinted ? "bg-emerald-600" : "bg-amber-500 animate-pulse")} />
                        {isPrinted ? "Impresso" : "Pendente"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col justify-between items-end shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                    <div className={cn(
                      "flex gap-1 transition-opacity duration-150",
                      isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-on-surface-variant hover:text-primary hover:bg-slate-100 rounded-full"
                        onClick={() => openEditDialog(appt)}
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-on-surface-variant hover:text-on-secondary-container hover:bg-slate-100 rounded-full"
                        onClick={() => printAppointments([appt], onRefresh || onPatientsChanged)}
                        title="Imprimir"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-red-50 rounded-full"
                        onClick={() => { if (window.confirm("Excluir agendamento?")) onRemove(appt.id); }}
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Free Slot Row Card */
                <div
                  onClick={() => openNewDialog(slot)}
                  className="bg-white/50 border border-dashed border-outline-variant rounded-lg p-3.5 flex items-center justify-between text-on-surface-variant/60 hover:border-primary hover:text-primary hover:bg-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold opacity-45">{slotNum}</span>
                    <span className="text-xs font-semibold italic">Livre</span>
                  </div>
                  <UserPlus className="w-4 h-4 text-primary/65 group-hover:text-primary group-hover:scale-110 transition-all shrink-0" />
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
        onClearPreselectedPatient={onClearPreselectedPatient}
      />
    </div>
  );
}
