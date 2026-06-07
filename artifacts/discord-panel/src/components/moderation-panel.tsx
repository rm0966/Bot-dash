import { useState } from "react";
import { Member, useKickMember, useBanMember, useMuteMember, useWarnMember, useGetMemberWarnings, getGetMemberWarningsQueryKey, useGetRoles, getGetRolesQueryKey, useAddMemberRole, useRemoveMemberRole, getGetMembersQueryKey, useChangeNickname, useSendDm } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/discord-utils";
import { Search, Gavel, Loader2, AlertTriangle, ShieldAlert, ShieldBan, ShieldOff, Shield, Tags, MessageCircle, Pencil, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      <div className="p-4 border-b border-border bg-card/30 flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            className="pl-9 bg-background h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/30 sticky top-0 z-10 border-b border-border">
            <tr>
              <th className="px-5 py-3 font-medium">Member</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Roles</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border/50">
                      <AvatarImage src={getAvatarUrl(member.id, member.avatar, member.discriminator)} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{member.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate">
                        {member.nickname || member.username}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {member.nickname ? member.username : ''} {member.id}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  {member.roles && member.roles.length > 0 ? (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {member.roles.length} roles
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-1">
                    <NicknameDialog member={member} guildId={guildId} token={token} />
                    <DmDialog member={member} guildId={guildId} token={token} />
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
                <td colSpan={3} className="px-5 py-16 text-center text-muted-foreground text-sm">
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

function NicknameDialog({ member, guildId, token }: { member: Member; guildId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(member.nickname || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const changeNickname = useChangeNickname();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    changeNickname.mutate(
      { guildId, userId: member.id, data: { token, nickname: nickname.trim() || null } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Nickname Changed", description: res.message });
            queryClient.invalidateQueries({ queryKey: getGetMembersQueryKey(guildId) });
            setOpen(false);
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to change nickname", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Change Nickname</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Change Nickname
          </DialogTitle>
          <DialogDescription>Change nickname for <strong>{member.username}</strong></DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nickname</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Leave empty to reset nickname"
              className="bg-background"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Leave empty to reset to original username</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={changeNickname.isPending}>Cancel</Button>
            <Button type="submit" disabled={changeNickname.isPending}>
              {changeNickname.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DmDialog({ member, guildId, token }: { member: Member; guildId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const sendDm = useSendDm();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendDm.mutate(
      { guildId, data: { token, userId: member.id, content: message.trim() } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "DM Sent", description: `Message sent to ${member.username}` });
            setMessage("");
            setOpen(false);
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to send DM. User may have DMs disabled.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Send DM</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-400" />
            Send Direct Message
          </DialogTitle>
          <DialogDescription>Send a DM to <strong>{member.username}</strong> from the bot</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="bg-background resize-none"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={sendDm.isPending}>Cancel</Button>
            <Button type="submit" disabled={sendDm.isPending || !message.trim()}>
              {sendDm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send DM
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    kick: { icon: ShieldOff, color: "text-orange-400", label: "Kick", variant: "outline" as const, desc: "Remove user from server" },
    ban: { icon: ShieldBan, color: "text-destructive", label: "Ban", variant: "destructive" as const, desc: "Permanently ban user" },
    mute: { icon: ShieldAlert, color: "text-yellow-400", label: "Timeout", variant: "outline" as const, desc: "Temporarily mute user" },
    warn: { icon: AlertTriangle, color: "text-blue-400", label: "Warn", variant: "outline" as const, desc: "Log a formal warning" }
  };

  const c = config[type];
  const Icon = c.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const handleResult = (res: any) => {
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

    if (type === "kick") kick.mutate({ guildId, userId: member.id, data: { token, reason } }, { onSuccess: handleResult, onError: handleError });
    else if (type === "ban") ban.mutate({ guildId, userId: member.id, data: { token, reason } }, { onSuccess: handleResult, onError: handleError });
    else if (type === "warn") warn.mutate({ guildId, userId: member.id, data: { token, reason } }, { onSuccess: handleResult, onError: handleError });
    else if (type === "mute") mute.mutate({ guildId, userId: member.id, data: { token, reason, durationMinutes: parseInt(duration) || 60 } }, { onSuccess: handleResult, onError: handleError });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted">
              <Icon className={`h-3.5 w-3.5 ${c.color}`} />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{c.label}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${c.color}`} />
            {c.label} {member.username}
          </DialogTitle>
          <DialogDescription>{c.desc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {type === "mute" && (
            <div className="space-y-2">
              <Label>Duration (Minutes)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="1" max="40320" required className="bg-background" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Violating rules" className="bg-background" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
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
    query: { queryKey: getGetMemberWarningsQueryKey(guildId, member.id), enabled: open },
    request: { headers: { "X-Bot-Token": token } }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted text-muted-foreground">
              <Gavel className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>View Warnings</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Warnings: {member.username}</DialogTitle>
          <DialogDescription>Infraction history for this member</DialogDescription>
        </DialogHeader>
        <div className="pt-2 max-h-[300px] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : warnings && warnings.length > 0 ? (
            warnings.map((w, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3 border border-border/50 text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-primary text-xs uppercase tracking-wide">Warning #{i + 1}</span>
                  <span className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-foreground">{w.reason}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
              <Shield className="h-7 w-7 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No warnings found.</p>
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
    query: { queryKey: getGetRolesQueryKey(guildId), enabled: open && !!guildId && !!token },
    request: { headers: { "X-Bot-Token": token } }
  });

  const addRole = useAddMemberRole();
  const removeRole = useRemoveMemberRole();
  const isPending = addRole.isPending || removeRole.isPending;

  const handleToggleRole = (roleId: string, hasRole: boolean) => {
    const opts = {
      onSuccess: (res: any) => {
        if (res.success) {
          toast({ title: hasRole ? "Role Removed" : "Role Added", description: res.message });
          queryClient.invalidateQueries({ queryKey: getGetMembersQueryKey(guildId) });
        } else {
          toast({ title: "Failed", description: res.message, variant: "destructive" });
        }
      },
      onError: (err: any) => {
        const msg = err.error || (hasRole ? "Failed to remove role" : "Failed to add role");
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    };

    if (hasRole) {
      removeRole.mutate({ guildId, userId: member.id, roleId, data: { token } }, opts);
    } else {
      addRole.mutate({ guildId, userId: member.id, roleId, data: { token } }, opts);
    }
  };

  const sortedRoles = roles ? [...roles].filter(r => r.name !== "@everyone").sort((a, b) => b.position - a.position) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted">
              <Tags className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Manage Roles</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" />
            Manage Roles: {member.username}
          </DialogTitle>
          <DialogDescription>Toggle roles for this member</DialogDescription>
        </DialogHeader>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 flex items-start gap-2 mt-1">
          <Info className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200/70">Bot needs <strong>Manage Roles</strong> permission, and target role must be below the bot's highest role.</p>
        </div>
        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pt-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : sortedRoles.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No assignable roles found.</p>
          ) : (
            sortedRoles.map(role => {
              const memberRoles = (member.roles || []) as string[];
              const hasRole = memberRoles.includes(role.id) || (memberRoles as any[]).some((r: any) => r?.id === role.id);
              const hexColor = role.color === 0 ? null : '#' + role.color.toString(16).padStart(6, '0');

              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50 cursor-pointer"
                  onClick={() => !isPending && !role.managed && handleToggleRole(role.id, hasRole)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={hasRole}
                      disabled={isPending || role.managed}
                      onCheckedChange={() => handleToggleRole(role.id, hasRole)}
                    />
                    <label htmlFor={`role-${role.id}`} className="flex items-center gap-2 cursor-pointer font-medium text-sm leading-none">
                      <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: hexColor || '#6b7280' }} />
                      {role.name}
                    </label>
                  </div>
                  {role.managed && <Badge variant="secondary" className="text-[9px] px-1.5">Bot</Badge>}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
