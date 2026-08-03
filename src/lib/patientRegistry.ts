import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/**
 * Campos do cadastro único que qualquer módulo pode alimentar.
 * Regra: valor novo não-vazio sobrescreve; valor vazio nunca apaga o que já existe.
 */
export type SharedPatientData = Partial<{
  sus_card: string | null;
  cpf: string | null;
  dob: string | null;
  phone: string | null;
  psf: string | null;
  acs: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  health_unit_id: string | null;
  dum: string | null;
  is_pregnant: boolean | null;
  risk_classification: string | null;
  observations: string | null;
}>;

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

/**
 * Atualiza o cadastro único da paciente com dados coletados em qualquer módulo
 * (Agenda, Implanon, Empréstimos, ...), sem sobrescrever informação existente
 * com valores vazios e sem criar duplicidade.
 */
export async function syncPatientRegistry(
  patientId: string,
  data: SharedPatientData,
): Promise<void> {
  if (!patientId) return;

  const incoming: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(data)) {
    const value = clean(raw);
    if (value !== null) incoming[key] = value;
  }
  if (Object.keys(incoming).length === 0) return;

  const { data: current, error } = await db
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();
  if (error || !current) return;

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    const existing = clean((current as Record<string, unknown>)[key]);
    if (existing === null || existing !== value) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) return;
  await db.from("patients").update(updates).eq("id", patientId);
}