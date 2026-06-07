import { ReactNode } from "react";
import { useBot } from "@/hooks/use-bot";
import { Button } from "@/components/ui/button";
import { LogOut, Bot, Zap } from "lucide-react";
import { getAvatarUrl } from "@/lib/discord-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const { botInfo, logout } = useBot();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto h-14 flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">BotPanel</span>
          </Link>

          {botInfo && (
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                <div className="relative">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarImage src={getAvatarUrl(botInfo.id, botInfo.avatar, botInfo.discriminator)} />
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">{botInfo.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-semibold leading-none text-foreground">{botInfo.username}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">Online</span>
                </div>
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground h-8 px-2.5 text-xs gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            </div>
          )}

          {!botInfo && (
            <div className="flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Not connected</span>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
