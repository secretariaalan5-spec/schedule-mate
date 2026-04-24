import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Login from "./Login";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, ShieldX } from "lucide-react";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [memberStatus, setMemberStatus] = useState<"loading" | "approved" | "pending" | "rejected" | "none">("loading");

  useEffect(() => {
    if (!user) {
      setMemberStatus("loading");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setMemberStatus("none");
      else if (data.status === "approved") setMemberStatus("approved");
      else if (data.status === "rejected") setMemberStatus("rejected");
      else setMemberStatus("pending");
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || (user && memberStatus === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return <Login />;

  if (memberStatus === "approved") return <Dashboard />;

  // Pending / rejected / none — show gate screen
  const isRejected = memberStatus === "rejected";
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d4a7a] p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-3xl border-none">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {isRejected ? (
              <ShieldX className="w-8 h-8 text-destructive" />
            ) : (
              <Clock className="w-8 h-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isRejected ? "Acesso negado" : "Aguardando aprovação"}
          </CardTitle>
          <CardDescription className="text-sm mt-2">
            {isRejected
              ? "Seu acesso ao sistema foi recusado. Entre em contato com o administrador."
              : "Sua conta foi criada com sucesso. Um administrador precisa aprovar seu acesso antes que você possa entrar no sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 px-8">
          <p className="text-xs text-muted-foreground text-center mb-6">
            Conectado como <span className="font-medium">{user.email}</span>
          </p>
          <Button onClick={() => signOut()} variant="outline" className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
