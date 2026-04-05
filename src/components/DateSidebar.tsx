import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { formatDateBR } from "@/hooks/useScheduling";
import type { ReleasedDay } from "@/hooks/useScheduling";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format } from "date-fns";

interface Props {
  releasedDays: ReleasedDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onAddDay: (date: string) => void;
  onRemoveDay: (date: string) => void;
}

export default function DateSidebar({ releasedDays, selectedDate, onSelectDate, onAddDay, onRemoveDay }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();

  const handleAddDay = () => {
    if (calendarDate) {
      onAddDay(format(calendarDate, "yyyy-MM-dd"));
      setCalendarOpen(false);
      setCalendarDate(undefined);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 flex items-center justify-between border-b border-border">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Dias Liberados
        </h3>
        <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-fit">
            <DialogHeader>
              <DialogTitle>Adicionar Dia</DialogTitle>
            </DialogHeader>
            <CalendarUI mode="single" selected={calendarDate} onSelect={setCalendarDate} />
            <Button onClick={handleAddDay} disabled={!calendarDate}>Adicionar</Button>
          </DialogContent>
        </Dialog>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {releasedDays.map(day => (
            <div
              key={day.id}
              className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                selectedDate === day.date
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
              onClick={() => onSelectDate(day.date)}
            >
              <span className="font-medium">{formatDateBR(day.date)}</span>
              <Button
                size="icon"
                variant="ghost"
                className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedDate === day.date ? "text-primary-foreground hover:bg-primary/80" : "text-destructive hover:bg-destructive/10"
                }`}
                onClick={e => { e.stopPropagation(); onRemoveDay(day.date); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {releasedDays.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum dia liberado</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
