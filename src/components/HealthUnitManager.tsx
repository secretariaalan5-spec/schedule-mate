import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthUnit {
  id: string;
  name: string;
  address: string | null;
}

export default function HealthUnitManager() {
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<HealthUnit | null>(null);
  const [form, setForm] = useState({ name: "", address: "" });

  const fetchUnits = useCallback(async () => {
    const { data, error } = await supabase.from("health_units").select("*").order("name");
    if (error) { toast.error("Erro ao carregar unidades"); return; }
    setUnits((data as any) || []);
  }, []);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-health-units")
      .on("postgres_changes", { event: "*", schema: "public", table: "health_units" }, () => fetchUnits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUnits]);

  const filtered = units.filter(u => {
    const s = search.toUpperCase();
    return !search || u.name.toUpperCase().includes(s) || u.address?.toUpperCase().includes(s);
  });

  const openNew = () => { setForm({ name: "", address: "" }); setEditUnit(null); setDialogOpen(true); };
  const openEdit = (u: HealthUnit) => { setForm({ name: u.name, address: u.address || "" }); setEditUnit(u); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const data = { name: form.name.trim().toUpperCase(), address: form.address.trim() || null };
    if (editUnit) {
      const { error } = await supabase.from("health_units").update(data).eq("id", editUnit.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Unidade atualizada");
    } else {
      const { error } = await supabase.from("health_units").insert(data);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Unidade cadastrada");
    }
    setDialogOpen(false);
    fetchUnits();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("health_units").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Unidade removida");
    fetchUnits();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-4 mb-3">
          <Card className="flex-1 border-primary/20">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-primary">{units.length}</p>
                <p className="text-xs text-muted-foreground">Unidades de Saúde</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar unidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova Unidade
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {search ? "Nenhuma unidade encontrada" : "Nenhuma unidade cadastrada"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u, i) => (
                <TableRow key={u.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="text-center text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.address || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => openEdit(u)} title="Editar">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id)} title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">{editUnit ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da unidade" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereço</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Endereço completo" />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
