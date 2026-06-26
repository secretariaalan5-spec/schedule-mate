import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Users,
  Home,
  Building,
  Sparkles,
  ChevronRight,
  CreditCard,
  X,
} from "lucide-react";
import {
  useHealthUnits,
  useHealthUnitsPatientCounts,
  useHealthUnitsMutations,
  type HealthUnit,
} from "@/hooks/useHealthUnits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/hooks/useScheduling";
import { formatDateBR } from "@/hooks/useScheduling";

export default function HealthUnitsManager() {
  const { data: units = [], isLoading: isLoadingUnits } = useHealthUnits();
  const { data: counts = {}, isLoading: isLoadingCounts } = useHealthUnitsPatientCounts();
  const { addHealthUnit, updateHealthUnit, deleteHealthUnit } = useHealthUnitsMutations();

  // Total de pacientes (geral, independente de PSF)
  const { data: patientStats } = useQuery({
    queryKey: ["patients-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true });
      return { total: total || 0 };
    },
    staleTime: 1000 * 60 * 60,
  });

  const [search, setSearch] = useState("");
  const [editingUnit, setEditingUnit] = useState<HealthUnit | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<HealthUnit | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<HealthUnit | null>(null);
  const [unitPatientsSearch, setUnitPatientsSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    address: "",
  });

  const isLoading = isLoadingUnits || isLoadingCounts;

  // Query: patients for the selected unit
  const { data: unitPatients = [], isLoading: isLoadingUnitPatients } = useQuery<Patient[]>({
    queryKey: ["unit-patients", selectedUnit?.name],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("psf", selectedUnit.name)
        .order("name");
      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!selectedUnit,
  });

  const filteredUnitPatients = useMemo(() => {
    if (!unitPatientsSearch.trim()) return unitPatients;
    const q = unitPatientsSearch.toLowerCase().trim();
    return unitPatients.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.sus_card && p.sus_card.includes(q))
    );
  }, [unitPatients, unitPatientsSearch]);

  // Filter units based on search
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.address && u.address.toLowerCase().includes(q))
      );
    });
  }, [units, search]);

  // Overall Stats
  const stats = useMemo(() => {
    const totalUnits = units.length;
    let mostPopulatedUnit = "Nenhuma";
    let maxPatients = 0;

    Object.entries(counts).forEach(([psf, count]) => {
      if (count > maxPatients) {
        maxPatients = count;
        mostPopulatedUnit = psf;
      }
    });

    return {
      totalUnits,
      totalPatients: patientStats?.total ?? 0,
      mostPopulatedUnit: maxPatients > 0 ? `${mostPopulatedUnit} (${maxPatients})` : "Nenhuma",
    };
  }, [units, counts, patientStats]);

  const openNew = () => {
    setForm({ name: "", address: "" });
    setNewOpen(true);
  };

  const openEdit = (u: HealthUnit, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({
      name: u.name,
      address: u.address || "",
    });
    setEditingUnit(u);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const data = {
      name: form.name.trim().toUpperCase(),
      address: form.address.trim() || null,
    };

    if (editingUnit) {
      await updateHealthUnit({ id: editingUnit.id, ...data });
      setEditingUnit(null);
    } else {
      await addHealthUnit(data);
      setNewOpen(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteCandidate) {
      await deleteHealthUnit(deleteCandidate.id);
      setDeleteCandidate(null);
    }
  };

  const candidatePatientCount = useMemo(() => {
    if (!deleteCandidate) return 0;
    return counts[deleteCandidate.name] || 0;
  }, [deleteCandidate, counts]);

  const renderFormDialog = () => (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-primary">
          {editingUnit ? "Editar Unidade de Saúde" : "Nova Unidade de Saúde"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Nome da Unidade / PSF / UBS
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex: PSF COQUEIROS"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Endereço (Opcional)
          </Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Ex: Rua Central, nº 123 - Centro"
          />
        </div>
        <Button
          onClick={handleSave}
          className="w-full mt-2"
          disabled={!form.name.trim()}
        >
          {editingUnit ? "Salvar Alterações" : "Adicionar Unidade"}
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Title Header */}
      <div className="p-4 border-b bg-card flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" /> Unidades de Saúde
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerenciamento de PSFs, UBSs, endereços e estatísticas de vinculação de pacientes.
          </p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5 font-semibold">
          <Plus className="w-4 h-4" /> Nova Unidade
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 pb-12">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-black text-primary leading-none">
                    {stats.totalUnits}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    Total de Unidades
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                    {stats.totalPatients}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    Total de Pacientes Cadastrados
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-purple-700 dark:text-purple-400 truncate max-w-[200px] leading-tight">
                    {stats.mostPopulatedUnit}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    Unidade com mais Pacientes
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar unidade por nome ou endereço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Grid list of Health Units */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-2xl">
              <Home className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="font-medium text-sm">Nenhuma unidade encontrada</p>
              <p className="text-xs max-w-[250px] mx-auto mt-1">
                {search
                  ? "Tente mudar os termos da busca."
                  : "Adicione uma nova unidade clicando no botão acima."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUnits.map((u) => {
                const patientCount = counts[u.name] || 0;
                return (
                  <Card
                    key={u.id}
                    className="overflow-hidden border border-border/50 bg-card/65 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
                    onClick={() => setSelectedUnit(u)}
                  >
                    <CardContent className="p-5 space-y-4">
                      {/* Top card block */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="font-extrabold text-base tracking-tight text-foreground group-hover:text-primary transition-colors uppercase truncate">
                            {u.name}
                          </h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            <span className="truncate max-w-[190px]" title={u.address || ""}>
                              {u.address || "Sem endereço cadastrado"}
                            </span>
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                      </div>

                      {/* Middle card block: patients count */}
                      <div className="bg-muted/30 border border-border/30 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground">Pacientes vinculados:</span>
                        </div>
                        <span className="text-xl font-black text-primary leading-none">
                          {patientCount}
                        </span>
                      </div>

                      {/* Bottom card block: actions */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-dashed">
                        <span className="text-[10px] text-muted-foreground italic">
                          Clique para ver pacientes
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            onClick={(e) => openEdit(u, e)}
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); setDeleteCandidate(u); }}
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Drawer/Modal: Pacientes da Unidade ── */}
      <Dialog open={!!selectedUnit} onOpenChange={(o) => {
        if (!o) {
          setSelectedUnit(null);
          setUnitPatientsSearch("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-primary flex items-center gap-2">
              <Building className="w-4 h-4" />
              {selectedUnit?.name}
            </DialogTitle>
            {selectedUnit?.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {selectedUnit.address}
              </p>
            )}
          </DialogHeader>

          {/* Summary badge */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs gap-1">
              <Users className="w-3 h-3" />
              {isLoadingUnitPatients ? "..." : unitPatients.length} paciente{unitPatients.length !== 1 ? "s" : ""} nesta unidade
            </Badge>
          </div>

          {/* Search bar inside the modal */}
          {!isLoadingUnitPatients && unitPatients.length > 0 && (
            <div className="relative my-2 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente nesta unidade..."
                value={unitPatientsSearch}
                onChange={(e) => setUnitPatientsSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>
          )}

          {/* Patients List */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {isLoadingUnitPatients ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredUnitPatients.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium">Nenhum paciente encontrado</p>
                <p className="text-xs mt-1">
                  {unitPatientsSearch 
                    ? "Tente mudar os termos da busca."
                    : "Pacientes podem ser associados a esta unidade no cadastro."}
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {filteredUnitPatients.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        {p.is_pregnant && (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px] h-4 px-1 py-0 font-bold uppercase tracking-wider">
                            Gestante
                          </Badge>
                        )}
                        {p.risk_classification === "ALTO" && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[9px] h-4 px-1 py-0 font-bold uppercase tracking-wider">
                            Alto Risco
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.sus_card && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-mono">
                            <CreditCard className="w-2.5 h-2.5" />
                            {p.sus_card}
                          </span>
                        )}
                        {p.dob && (
                          <span className="text-[10px] text-muted-foreground">
                            Nasc: {formatDateBR(p.dob)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Edit/New Unit */}
      <Dialog
        open={newOpen || !!editingUnit}
        onOpenChange={(open) => {
          if (!open) {
            setNewOpen(false);
            setEditingUnit(null);
          }
        }}
      >
        {renderFormDialog()}
      </Dialog>

      {/* Confirmation Alert Dialog for Deletion */}
      <AlertDialog
        open={!!deleteCandidate}
        onOpenChange={(o) => !o && setDeleteCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Unidade de Saúde?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                A unidade de saúde <strong>{deleteCandidate?.name}</strong> será removida permanentemente.
              </p>
              {candidatePatientCount > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg p-3 font-semibold mt-2">
                  Atenção: Existem {candidatePatientCount} paciente(s) vinculados a esta unidade.
                  Eles não serão removidos, mas sua unidade de vinculação ficará em branco.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
