import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, AlertTriangle, Info, ArrowLeftRight,
  CreditCard, Calendar, MapPin, HelpCircle, CheckCircle2, Trash2, X
} from "lucide-react";
import type { Patient } from "@/hooks/useScheduling";
import { usePatients } from "@/hooks/usePatients";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateBR } from "@/hooks/useScheduling";
import { supabase } from "@/integrations/supabase/client";

interface MergePatientsDialogProps {
  open: boolean;
  onClose: () => void;
  primaryPatient: Patient | null;
  onMergeSuccess: () => void;
  mergePatients: (args: { masterId: string; duplicateId: string }) => Promise<any>;
}

// Compute the merged result preview against multiple duplicates
function computeMergedPreview(master: Patient, duplicates: Patient[]): Patient {
  return duplicates.reduce<Patient>((acc, dup) => ({
    ...acc,
    sus_card: acc.sus_card ?? dup.sus_card,
    dob: acc.dob ?? dup.dob,
    psf: acc.psf ?? dup.psf,
    observations:
      acc.observations && dup.observations && acc.observations !== dup.observations
        ? `${acc.observations}\n[Unificado] ${dup.observations}`
        : acc.observations ?? dup.observations,
  }), { ...master });
}

// Inline patient data row
function DataRow({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0 w-28 text-xs">{label}</span>
      <span className={`font-medium ${highlight ? "text-primary font-semibold" : value ? "text-foreground" : "text-muted-foreground italic"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

// Patient card — similar to PEC eSUS layout
function PatientCard({
  patient,
  role,
  appointmentsCount,
  onSelect,
  onRemove,
  selected,
}: {
  patient: Patient;
  role: "master" | "duplicate" | "merged";
  appointmentsCount?: number | null;
  onSelect?: () => void;
  onRemove?: () => void;
  selected?: boolean;
}) {
  const borderColor =
    role === "master" ? "border-primary/30 bg-primary/5" :
    role === "merged" ? "border-primary/40 bg-card" :
    selected ? "border-primary/50 bg-primary/5" :
    "border-border bg-card";

  return (
    <div className={`rounded-lg border-2 ${borderColor} p-4 transition-colors`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold text-base uppercase truncate">{patient.name}</p>
          {role === "master" && (
            <Badge className="bg-primary text-white text-[10px] px-1.5 py-0 shrink-0 font-semibold">
              Cadastro principal
            </Badge>
          )}
          {selected && role === "duplicate" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              Selecionado
            </Badge>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          {onSelect && !selected && (
            <Button size="sm" className="h-8 text-xs px-3" onClick={onSelect}>
              Selecionar
            </Button>
          )}
          {onRemove && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onRemove} title="Remover da seleção">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        <DataRow
          icon={<CreditCard className="w-3.5 h-3.5" />}
          label="Cartão SUS"
          value={patient.sus_card}
          highlight={role === "merged" && !!patient.sus_card}
        />
        <DataRow
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="Data de nasc."
          value={patient.dob ? formatDateBR(patient.dob) : null}
          highlight={role === "merged" && !!patient.dob}
        />
        <DataRow
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="PSF / UBS"
          value={patient.psf}
          highlight={role === "merged" && !!patient.psf}
        />
        {appointmentsCount !== undefined && (
          <DataRow
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Consultas"
            value={appointmentsCount === null ? "Verificando..." : `${appointmentsCount} consulta${appointmentsCount !== 1 ? "s" : ""}`}
          />
        )}
      </div>
    </div>
  );
}

export default function MergePatientsDialog({
  open,
  onClose,
  primaryPatient,
  onMergeSuccess,
  mergePatients,
}: MergePatientsDialogProps) {
  const [phase, setPhase] = useState<"select" | "confirm">("select");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { patients: searchResults, isLoading: isSearching } = usePatients(debouncedSearch, "all");

  // Multiple duplicates support
  const [selectedDuplicates, setSelectedDuplicates] = useState<Patient[]>([]);
  const [duplicateApptsCounts, setDuplicateApptsCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Exclude primary + already selected from results
  const filteredResults = searchResults.filter(
    (p) => p.id !== primaryPatient?.id && !selectedDuplicates.some((d) => d.id === p.id)
  );

  // Fetch appointment counts for all selected duplicates
  useEffect(() => {
    for (const dup of selectedDuplicates) {
      if (duplicateApptsCounts[dup.id] !== undefined) continue;
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", dup.id)
        .then(({ count, error }) => {
          if (!error) {
            setDuplicateApptsCounts((prev) => ({ ...prev, [dup.id]: count || 0 }));
          }
        });
    }
  }, [selectedDuplicates]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase("select");
      setSearch("");
      setSelectedDuplicates([]);
      setDuplicateApptsCounts({});
      setConfirmed(false);
    }
  }, [open, primaryPatient]);

  const handleSelect = (p: Patient) => {
    setSelectedDuplicates((prev) => [...prev, p]);
    setConfirmed(false);
    setSearch("");
  };

  const handleRemove = (id: string) => {
    setSelectedDuplicates((prev) => prev.filter((d) => d.id !== id));
    setDuplicateApptsCounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setConfirmed(false);
  };

  const handleBack = () => {
    setConfirmed(false);
    setPhase("select");
  };

  const handleGoToConfirm = () => {
    if (selectedDuplicates.length === 0) return;
    setPhase("confirm");
  };

  const handleConfirm = async () => {
    if (!primaryPatient || selectedDuplicates.length === 0) return;
    setLoading(true);
    try {
      // Merge duplicates one by one into master
      for (const dup of selectedDuplicates) {
        await mergePatients({ masterId: primaryPatient.id, duplicateId: dup.id });
      }
      onMergeSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const mergedPreview =
    primaryPatient && selectedDuplicates.length > 0
      ? computeMergedPreview(primaryPatient, selectedDuplicates)
      : null;

  const totalTransferAppts = Object.values(duplicateApptsCounts).reduce<number>(
    (sum, c) => sum + (c ?? 0), 0
  );
  const allCountsReady = selectedDuplicates.every((d) => duplicateApptsCounts[d.id] !== undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Unificar cadastros
          </DialogTitle>
          <DialogDescription className="text-sm">
            {phase === "select"
              ? "Selecione um ou mais cadastros duplicados. O cadastro atual ficará como principal e seus dados irão prevalecer."
              : "Verifique os dados e confirme a unificação."}
          </DialogDescription>
        </DialogHeader>

        {/* ── PHASE: SELECT ── */}
        {phase === "select" && (
          <div className="flex-1 overflow-y-auto">
            {/* Info banner */}
            <div className="mx-6 mt-4 flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                O cadastro principal definirá os dados que irão prevalecer. Campos vazios serão preenchidos com os dados dos duplicados. Você pode selecionar <strong>um ou mais</strong> cadastros duplicados.
              </span>
            </div>

            <div className="px-6 pb-6 mt-4 space-y-4">
              {/* Primary patient card */}
              {primaryPatient && (
                <PatientCard patient={primaryPatient} role="master" />
              )}

              {/* Selected duplicates list */}
              {selectedDuplicates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Duplicados selecionados
                    <Badge variant="secondary" className="font-semibold">{selectedDuplicates.length}</Badge>
                  </p>
                  {selectedDuplicates.map((dup) => (
                    <PatientCard
                      key={dup.id}
                      patient={dup}
                      role="duplicate"
                      selected
                      appointmentsCount={duplicateApptsCounts[dup.id] ?? null}
                      onRemove={() => handleRemove(dup.id)}
                    />
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {selectedDuplicates.length === 0 ? "Buscar cadastro duplicado" : "Adicionar mais duplicados"}
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Nome ou Cartão SUS..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Results */}
              {!search.trim() ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Digite o nome ou CNS para buscar
                </div>
              ) : isSearching ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum resultado encontrado para "{search}"
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredResults.map((p) => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      role="duplicate"
                      onSelect={() => handleSelect(p)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PHASE: CONFIRM ── */}
        {phase === "confirm" && primaryPatient && selectedDuplicates.length > 0 && mergedPreview && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                O cadastro ficará com os seguintes dados após a unificação de <strong>{selectedDuplicates.length + 1} cadastros</strong>:
              </p>
            </div>

            {/* Merged preview */}
            <PatientCard patient={mergedPreview} role="merged" />

            {/* List of what will be deleted */}
            <div className="space-y-2">
              {selectedDuplicates.map((dup) => (
                <div key={dup.id} className="flex items-start gap-2 text-sm bg-muted/40 border rounded-lg px-3 py-2.5">
                  <Trash2 className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <span>
                    <strong className="uppercase">{dup.name}</strong> será{" "}
                    <strong className="text-destructive">excluído permanentemente</strong>
                    {(duplicateApptsCounts[dup.id] ?? 0) > 0 && (
                      <> — <strong>{duplicateApptsCounts[dup.id]}</strong> consulta{(duplicateApptsCounts[dup.id] ?? 0) !== 1 ? "s" : ""} serão transferidas</>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {totalTransferAppts > 0 && (
              <div className="flex items-start gap-2 text-xs bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  No total, <strong>{totalTransferAppts} consulta{totalTransferAppts !== 1 ? "s" : ""}</strong> serão transferidas para o cadastro principal.
                </span>
              </div>
            )}

            {/* Warning + checkbox */}
            <div className="border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-3 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Esta ação não pode ser desfeita
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 accent-primary w-3.5 h-3.5 shrink-0"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  Confirmo que desejo unificar {selectedDuplicates.length + 1} cadastros e estou ciente que os cadastros duplicados serão excluídos permanentemente.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3">
          {phase === "select" ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={handleGoToConfirm}
                disabled={selectedDuplicates.length === 0 || !allCountsReady}
                className="gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Revisar unificação{selectedDuplicates.length > 0 ? ` (${selectedDuplicates.length})` : ""}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading || !confirmed || !allCountsReady}
                className="gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                {loading
                  ? `Unificando... (${selectedDuplicates.length})`
                  : `Confirmar unificação (${selectedDuplicates.length} duplicado${selectedDuplicates.length !== 1 ? "s" : ""})`}
              </Button>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
