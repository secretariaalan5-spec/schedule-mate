import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { syncPatientRegistry, type SharedPatientData } from "@/lib/patientRegistry";

const db = supabase as any;

export type ImplanonStatus = "pending" | "released" | "applied" | "removed";

export type ImplanonRecord = {
  id: string;
  patient_id: string;
  status: ImplanonStatus;
  released_at: string | null;
  applied_at: string | null;
  lot: string | null;
  lot_expiry: string | null;
  expected_removal_at: string | null;
  removed_at: string | null;
  removal_reason: string | null;
  professional: string | null;
  application_site: string | null;
  dum: string | null;
  health_unit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    id: string;
    name: string;
    sus_card: string | null;
    cpf: string | null;
    phone: string | null;
    psf: string | null;
    acs: string | null;
    dob: string | null;
    address: string | null;
    neighborhood: string | null;
  } | null;
};

const SELECT =
  "*, patient:patients(id,name,sus_card,cpf,phone,psf,acs,dob,address,neighborhood)";

export function useImplanon(patientId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["implanon", patientId ?? "all"],
    queryFn: async () => {
      let q = db.from("implanon_records").select(SELECT).order("created_at", { ascending: false });
      if (patientId) q = q.eq("patient_id", patientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ImplanonRecord[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["implanon"] });
    qc.invalidateQueries({ queryKey: ["patient-timeline"] });
    qc.invalidateQueries({ queryKey: ["patients"] });
  };

  const create = useMutation({
    mutationFn: async (payload: Partial<ImplanonRecord> & { patient_id: string; registry?: SharedPatientData }) => {
      const { registry, patient, ...rest } = payload as any;
      const status: ImplanonStatus =
        (rest.status as ImplanonStatus | undefined) ??
        (rest.removed_at
          ? "removed"
          : rest.applied_at
            ? "applied"
            : rest.released_at
              ? "released"
              : "pending");
      const { data, error } = await db
        .from("implanon_records")
        .insert({ ...rest, status })
        .select(SELECT)
        .single();
      if (error) throw error;
      await syncPatientRegistry(payload.patient_id, {
        ...(registry ?? {}),
        dum: rest.dum ?? null,
      });
      return data as ImplanonRecord;
    },
    onSuccess: () => {
      toast.success("Registro de Implanon salvo");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar registro"),
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ImplanonRecord> }) => {
      const patch: Record<string, unknown> = { ...updates };
      if (!updates.status) {
        if (patch.removed_at) patch.status = "removed";
        else if (patch.applied_at) patch.status = "applied";
        else if (patch.released_at) patch.status = "released";
      }
      const { error } = await db.from("implanon_records").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro atualizado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("implanon_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { ...query, create, update, remove };
}