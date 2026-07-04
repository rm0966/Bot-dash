import { useState } from "react";
import { useBot, SavedToken } from "@/hooks/use-bot";
import { useConnectBot, useGetGuilds, getGetGuildsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, Server, ChevronRight, Zap, Shield, MessageSquare,
  Users, Eye, EyeOff, Bookmark, Trash2, Plus, Check, KeyRound, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGuildIconUrl } from "@/lib/discord-utils";
import { Link } from "wouter";

export default function Home() {
  const { token, setBot, savedTokens, saveCurrentToken, deleteToken, switchToken } = useBot();
  const [inputToken, setInputToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [showNewForm, setShowNewForm] = useState(savedTokens.length === 0);
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

  const handleSwitchToken = (saved: SavedToken) => {
    switchToken(saved);
    toast({ title: "Switched", description: `Now using ${saved.name}` });
  };

  const handleSaveToken = () => {
    if (!saveName.trim()) return;
    saveCurrentToken(saveName.trim());
    setSaveName("");
    setShowSaveForm(false);
    toast({ title: "Token saved", description: `Saved as "${saveName.trim()}"` });
  };

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4">
          {/* Saved Tokens */}
          {savedTokens.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Saved Bots</span>
              </div>
              <div className="divide-y divide-border">
                {savedTokens.map((saved) => (
                  <div key={saved.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {saved.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{saved.name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{saved.botInfo.username}</p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteToken(saved.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs shrink-0"
                      onClick={() => handleSwitchToken(saved)}
                    >
                      Connect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Token Form */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {savedTokens.length > 0 && (
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center gap-2 border-b border-border hover:bg-muted/20 transition-colors text-sm font-medium"
                onClick={() => setShowNewForm(!showNewForm)}
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Connect a new bot</span>
                {showNewForm
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
              </button>
            )}

            {(showNewForm || savedTokens.length === 0) && (
              <div className="p-5">
                {savedTokens.length === 0 && (
                  <div className="text-center mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 glow-blue-sm">
                      <Zap className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Connect your bot</h1>
                    <p className="text-sm text-muted-foreground mt-1">Enter your bot token to start managing your Discord servers</p>
                  </div>
                )}

                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="space-y-1.5">
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
            )}
          </div>

          {savedTokens.length === 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: MessageSquare, label: "Send Messages" },
                { icon: Shield, label: "Moderation" },
                { icon: Users, label: "Manage Members" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="bg-card/60 border border-border rounded-lg p-3 text-center">
                  <Icon className="h-4.5 w-4.5 text-primary mx-auto mb-1.5" />
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <GuildList token={token} />;
}

function GuildList({ token }: { token: string }) {
  const [search, setSearch] = useState("");
  const { botInfo, logout, savedTokens, saveCurrentToken, switchToken, deleteToken } = useBot();
  const [saveName, setSaveName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [showTokenSwitcher, setShowTokenSwitcher] = useState(false);
  const { toast } = useToast();

  const isCurrentTokenSaved = savedTokens.some((t) => t.token === token);

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

  const handleSave = () => {
    if (!saveName.trim()) return;
    saveCurrentToken(saveName.trim());
    setSaveName("");
    setShowSaveForm(false);
    toast({ title: "Bot saved", description: `Saved as "${saveName.trim()}"` });
  };

  const handleSwitch = (saved: SavedToken) => {
    switchToken(saved);
    setShowTokenSwitcher(false);
    toast({ title: "Switched", description: `Now using ${saved.name}` });
  };

  const otherTokens = savedTokens.filter((t) => t.token !== token);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Your Servers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {guilds ? `${guilds.length} server${guilds.length !== 1 ? 's' : ''} found` : 'Loading...'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Save current token */}
          {!isCurrentTokenSaved && (
            showSaveForm ? (
              <div className="flex items-center gap-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Bot name..."
                  className="h-8 text-xs w-32"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  autoFocus
                />
                <Button size="sm" className="h-8 px-2" onClick={handleSave} disabled={!saveName.trim()}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowSaveForm(false)}>
                  ✕
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowSaveForm(true)}>
                <Bookmark className="h-3.5 w-3.5" />
                Save Bot
              </Button>
            )
          )}

          {/* Switch token */}
          {otherTokens.length > 0 && (
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowTokenSwitcher(!showTokenSwitcher)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Switch Bot
              </Button>
              {showTokenSwitcher && (
                <div className="absolute right-0 mt-1 w-52 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  {otherTokens.map((saved) => (
                    <button
                      key={saved.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                      onClick={() => handleSwitch(saved)}
                    >
                      <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-primary">{saved.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{saved.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">@{saved.botInfo.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search servers..."
              className="pl-9 bg-card h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
