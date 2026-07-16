import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Glucometer = {
  id: string;
  code: string;
  brand: string | null;
  notes: string | null;
  status: "available" | "loaned";
  created_at: string;
  updated_at: string;
};

export type Loan = {
  id: string;
  patient_id: string;
  glucometer_id: string;
  loaned_at: string;
  expected_return_date: string;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  glucometer?: Glucometer | null;
  patient?: { id: string; name: string; sus_card: string | null; cpf: string | null; acs: string | null; phone: string | null; psf: string | null } | null;
};

const db = supabase as any;

export function useGlucometers() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["glucometers"],
    queryFn: async () => {
      const { data, error } = await db.from("glucometers").select("*").order("code");
      if (error) throw error;
      return (data ?? []) as Glucometer[];
    },
  });

  const add = useMutation({
    mutationFn: async (g: { code: string; brand?: string | null; notes?: string | null }) => {
      const { error } = await db.from("glucometers").insert({
        code: g.code.trim(),
        brand: g.brand?.trim() || null,
        notes: g.notes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Glicosímetro cadastrado");
      qc.invalidateQueries({ queryKey: ["glucometers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("glucometers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Glicosímetro removido");
      qc.invalidateQueries({ queryKey: ["glucometers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  return { ...query, add, remove };
}

export function useLoans(patientId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["loans", patientId ?? "all"],
    queryFn: async () => {
      let q = db
        .from("glucometer_loans")
        .select("*, glucometer:glucometers(*), patient:patients(id,name,sus_card,cpf,acs,phone,psf)")
        .order("returned_at", { ascending: true, nullsFirst: true })
        .order("expected_return_date", { ascending: true });
      if (patientId) q = q.eq("patient_id", patientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Loan[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["glucometers"] });
  };

  const create = useMutation({
    mutationFn: async (payload: {
      patient_id: string;
      glucometer_id: string;
      expected_return_date: string;
      loaned_at?: string;
      notes?: string | null;
    }) => {
      const { data, error } = await db
        .from("glucometer_loans")
        .insert({
          patient_id: payload.patient_id,
          glucometer_id: payload.glucometer_id,
          expected_return_date: payload.expected_return_date,
          loaned_at: payload.loaned_at ?? new Date().toISOString().slice(0, 10),
          notes: payload.notes ?? null,
        })
        .select("*, glucometer:glucometers(*), patient:patients(id,name,sus_card,cpf,acs,phone,psf)")
        .single();
      if (error) throw error;
      return data as Loan;
    },
    onSuccess: () => {
      toast.success("Empréstimo registrado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar empréstimo"),
  });

  const renew = useMutation({
    mutationFn: async (p: { id: string; expected_return_date: string }) => {
      const { error } = await db
        .from("glucometer_loans")
        .update({ expected_return_date: p.expected_return_date })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empréstimo renovado");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao renovar"),
  });

  const returnLoan = useMutation({
    mutationFn: async (p: { id: string; returned_at?: string }) => {
      const { error } = await db
        .from("glucometer_loans")
        .update({ returned_at: p.returned_at ?? new Date().toISOString().slice(0, 10) })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução registrada");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao devolver"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("glucometer_loans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empréstimo excluído");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return { ...query, create, renew, returnLoan, remove };
}