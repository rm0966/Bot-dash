import { ReactNode } from "react";
import { useBot } from "@/hooks/use-bot";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { getAvatarUrl } from "@/lib/discord-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const { botInfo, logout } = useBot();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {botInfo && (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card/50 backdrop-blur-md">
          <div className="container mx-auto h-16 flex items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={getAvatarUrl(botInfo.id, botInfo.avatar, botInfo.discriminator)} />
                <AvatarFallback>{botInfo.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-none">{botInfo.username}</span>
                <span className="text-xs text-muted-foreground mt-1 leading-none">#{botInfo.discriminator}</span>
              </div>
            </Link>
            
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </header>
      )}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
