import { useState } from "react";
import { useGetChannels, getGetChannelsQueryKey, usePurgeMessages } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, AlertTriangle, Hash } from "lucide-react";

interface PurgePanelProps {
  guildId: string;
  token: string;
}

export function PurgePanel({ guildId, token }: PurgePanelProps) {
  const { toast } = useToast();
  const [channelId, setChannelId] = useState("");
  const [count, setCount] = useState("10");
  const [confirmed, setConfirmed] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useGetChannels(guildId, {
    query: { queryKey: getGetChannelsQueryKey(guildId), enabled: !!guildId && !!token },
    request: { headers: { "X-Bot-Token": token } }
  });

  const purge = usePurgeMessages();
  const textChannels = channels?.filter(c => c.type === 0) || [];
  const selectedChannel = textChannels.find(c => c.id === channelId);

  const handlePurge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId || !confirmed) return;

    purge.mutate(
      { channelId, data: { token, count: parseInt(count) || 10 } },
      {
        onSuccess: (res: any) => {
          toast({ title: "Messages Purged", description: res.message });
          setConfirmed(false);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to purge messages", variant: "destructive" });
          setConfirmed(false);
        }
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold">Purge Messages</h3>
          <p className="text-sm text-muted-foreground">Bulk delete recent messages from a channel</p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-200/80">
          Only messages within the last 14 days can be bulk deleted. Older messages must be deleted individually.
          This action <strong>cannot be undone</strong>.
        </p>
      </div>

      <form onSubmit={handlePurge} className="space-y-4">
        <div className="space-y-2">
          <Label>Target Channel</Label>
          <Select value={channelId} onValueChange={(v) => { setChannelId(v); setConfirmed(false); }} disabled={channelsLoading}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select a channel..." />
            </SelectTrigger>
            <SelectContent>
              {textChannels.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Number of Messages (max 100)</Label>
          <Input
            type="number"
            value={count}
            onChange={(e) => { setCount(e.target.value); setConfirmed(false); }}
            min="1"
            max="100"
            className="bg-background"
          />
        </div>

        {channelId && !confirmed && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-destructive">Confirm deletion</p>
            <p className="text-xs text-muted-foreground">
              This will delete up to <strong>{count}</strong> message{parseInt(count) !== 1 ? 's' : ''} from{" "}
              <strong>#{selectedChannel?.name}</strong>. This cannot be undone.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmed(true)}
            >
              I understand, proceed
            </Button>
          </div>
        )}

        {confirmed && (
          <Button
            type="submit"
            variant="destructive"
            disabled={!channelId || purge.isPending}
            className="w-full"
          >
            {purge.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete {count} Message{parseInt(count) !== 1 ? 's' : ''} from #{selectedChannel?.name}
          </Button>
        )}
      </form>
    </div>
  );
}
