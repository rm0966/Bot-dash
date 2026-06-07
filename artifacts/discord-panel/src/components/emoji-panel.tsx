import { useGetEmojis, getGetEmojisQueryKey } from "@workspace/api-client-react";
import { Loader2, Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

interface EmojiPanelProps {
  guildId: string;
  token: string;
}

export function EmojiPanel({ guildId, token }: EmojiPanelProps) {
  const [search, setSearch] = useState("");

  const { data: emojis, isLoading } = useGetEmojis(guildId, {
    query: {
      queryKey: getGetEmojisQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const filtered = emojis?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-4 border-b border-border bg-card/30 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search emojis..."
            className="pl-9 bg-background h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} emoji{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Smile className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">{search ? "No emojis match your search." : "No custom emojis in this server."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {filtered.map(emoji => (
              <div
                key={emoji.id}
                className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-transparent hover:border-border hover:bg-card transition-all cursor-default"
                title={`:${emoji.name}:`}
              >
                <img
                  src={emoji.url}
                  alt={emoji.name}
                  className="w-10 h-10 object-contain"
                  loading="lazy"
                />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-none">
                  {emoji.name}
                </span>
                {emoji.animated && (
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">GIF</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
