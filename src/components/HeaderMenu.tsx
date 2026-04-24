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
import {
  Menu,
  Users,
  Upload,
  FileSpreadsheet,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import InviteLink from "@/components/InviteLink";
import ImportExport from "@/components/ImportExport";
import { useEffect } from "react";

interface HeaderMenuProps {
  onImportComplete: () => void;
}

export default function HeaderMenu({ onImportComplete }: HeaderMenuProps) {
  const { signOut } = useAuth();
  const [teamOpen, setTeamOpen] = useState(false);
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
    const channel = supabase
      .channel("team_members_badge")
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

          {/* Team dialog (controlled, opened by the menu item above) */}
          <InviteLink
            open={teamOpen}
            onOpenChange={setTeamOpen}
            trigger={<span className="hidden" />}
          />
        </>
      )}
    </ImportExport>
  );
}
