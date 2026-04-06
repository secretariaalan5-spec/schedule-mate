import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, UserPlus, Check } from "lucide-react";

export default function InviteLink() {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/?tab=signup`;

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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
          <UserPlus className="w-4 h-4 mr-1" /> Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Pessoa</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Envie este link para outra pessoa. Ela poderá criar uma conta e terá o mesmo acesso ao sistema.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Input value={inviteUrl} readOnly className="text-sm" />
          <Button size="icon" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
