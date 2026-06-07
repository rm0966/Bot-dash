import { useGetBans, getGetBansQueryKey, useUnbanMember } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldBan, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/discord-utils";
import { useQueryClient } from "@tanstack/react-query";

interface BanPanelProps {
  guildId: string;
  token: string;
}

export function BanPanel({ guildId, token }: BanPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bans, isLoading } = useGetBans(guildId, {
    query: {
      queryKey: getGetBansQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const unbanMember = useUnbanMember();

  const handleUnban = (userId: string) => {
    if (!confirm("Are you sure you want to unban this user?")) return;
    unbanMember.mutate(
      { guildId, userId, data: { token } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "User Unbanned", description: "Successfully unbanned the user." });
            queryClient.invalidateQueries({ queryKey: getGetBansQueryKey(guildId) });
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to unban user.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-4 border-b border-border bg-card/50 flex justify-between items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
          <ShieldBan className="h-5 w-5" />
          Banned Members
        </h3>
        <div className="text-sm text-muted-foreground">{bans?.length || 0} banned members</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : !bans || bans.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No banned members found.</div>
        ) : (
          <div className="grid gap-3">
            {bans.map((ban: any) => (
              <div key={ban.userId} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getAvatarUrl(ban.userId, ban.avatar, ban.discriminator)} />
                    <AvatarFallback>{ban.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{ban.username}</span>
                    <span className="text-xs text-muted-foreground">Reason: {ban.reason || "No reason provided"}</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleUnban(ban.userId)}
                  disabled={unbanMember.isPending}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Unban
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
