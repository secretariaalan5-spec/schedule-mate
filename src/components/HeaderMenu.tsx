import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Menu,
  Users,
  Upload,
  FileSpreadsheet,
  LogOut,
  Loader2,
  Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import InviteLink from "@/components/InviteLink";
import ImportExport from "@/components/ImportExport";
import HealthUnitManager from "@/components/HealthUnitManager";
import { useEffect } from "react";

interface HeaderMenuProps {
  onImportComplete: () => void;
}

export default function HeaderMenu({ onImportComplete }: HeaderMenuProps) {
  const { signOut } = useAuth();
  const [teamOpen, setTeamOpen] = useState(false);
  const [healthUnitsOpen, setHealthUnitsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Lightweight pending count for the badge (kept in sync via realtime).
  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingCount(count ?? 0);
    };
    fetchPending();
    const channelName = `team_members_badge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, fetchPending)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <ImportExport onImportComplete={onImportComplete}>
      {({ importing, triggerImport, exportExcel }) => (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/10 relative h-10 px-2 flex flex-col items-center justify-center gap-0"
                aria-label="Menu"
              >
                {importing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
                <span className="text-[8px] font-bold uppercase leading-none mt-0.5">Menu</span>
                {pendingCount > 0 && (
                  <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center border border-primary">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Equipe</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setTeamOpen(true)}>
                <Users className="w-4 h-4 mr-2" />
                <span>Gerenciar equipe</span>
                {pendingCount > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 py-0.5">
                    {pendingCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setHealthUnitsOpen(true)}>
                <Building2 className="w-4 h-4 mr-2" />
                <span>Unidades de Saúde</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Dados</DropdownMenuLabel>
              <DropdownMenuItem onSelect={triggerImport} disabled={importing}>
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                <span>{importing ? "Importando..." : "Importar arquivo"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportExcel()}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <span>Exportar Excel geral</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut()} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Team dialog */}
          <InviteLink
            open={teamOpen}
            onOpenChange={setTeamOpen}
          />

          {/* Health Units dialog */}
          <Dialog open={healthUnitsOpen} onOpenChange={setHealthUnitsOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
              <DialogHeader className="px-6 pt-6 pb-2 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <Building2 className="w-5 h-5" />
                  Unidades de Saúde (PSF / UBS)
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-hidden">
                <HealthUnitManager />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </ImportExport>
  );
}
