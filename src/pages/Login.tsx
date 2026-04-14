import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const invitedBy = searchParams.get("invited_by") || "";
  const [tab, setTab] = useState(searchParams.get("tab") === "signup" ? "signup" : "login");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("Erro ao entrar: " + error.message);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (!name.trim()) { toast.error("Informe seu nome"); return; }
    setLoading(true);
    
    const { data, error } = await supabase.auth.signUp({ 
      email, password, 
      options: { emailRedirectTo: window.location.origin } 
    });

    if (error) {
      toast.error("Erro ao criar conta: " + error.message);
      setLoading(false);
      return;
    }

    // Register as team member (pending approval)
    if (data.user) {
      await supabase.from("team_members").insert({
        user_id: data.user.id,
        email,
        name: name.trim(),
        invited_by: invitedBy || null,
        status: invitedBy ? "pending" : "approved",
      });
    }

    toast.success("Conta criada! Aguarde a aprovação do administrador.");
    setTab("login");
    setLoading(false);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0d4a7a] relative overflow-hidden p-4">

      {/* Decorative background elements */}

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-400/10 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-4 rounded-3xl shadow-2xl mb-4 relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all" />
            <img src={logo} alt="Saúde da Mulher" className="w-20 h-20 md:w-24 md:h-24 object-contain relative z-10" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight text-center">SAÚDE DA MULHER</h1>
          <p className="text-blue-100/70 text-sm font-medium">Sistema de Agendamento • Camocim</p>
        </div>

        <Card className="border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className="text-center pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-[0.2em] text-primary/60">
              Acesse sua conta
            </CardDescription>
            {invitedBy && tab === "signup" && (
              <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-2xl text-[11px] text-primary/80 font-medium">
                ✨ Convite especial: Você foi convidado(a) para a equipe.
              </div>
            )}
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-8 p-1.5 bg-muted/50 rounded-2xl h-12">
                <TabsTrigger value="login" className="rounded-xl data-[state=active]:shadow-lg font-bold text-sm">ENTRAR</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-xl data-[state=active]:shadow-lg font-bold text-sm">CRIAR CONTA</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 animate-in slide-in-from-left-4 duration-300">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-bold text-primary/70 uppercase ml-1">E-mail Corporativo</Label>
                    <Input 
                      id="login-email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                      className="h-12 rounded-2xl border-muted-foreground/10 bg-muted/30 focus:bg-white transition-all text-base px-4"
                      placeholder="seu@email.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-xs font-bold text-primary/70 uppercase ml-1">Senha de Acesso</Label>
                    <Input 
                      id="login-password" 
                      type="password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      className="h-12 rounded-2xl border-muted-foreground/10 bg-muted/30 focus:bg-white transition-all text-base px-4"
                      placeholder="••••••••" 
                    />
                  </div>
                  <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-4" disabled={loading}>
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Autenticando...
                      </div>
                    ) : "ENTRAR NO SISTEMA"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-xs font-bold text-primary/70 uppercase ml-1">Nome Completo</Label>
                    <Input 
                      id="signup-name" 
                      type="text" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required 
                      className="h-12 rounded-2xl border-muted-foreground/10 bg-muted/30 focus:bg-white transition-all"
                      placeholder="Seu nome completo" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-bold text-primary/70 uppercase ml-1">E-mail</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                      className="h-12 rounded-2xl border-muted-foreground/10 bg-muted/30 focus:bg-white transition-all"
                      placeholder="seu@email.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-xs font-bold text-primary/70 uppercase ml-1">Senha</Label>
                    <Input 
                      id="signup-password" 
                      type="password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      className="h-12 rounded-2xl border-muted-foreground/10 bg-muted/30 focus:bg-white transition-all"
                      placeholder="••••••••" 
                      minLength={6} 
                    />
                  </div>
                  <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-4" disabled={loading}>
                    {loading ? "Processando..." : "SOLICITAR ACESSO"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <p className="mt-8 text-center text-blue-100/40 text-xs font-medium uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} Camocim • Ceará
        </p>
      </div>
    </div>
  );
}

