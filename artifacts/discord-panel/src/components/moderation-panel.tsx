import { useState } from "react";
import { Member, useKickMember, useBanMember, useMuteMember, useWarnMember, useGetMemberWarnings, getGetMemberWarningsQueryKey, useGetRoles, getGetRolesQueryKey, useAddMemberRole, useRemoveMemberRole, getGetMembersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/discord-utils";
import { Search, Gavel, Loader2, AlertTriangle, ShieldAlert, ShieldBan, ShieldOff, Shield, Tags } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

interface ModerationPanelProps {
  guildId: string;
  members: Member[];
  token: string;
}

export function ModerationPanel({ guildId, members, token }: ModerationPanelProps) {
  const [search, setSearch] = useState("");

  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(search.toLowerCase()) || 
    m.nickname?.toLowerCase().includes(search.toLowerCase()) ||
    m.id.includes(search)
  );

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-4 border-b border-border bg-card/50 flex justify-between items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search members by username, nickname, or ID..." 
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredMembers.length} members
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-card/50 sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
            <tr>
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Roles</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getAvatarUrl(member.id, member.avatar, member.discriminator)} />
                      <AvatarFallback>{member.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {member.nickname || member.username}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {member.nickname ? `${member.username}#${member.discriminator}` : `#${member.discriminator}`} • {member.id}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {member.roles && member.roles.length > 0 ? (
                      <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                        {member.roles.length} roles
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <ManageRolesDialog member={member} guildId={guildId} token={token} />
                    <ActionDialog member={member} guildId={guildId} token={token} type="warn" />
                    <ActionDialog member={member} guildId={guildId} token={token} type="mute" />
                    <ActionDialog member={member} guildId={guildId} token={token} type="kick" />
                    <ActionDialog member={member} guildId={guildId} token={token} type="ban" />
                    <WarningsDialog member={member} guildId={guildId} token={token} />
                  </div>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionDialog({ member, guildId, token, type }: { member: Member; guildId: string; token: string; type: "kick" | "ban" | "mute" | "warn" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("60");
  const { toast } = useToast();

  const kick = useKickMember();
  const ban = useBanMember();
  const mute = useMuteMember();
  const warn = useWarnMember();

  const isPending = kick.isPending || ban.isPending || mute.isPending || warn.isPending;

  const config = {
    kick: { icon: ShieldOff, color: "text-orange-500", label: "Kick", variant: "outline" as const, desc: "Remove user from server" },
    ban: { icon: ShieldBan, color: "text-destructive", label: "Ban", variant: "destructive" as const, desc: "Permanently ban user" },
    mute: { icon: ShieldAlert, color: "text-yellow-500", label: "Timeout", variant: "outline" as const, desc: "Prevent user from participating" },
    warn: { icon: AlertTriangle, color: "text-blue-500", label: "Warn", variant: "outline" as const, desc: "Log a formal warning" }
  };

  const c = config[type];
  const Icon = c.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const handleResult = (res: any, actionName: string) => {
      if (res.success) {
        toast({ title: "Success", description: res.message });
        setOpen(false);
        setReason("");
      } else {
        toast({ title: "Failed", description: res.message, variant: "destructive" });
      }
    };

    const handleError = (err: any) => {
      toast({ title: "Error", description: err.error || "An error occurred", variant: "destructive" });
    };

    if (type === "kick") {
      kick.mutate({ guildId, userId: member.id, data: { token, reason } }, { onSuccess: (r) => handleResult(r, "Kick"), onError: handleError });
    } else if (type === "ban") {
      ban.mutate({ guildId, userId: member.id, data: { token, reason } }, { onSuccess: (r) => handleResult(r, "Ban"), onError: handleError });
    } else if (type === "warn") {
      warn.mutate({ guildId, userId: member.id, data: { token, reason } }, { onSuccess: (r) => handleResult(r, "Warn"), onError: handleError });
    } else if (type === "mute") {
      mute.mutate({ guildId, userId: member.id, data: { token, reason, durationMinutes: parseInt(duration) || 60 } }, { onSuccess: (r) => handleResult(r, "Timeout"), onError: handleError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title={c.label}>
          <Icon className={`h-4 w-4 ${c.color}`} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${c.color}`} />
            {c.label} {member.username}
          </DialogTitle>
          <DialogDescription>
            {c.desc}. This action will be logged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {type === "mute" && (
            <div className="space-y-2">
              <Label>Duration (Minutes)</Label>
              <Input 
                type="number" 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)} 
                min="1" 
                max="40320" 
                required 
                className="bg-background"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="e.g., Violating rules" 
              className="bg-background"
              autoFocus
            />
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant={c.variant} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {c.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WarningsDialog({ member, guildId, token }: { member: Member; guildId: string; token: string }) {
  const [open, setOpen] = useState(false);
  
  const { data: warnings, isLoading } = useGetMemberWarnings(guildId, member.id, {
    query: {
      queryKey: getGetMemberWarningsQueryKey(guildId, member.id),
      enabled: open,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted text-muted-foreground" title="View Logs">
          <Gavel className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Infraction Log: {member.username}</DialogTitle>
          <DialogDescription>
            History of warnings issued via the bot.
          </DialogDescription>
        </DialogHeader>
        
        <div className="pt-4 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : warnings && warnings.length > 0 ? (
            <div className="space-y-3">
              {warnings.map((w, i) => (
                <div key={i} className="bg-muted/50 rounded-md p-3 border border-border/50 text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-primary">Warning</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(w.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-foreground mt-1">{w.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Clean record. No warnings found.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManageRolesDialog({ member, guildId, token }: { member: Member; guildId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useGetRoles(guildId, {
    query: {
      queryKey: getGetRolesQueryKey(guildId),
      enabled: open && !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const addRole = useAddMemberRole();
  const removeRole = useRemoveMemberRole();

  const isPending = addRole.isPending || removeRole.isPending;

  const handleToggleRole = (roleId: string, hasRole: boolean) => {
    if (hasRole) {
      removeRole.mutate(
        { guildId, userId: member.id, roleId, data: { token } },
        {
          onSuccess: (res: any) => {
            if (res.success) {
              toast({ title: "Role Removed", description: "Successfully removed role from member" });
              queryClient.invalidateQueries({ queryKey: getGetMembersQueryKey(guildId) });
            } else {
              toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
          },
          onError: (err: any) => {
            toast({ title: "Error", description: err.error || "Failed to remove role", variant: "destructive" });
          }
        }
      );
    } else {
      addRole.mutate(
        { guildId, userId: member.id, roleId, data: { token } },
        {
          onSuccess: (res: any) => {
            if (res.success) {
              toast({ title: "Role Added", description: "Successfully added role to member" });
              queryClient.invalidateQueries({ queryKey: getGetMembersQueryKey(guildId) });
            } else {
              toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
          },
          onError: (err: any) => {
            toast({ title: "Error", description: err.error || "Failed to add role", variant: "destructive" });
          }
        }
      );
    }
  };

  const sortedRoles = roles ? [...roles].sort((a, b) => b.position - a.position) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="Manage Roles">
          <Tags className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Roles: {member.username}</DialogTitle>
          <DialogDescription>
            Assign or remove roles for this member.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4 max-h-[400px] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">
              {sortedRoles.map(role => {
                // @ts-ignore - roles in Member might just be IDs or object, depends on API response
                const memberRoles = member.roles || [];
                const hasRole = memberRoles.includes(role.id) || memberRoles.some((r: any) => r.id === role.id);
                const hexColor = role.color === 0 ? null : '#' + role.color.toString(16).padStart(6, '0');
                
                return (
                  <div key={role.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id={`role-${role.id}`} 
                        checked={hasRole} 
                        disabled={isPending}
                        onCheckedChange={() => handleToggleRole(role.id, hasRole)} 
                      />
                      <label htmlFor={`role-${role.id}`} className="flex items-center gap-2 cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hexColor || '#6b7280' }} />
                        {role.name}
                      </label>
                    </div>
                    {role.managed && <Badge variant="secondary" className="text-[10px]">Managed</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
