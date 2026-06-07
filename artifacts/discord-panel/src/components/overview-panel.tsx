import { useGetGuildOverview, getGetGuildOverviewQueryKey } from "@workspace/api-client-react";
import { Loader2, Users, Hash, Shield, Smile, Zap, Star, Calendar, Crown } from "lucide-react";

interface OverviewPanelProps {
  guildId: string;
  token: string;
}

export function OverviewPanel({ guildId, token }: OverviewPanelProps) {
  const { data: overview, isLoading, isError } = useGetGuildOverview(guildId, {
    query: {
      queryKey: getGetGuildOverviewQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="flex justify-center items-center h-64 text-destructive text-sm">
        Failed to load server info.
      </div>
    );
  }

  const boostTierNames = ["No Boost", "Level 1", "Level 2", "Level 3"];
  const createdDate = new Date(overview.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  const stats = [
    { icon: Users, label: "Members", value: overview.memberCount.toLocaleString(), color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { icon: Hash, label: "Channels", value: overview.channelCount.toLocaleString(), color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
    { icon: Shield, label: "Roles", value: overview.roleCount.toLocaleString(), color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
    { icon: Smile, label: "Emojis", value: overview.emojiCount.toLocaleString(), color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
    { icon: Star, label: "Boost Level", value: boostTierNames[overview.boostLevel] || `Level ${overview.boostLevel}`, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20" },
    { icon: Zap, label: "Boosts", value: overview.boostCount.toLocaleString(), color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="text-xl font-bold text-foreground">{overview.name}</div>
        {overview.description && (
          <p className="text-sm text-muted-foreground">{overview.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 border ${bg} flex items-center gap-3`}>
            <div className={`p-2 rounded-lg bg-background/60`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <div className="text-lg font-bold leading-none">{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Crown className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Server Owner ID</div>
            <div className="text-sm font-mono font-medium mt-0.5">{overview.ownerId}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created</div>
            <div className="text-sm font-medium mt-0.5">{createdDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
