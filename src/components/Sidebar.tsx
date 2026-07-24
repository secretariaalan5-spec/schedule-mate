import { useState, useEffect } from "react";
import { Calendar, Users, Building, Settings, LogOut, ChevronLeft, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import InviteLink from "@/components/InviteLink";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
}

const navItems = [
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "pacientes", label: "Pacientes", icon: Users },
  { id: "unidades", label: "Unidades", icon: Building },
  { id: "emprestimos", label: "Empréstimos", icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange, onSignOut }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const { user } = useAuth();
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfileName(data.name || data.email.split("@")[0]);
      }
    };
    fetchProfile();
  }, [user]);

  return (
    <div
      className={cn(
        "hidden md:flex h-screen flex-col border-r border-outline-variant bg-primary-container text-on-primary transition-all duration-300 ease-in-out relative overflow-hidden shrink-0 z-30 shadow-md",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Header / Logo */}
      <div className="px-6 py-6 overflow-hidden flex items-center gap-3 border-b border-white/10 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          <img
            className="w-full h-full object-contain"
            src="/logo.png"
            alt="Logo Saúde da Mulher"
          />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <h1 className="text-sm font-bold text-on-primary">Saúde da Mulher</h1>
            <p className="text-[10px] opacity-75 text-on-primary font-medium">Portal Clínico</p>
          </div>
        )}
      </div>

      {/* Main Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex items-center w-full px-4 py-3 rounded-lg transition-all duration-150 active:scale-[0.98]",
                isActive
                  ? "bg-white/20 text-white font-bold"
                  : "text-on-primary/80 hover:bg-white/10 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="ml-3 font-semibold text-[14px] tracking-wide">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile & Actions */}
      <div className="p-4 border-t border-white/10 mt-auto space-y-2 shrink-0 bg-black/5">
        {/* User Profile */}
        <button
          onClick={() => setTeamOpen(true)}
          className={cn(
            "flex items-center gap-3 py-1 w-full text-left transition-all duration-150 rounded-lg hover:bg-white/10",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Equipe" : undefined}
        >
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
            {profileName ? (
              profileName.substring(0, 2).toUpperCase()
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
          {!collapsed && (
            <div className="leading-tight min-w-0 flex-1">
              <h4 className="font-bold text-[13px] text-white truncate" title={profileName || "Administradora"}>
                {profileName || "Administradora"}
              </h4>
              <p className="text-[11px] text-white/70">Equipe Clínico</p>
            </div>
          )}
        </button>

        {/* Logout Button */}
        <button
          onClick={onSignOut}
          className={cn(
            "flex items-center w-full px-4 py-2.5 rounded-lg transition-all duration-150 text-white/80 hover:bg-white/10 hover:text-white"
          )}
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 text-white/80" />
          {!collapsed && <span className="ml-3 text-[13px] font-semibold">Sair</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-2 top-24 bg-white border border-outline-variant rounded-full p-1 shadow-sm text-primary hover:bg-[#f9f9ff] z-40"
      >
        <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
      </button>

      {/* Team dialog */}
      <InviteLink
        open={teamOpen}
        onOpenChange={setTeamOpen}
      />
    </div>
  );
}


