import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CalendarClock } from "lucide-react";
import type { Patient, Appointment } from "@/hooks/useScheduling";
import { formatDateBR } from "@/hooks/useScheduling";
import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/hooks/usePatients";
import { useDebounce } from "@/hooks/use-debounce";

interface Props {
  open: boolean;
  onClose: () => void;
  slot: number;
  date: string;
  variant: "morning" | "afternoon";
  defaultTime: string;
  title: string;
  onAdd: (slot: number, date: string, patientId: string, reason: string, type: string, scheduleTime?: string) => Promise<boolean>;
  onPatientsChanged: () => void;
  editAppointment?: Appointment | null;
  onUpdate?: (id: string, updates: { reason?: string; type?: string; schedule_time?: string; patient_id?: string }) => void;
}

export default function AppointmentDialog({ open, onClose, slot, date, variant, defaultTime, title, onAdd, onPatientsChanged, editAppointment, onUpdate }: Props) {
  const isEditing = !!editAppointment;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const effectiveSearch = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : "";
  const { patients: searchResults, isLoading: isSearching } = usePatients(effectiveSearch);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [name, setName] = useState("");
  const [susCard, setSusCard] = useState("");
  const [dob, setDob] = useState("");
  const [psf, setPsf] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("NORMAL");
  const [scheduleTime, setScheduleTime] = useState(defaultTime);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<"name" | "susCard" | "dob" | "psf" | null>(null);
  const [patientMonthAppointments, setPatientMonthAppointments] = useState<Appointment[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [monthPatientIds, setMonthPatientIds] = useState<Set<string>>(new Set());
  const nameInputRef = useRef<HTMLInputElement>(null);

  // When a patient is selected, check for existing appointments this month
  const checkMonthAppointments = useCallback(async (patientId: string) => {
    const monthStart = date.substring(0, 7) + "-01";
    const month = parseInt(date.substring(5, 7));
    const year = parseInt(date.substring(0, 4));
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = date.substring(0, 7) + "-" + String(lastDay).padStart(2, "0");

    const { data } = await supabase
      .from("appointments")
      .select("*, patients(*)")
      .eq("patient_id", patientId)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date");
    setPatientMonthAppointments((data as any) || []);
  }, [date]);

  // Load patient_ids already booked this month — used to flag duplicates inside dropdown
  useEffect(() => {
    if (!open) return;
    const monthStart = date.substring(0, 7) + "-01";
    const month = parseInt(date.substring(5, 7));
    const year = parseInt(date.substring(0, 4));
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = date.substring(0, 7) + "-" + String(lastDay).padStart(2, "0");
    supabase
      .from("appointments")
      .select("patient_id")
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .then(({ data }) => {
        setMonthPatientIds(new Set((data ?? []).map((d: any) => d.patient_id)));
      });
  }, [open, date]);

  // Pre-fill when editing
  useEffect(() => {
    if (editAppointment) {
      const pt = editAppointment.patients;
      if (pt) {
        setSelectedPatient(pt);
        setSearch(pt.name);
        setName(pt.name);
        setSusCard(pt.sus_card || "");
        setDob(pt.dob || "");
        setPsf(pt.psf || "");
        checkMonthAppointments(pt.id);
      }
      setReason(editAppointment.reason || "");
      setType(editAppointment.type || "NORMAL");
      setScheduleTime(editAppointment.schedule_time || defaultTime);
    }
  }, [editAppointment, defaultTime, checkMonthAppointments]);

  const variantLabel = title;

  const filtered = useMemo(() => {
    if (!search || isEditing) return [];
    return searchResults.slice(0, 10);
  }, [searchResults, search, isEditing]);

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setName(p.name);
    setSusCard(p.sus_card || "");
    setDob(p.dob || "");
    setPsf(p.psf || "");
    setSearch(p.name);
    setShowResults(false);
    setActiveSearchField(null);
    checkMonthAppointments(p.id);
  };

  const renderSearchResults = (field: "name" | "susCard" | "dob" | "psf") => {
    if (!showResults || activeSearchField !== field || !search) return null;

    return (
      <ScrollArea className="absolute z-50 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-48">
        {isSearching ? (
          <div className="px-3 py-4 text-sm text-center text-muted-foreground">Buscando...</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-sm text-center text-muted-foreground">Paciente não encontrado. Ao salvar, um novo será criado.</div>
        ) : (
          filtered.map(p => (
            <div
              key={p.id}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors flex items-center justify-between"
              onMouseDown={(e) => {
                e.preventDefault();
                selectPatient(p);
              }}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.psf && <span className="text-xs text-muted-foreground">({p.psf})</span>}
                </div>
                {p.dob && (
                  <span className="text-xs text-muted-foreground mt-0.5">
                    Nasc: {formatDateBR(p.dob)}
                  </span>
                )}
              </div>
              {p.sus_card && (
                <span className="text-xs text-muted-foreground font-mono">{p.sus_card}</span>
              )}
            </div>
          ))
        )}
      </ScrollArea>
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);

    if (isEditing && onUpdate) {
      const updates: any = {
        reason: reason || null,
        type,
        schedule_time: scheduleTime,
      };
      onUpdate(editAppointment!.id, updates);
      setLoading(false);
      onClose();
      return;
    }

    let patientId = selectedPatient?.id;

    if (!patientId || name.trim().toUpperCase() !== selectedPatient?.name.toUpperCase()) {
      const { data, error } = await supabase.from("patients").insert({
        name: name.trim().toUpperCase(),
        sus_card: susCard || null,
        dob: dob || null,
        psf: psf || null,
      }).select("id").single();

      if (error) {
        setLoading(false);
        return;
      }
      patientId = data.id;
      onPatientsChanged();
    } else {
      const updates: Partial<Patient> = {};
      if (susCard !== (selectedPatient.sus_card || "")) updates.sus_card = susCard || null;
      if (dob !== (selectedPatient.dob || "")) updates.dob = dob || null;
      if (psf !== (selectedPatient.psf || "")) updates.psf = psf || null;
      if (Object.keys(updates).length > 0) {
        await supabase.from("patients").update(updates).eq("id", patientId);
        onPatientsChanged();
      }
    }

    const ok = await onAdd(slot, date, patientId!, reason, type, scheduleTime);
    setLoading(false);
    if (ok) onClose();
  };

  // Filter out current appointment from month list
  const existingAppointments = patientMonthAppointments.filter(
    a => !editAppointment || a.id !== editAppointment.id
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar" : "Vaga"} {String(slot).padStart(2, "0")} — {variantLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Duplicate warning */}
          {existingAppointments.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Paciente já possui consulta(s) neste mês:</p>
                <div className="mt-1 space-y-0.5">
                  {existingAppointments.map(a => (
                    <p key={a.id} className="text-xs text-muted-foreground">
                      {formatDateBR(a.date)} — Vaga {String(a.slot).padStart(2, "0")} — {a.schedule_time} — {a.type}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5 relative">
            <Label>Nome do Paciente</Label>
            <Input
              placeholder="Pesquisar por nome, cartão SUS, nascimento ou PSF..."
              value={name}
              onChange={e => {
                const val = e.target.value;
                setName(val);
                setSearch(val);
                setActiveSearchField("name");
                setShowResults(true);
                if (!val) {
                  setSelectedPatient(null);
                  setPatientMonthAppointments([]);
                }
              }}
              onFocus={() => {
                if (name) {
                  setSearch(name);
                  setActiveSearchField("name");
                  setShowResults(true);
                }
              }}
              onBlur={() => {
                setShowResults(false);
                setActiveSearchField(null);
              }}
              disabled={isEditing}
            />
            {renderSearchResults("name")}
          </div>

          {!isEditing && (
            <div className="contents">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 relative">
                  <Label>Cartão SUS</Label>
                  <Input 
                    placeholder="Nº do cartão" 
                    value={susCard} 
                    onChange={e => {
                      const val = e.target.value;
                      setSusCard(val);
                      setSearch(val);
                      setActiveSearchField("susCard");
                      setShowResults(true);
                    }} 
                    onFocus={() => {
                      if (susCard) {
                        setSearch(susCard);
                        setActiveSearchField("susCard");
                        setShowResults(true);
                      }
                    }}
                    onBlur={() => {
                      setShowResults(false);
                      setActiveSearchField(null);
                    }}
                  />
                  {renderSearchResults("susCard")}
                </div>
                <div className="space-y-1.5 relative">
                  <Label>Data de Nascimento</Label>
                  <Input 
                    type="date" 
                    value={dob} 
                    onChange={e => {
                      const val = e.target.value;
                      setDob(val);
                      setSearch(val);
                      setActiveSearchField("dob");
                      setShowResults(true);
                    }} 
                    onFocus={() => {
                      if (dob) {
                        setSearch(dob);
                        setActiveSearchField("dob");
                        setShowResults(true);
                      }
                    }}
                    onBlur={() => {
                      setShowResults(false);
                      setActiveSearchField(null);
                    }}
                  />
                  {renderSearchResults("dob")}
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <Label>PSF / UBS</Label>
                <Input 
                  placeholder="Nome do PSF / UBS" 
                  value={psf} 
                  onChange={e => {
                    const val = e.target.value;
                    setPsf(val);
                    setSearch(val);
                    setActiveSearchField("psf");
                    setShowResults(true);
                  }} 
                  onFocus={() => {
                    if (psf) {
                      setSearch(psf);
                      setActiveSearchField("psf");
                      setShowResults(true);
                    }
                  }}
                  onBlur={() => {
                    setShowResults(false);
                    setActiveSearchField(null);
                  }}
                />
                {renderSearchResults("psf")}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Horário da Consulta</Label>
              <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo / Observação</Label>
              <Input placeholder="Motivo da consulta" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={type === "NORMAL" ? "default" : "outline"}
              onClick={() => setType("NORMAL")}
              className="w-full"
            >
              Normal
            </Button>
            <Button
              type="button"
              variant={type === "RETORNO" ? "default" : "outline"}
              onClick={() => setType("RETORNO")}
              className="w-full"
            >
              Retorno
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim() || loading}>
              {loading ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
