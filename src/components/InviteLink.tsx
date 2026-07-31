import { useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, UserPlus, Check, UserCheck, UserX, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  status: string;
  user_id: string | null;
  invited_by: string | null;
  created_at: string;
}

interface InviteLinkProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function InviteLink({ trigger, open: openProp, onOpenChange }: InviteLinkProps = {}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const inviteUrl = `${window.location.origin}/?tab=signup&invited_by=${user?.id || ""}`;

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setMembers(data as TeamMember[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open]);

  // Realtime
  useEffect(() => {
    const channelName = `team_members_changes_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => {
        fetchMembers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "approved" })
      .eq("id", id);
    if (error) toast.error("Erro ao aprovar");
    else {
      toast.success("Membro aprovado!");
      fetchMembers();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) toast.error("Erro ao rejeitar");
    else {
      toast.success("Membro rejeitado");
      fetchMembers();
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("Remover este membro da equipe?")) return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", id);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Membro removido");
      fetchMembers();
    }
  };

  const pendingCount = members.filter(m => m.status === "pending").length;

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-yellow-600 border-yellow-400 bg-yellow-50">Pendente</Badge>;
      case "approved": return <Badge variant="outline" className="text-green-600 border-green-400 bg-green-50">Aprovado</Badge>;
      case "rejected": return <Badge variant="outline" className="text-red-600 border-red-400 bg-red-50">Rejeitado</Badge>;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Equipe & Convites
          </DialogTitle>
        </DialogHeader>

        {/* Invite link */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Envie este link para convidar alguém. Quando a pessoa criar uma conta, você receberá uma solicitação para aprovar.
          </p>
          <div className="flex items-center gap-2">
            <Input value={inviteUrl} readOnly className="text-xs" />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Members list */}
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">Participantes ({members.length})</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum participante ainda.</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                    {m.name && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {statusBadge(m.status)}
                    {m.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleApprove(m.id)} title="Aprovar">
                          <UserCheck className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleReject(m.id)} title="Rejeitar">
                          <UserX className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemove(m.id)} title="Remover">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
