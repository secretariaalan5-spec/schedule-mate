import { CalendarDays, HandCoins, Syringe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValidLocalDate } from "@/lib/dateUtils";
import { usePatientTimeline, type TimelineModule } from "@/hooks/usePatientTimeline";
import { Skeleton } from "@/components/ui/skeleton";

const MODULES: Record<TimelineModule, { label: string; icon: any; dot: string; chip: string }> = {
  agenda: {
    label: "Agenda",
    icon: CalendarDays,
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  emprestimos: {
    label: "Empréstimos",
    icon: HandCoins,
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  implanon: {
    label: "Implanon",
    icon: Syringe,
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

interface Props {
  patientId?: string;
  className?: string;
}

export default function PatientTimeline({ patientId, className }: Props) {
  const { data, isLoading } = usePatientTimeline(patientId);

  if (!patientId) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Selecione uma paciente para ver o prontuário.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const events = data ?? [];
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhum registro no prontuário desta paciente ainda.
      </p>
    );
  }

  return (
    <ol className={cn("relative pl-6", className)}>
      <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
      {events.map((ev) => {
        const mod = MODULES[ev.module] ?? MODULES.agenda;
        const Icon = mod.icon;
        return (
          <li key={`${ev.module}-${ev.id}`} className="relative pb-4 last:pb-0">
            <span
              className={cn(
                "absolute -left-6 top-3 w-[15px] h-[15px] rounded-full ring-4 ring-white",
                mod.dot,
              )}
              aria-hidden
            />
            <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm text-foreground truncate">{ev.title}</span>
                </div>
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", mod.chip)}>
                  {mod.label}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatValidLocalDate(ev.event_date, "dd/MM/yyyy")}
                  {ev.event_time ? ` · ${ev.event_time}` : ""}
                </span>
                {ev.status && <span className="capitalize">{ev.status}</span>}
              </div>
              {ev.detail && <p className="mt-1.5 text-xs text-foreground/80">{ev.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}