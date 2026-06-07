import { useState } from "react";
import { useBot } from "@/hooks/use-bot";
import { useConnectBot, useGetGuilds, getGetGuildsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { KeyRound, Server, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGuildIconUrl } from "@/lib/discord-utils";
import { Link } from "wouter";

export default function Home() {
  const { token, setBot } = useBot();
  const [inputToken, setInputToken] = useState("");
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
          toast({
            title: "Connected successfully",
            description: `Logged in as ${botInfo.username}#${botInfo.discriminator}`,
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Connection failed",
            description: err.error || "Invalid token or network error",
          });
        },
      }
    );
  };

  if (!token) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/50 shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Connect Bot</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your Discord bot token to access the control panel.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleConnect}>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="token" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Bot Token
                  </label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="MTE..."
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={!inputToken.trim() || connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Initialize Connection
              </Button>
            </CardFooter>
          </form>
        </Card>
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
    request: {
      headers: { "X-Bot-Token": token },
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <p className="text-destructive">Failed to load guilds. Please try reconnecting.</p>
      </div>
    );
  }

  const filteredGuilds = guilds?.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Servers</h1>
          <p className="text-muted-foreground mt-1">Select a server to manage</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search servers..." 
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredGuilds.length === 0 ? (
        <div className="text-center py-20 bg-card/30 rounded-lg border border-border border-dashed">
          <Server className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No servers found</h3>
          <p className="text-muted-foreground mt-1">
            {search ? "No servers match your search query." : "The bot is not in any servers."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGuilds.map((guild) => (
            <Link key={guild.id} href={`/guild/${guild.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full bg-card/50 hover:bg-card">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-secondary overflow-hidden shrink-0 flex items-center justify-center border border-border/50">
                    {guild.icon ? (
                      <img 
                        src={getGuildIconUrl(guild.id, guild.icon)!} 
                        alt={guild.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">
                        {guild.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-semibold text-base truncate" title={guild.name}>
                      {guild.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {guild.memberCount ? `${guild.memberCount.toLocaleString()} members` : 'Unknown members'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
