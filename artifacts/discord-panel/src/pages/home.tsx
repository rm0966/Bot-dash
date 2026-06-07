import { useState } from "react";
import { useBot } from "@/hooks/use-bot";
import { useConnectBot, useGetGuilds, getGetGuildsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Server, ChevronRight, Zap, Shield, MessageSquare, Users, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGuildIconUrl } from "@/lib/discord-utils";
import { Link } from "wouter";

export default function Home() {
  const { token, setBot } = useBot();
  const [inputToken, setInputToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();
  const connectMutation = useConnectBot();

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    connectMutation.mutate(
      { data: { token: inputToken.trim() } },
      {
        onSuccess: (botInfo) => {
          setBot(inputToken.trim(), botInfo);
          toast({ title: "Connected", description: `Logged in as ${botInfo.username}` });
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Connection failed", description: (err as any).error || "Invalid token" });
        },
      }
    );
  };

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 glow-violet-sm">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Connect your bot</h1>
            <p className="text-sm text-muted-foreground mt-2">Enter your bot token to start managing your Discord servers</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium">Bot Token</label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? "text" : "password"}
                    placeholder="MTE..."
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="font-mono pr-10 bg-background text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Get your bot token from the Discord Developer Portal</p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!inputToken.trim() || connectMutation.isPending}
              >
                {connectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Connect Bot
              </Button>
            </form>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: MessageSquare, label: "Send Messages" },
              { icon: Shield, label: "Moderation" },
              { icon: Users, label: "Manage Members" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="bg-card/50 border border-border rounded-lg p-3 text-center">
                <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <GuildList token={token} />;
}

function GuildList({ token }: { token: string }) {
  const [search, setSearch] = useState("");

  const { data: guilds, isLoading, isError } = useGetGuilds({
    query: {
      queryKey: getGetGuildsQueryKey(),
      enabled: !!token,
    },
    request: { headers: { "X-Bot-Token": token } },
  });

  const filteredGuilds = guilds?.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Your Servers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {guilds ? `${guilds.length} server${guilds.length !== 1 ? 's' : ''} found` : 'Loading...'}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            className="pl-9 bg-card h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-destructive text-sm">Failed to load servers. Please reconnect your bot.</div>
      ) : filteredGuilds.length === 0 ? (
        <div className="text-center py-20 bg-card/30 rounded-xl border border-border border-dashed">
          <Server className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {search ? "No servers match your search." : "The bot is not in any servers."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGuilds.map((guild) => (
            <Link key={guild.id} href={`/guild/${guild.id}`}>
              <div className="group flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer">
                <div className="h-11 w-11 rounded-xl bg-secondary overflow-hidden shrink-0 flex items-center justify-center border border-border/50 shadow-sm">
                  {guild.icon ? (
                    <img
                      src={getGuildIconUrl(guild.id, guild.icon)!}
                      alt={guild.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {guild.name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors" title={guild.name}>
                    {guild.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {guild.memberCount ? `${guild.memberCount.toLocaleString()} members` : 'Click to manage'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
