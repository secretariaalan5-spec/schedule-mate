import { useCallback } from "react";
import type { Patient } from "@/hooks/useScheduling";

export interface AppointmentDraft {
  slot: number;
  date: string;
  variant: "morning" | "afternoon";
  name: string;
  susCard: string;
  dob: string;
  psf: string;
  reason: string;
  type: string;
  scheduleTime: string;
  selectedPatientId: string | null;
  selectedPatient: Patient | null;
  savedAt: number;
}

const DRAFT_KEY = "appointment_draft_v1";
// Drafts expire after 2 hours of inactivity
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export function useAppointmentDraft() {
  const saveDraft = useCallback((draft: Omit<AppointmentDraft, "savedAt">) => {
    try {
      const data: AppointmentDraft = { ...draft, savedAt: Date.now() };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, []);

  const loadDraft = useCallback(
    (slot: number, date: string, variant: string): AppointmentDraft | null => {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const draft: AppointmentDraft = JSON.parse(raw);
        // Validate that the draft matches the current slot/date/variant
        if (
          draft.slot !== slot ||
          draft.date !== date ||
          draft.variant !== variant
        ) {
          return null;
        }
        // Discard stale drafts
        if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
          sessionStorage.removeItem(DRAFT_KEY);
          return null;
        }
        return draft;
      } catch {
        return null;
      }
    },
    []
  );

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const hasDraft = useCallback(
    (slot: number, date: string, variant: string): boolean => {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return false;
        const draft: AppointmentDraft = JSON.parse(raw);
        if (
          draft.slot !== slot ||
          draft.date !== date ||
          draft.variant !== variant
        ) {
          return false;
        }
        return Date.now() - draft.savedAt <= DRAFT_TTL_MS;
      } catch {
        return false;
      }
    },
    []
  );

  return { saveDraft, loadDraft, clearDraft, hasDraft };
}
