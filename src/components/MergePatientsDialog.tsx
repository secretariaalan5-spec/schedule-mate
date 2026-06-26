import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, AlertTriangle, Info, ArrowLeftRight,
  CreditCard, Calendar, MapPin, HelpCircle, CheckCircle2, Trash2
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

// Compute the merged result preview
function computeMergedPreview(master: Patient, duplicate: Patient): Patient {
  return {
    ...master,
    sus_card: master.sus_card ?? duplicate.sus_card,
    dob: master.dob ?? duplicate.dob,
    psf: master.psf ?? duplicate.psf,
    observations:
      master.observations && duplicate.observations && master.observations !== duplicate.observations
        ? `${master.observations}\n[Unificado] ${duplicate.observations}`
        : master.observations ?? duplicate.observations,
  };
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
}: {
  patient: Patient;
  role: "master" | "duplicate" | "merged";
  appointmentsCount?: number | null;
  onSelect?: () => void;
}) {
  const borderColor =
    role === "master" ? "border-primary/30 bg-primary/5" :
    role === "merged" ? "border-primary/40 bg-card" :
    "border-border bg-card";

  return (
    <div className={`rounded-lg border-2 ${borderColor} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold text-base uppercase truncate">{patient.name}</p>
          {role === "master" && (
            <Badge className="bg-primary text-white text-[10px] px-1.5 py-0 shrink-0 font-semibold">
              Cadastro principal
            </Badge>
          )}
        </div>
        {onSelect && (
          <Button size="sm" className="shrink-0 h-8 text-xs px-3" onClick={onSelect}>
            Selecionar como duplicado
          </Button>
        )}
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

  const [duplicatePatient, setDuplicatePatient] = useState<Patient | null>(null);
  const [duplicateApptsCount, setDuplicateApptsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const filteredResults = searchResults.filter((p) => p.id !== primaryPatient?.id);

  useEffect(() => {
    if (!duplicatePatient) { setDuplicateApptsCount(null); return; }
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", duplicatePatient.id)
      .then(({ count, error }) => { if (!error) setDuplicateApptsCount(count || 0); });
  }, [duplicatePatient]);

  useEffect(() => {
    if (open) {
      setPhase("select");
      setSearch("");
      setDuplicatePatient(null);
      setDuplicateApptsCount(null);
      setConfirmed(false);
    }
  }, [open, primaryPatient]);

  const handleSelect = (p: Patient) => {
    setDuplicatePatient(p);
    setConfirmed(false);
    setPhase("confirm");
  };

  const handleBack = () => {
    setDuplicatePatient(null);
    setDuplicateApptsCount(null);
    setConfirmed(false);
    setPhase("select");
  };

  const handleConfirm = async () => {
    if (!primaryPatient || !duplicatePatient) return;
    setLoading(true);
    try {
      await mergePatients({ masterId: primaryPatient.id, duplicateId: duplicatePatient.id });
      onMergeSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const mergedPreview =
    primaryPatient && duplicatePatient
      ? computeMergedPreview(primaryPatient, duplicatePatient)
      : null;

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
              ? "Selecione o cadastro duplicado. O cadastro atual ficará como principal e seus dados irão prevalecer."
              : "Deseja confirmar a unificação de cadastros?"}
          </DialogDescription>
        </DialogHeader>

        {/* ── PHASE: SELECT ── */}
        {phase === "select" && (
          <div className="flex-1 overflow-y-auto">
            {/* Info banner — like PEC */}
            <div className="mx-6 mt-4 flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                O cadastro principal definirá os dados que irão prevalecer. Campos vazios no principal serão preenchidos com os dados do duplicado.
              </span>
            </div>

            <div className="px-6 pb-6 mt-4 space-y-4">
              {/* Primary patient card */}
              {primaryPatient && (
                <PatientCard patient={primaryPatient} role="master" />
              )}

              {/* Search */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Buscar cadastro duplicado</p>
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
                <div className="text-center py-10 text-muted-foreground text-sm">
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
                <div className="text-center py-10 text-muted-foreground text-sm">
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
        {phase === "confirm" && primaryPatient && duplicatePatient && mergedPreview && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Question icon + subtitle — like PEC */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                O cadastro da paciente ficará com os seguintes dados após a unificação:
              </p>
            </div>

            {/* Merged preview card */}
            <PatientCard
              patient={mergedPreview}
              role="merged"
              appointmentsCount={duplicateApptsCount}
            />

            {/* What will be deleted */}
            <div className="flex items-start gap-2 text-sm bg-muted/40 border rounded-lg px-3 py-2.5">
              <Trash2 className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span>
                O cadastro <strong className="uppercase">{duplicatePatient.name}</strong> será{" "}
                <strong className="text-destructive">excluído permanentemente</strong>
                {duplicateApptsCount !== null && duplicateApptsCount > 0 && (
                  <> e suas <strong>{duplicateApptsCount}</strong> consultas serão transferidas.</>
                )}
              </span>
            </div>

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
                  Confirmo que desejo unificar estes dois cadastros e estou ciente que o cadastro duplicado será excluído permanentemente.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-3">
          {phase === "select" ? (
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Limpar seleção
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading || !confirmed || duplicateApptsCount === null}
                className="gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                {loading ? "Unificando..." : "Confirmar unificação"}
              </Button>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
