import { useState } from "react";
import { useCreateChannel, useDeleteChannel, Channel, getGetChannelsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, Mic, Plus, Trash2, Loader2, ListTree } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

interface ChannelPanelProps {
  guildId: string;
  token: string;
  channels: Channel[];
}

export function ChannelPanel({ guildId, token, channels }: ChannelPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"0" | "2">("0");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createChannel.mutate(
      { guildId, data: { token, name, type: parseInt(type) } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Channel Created", description: "Successfully created channel." });
            queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey(guildId) });
            setOpen(false);
            setName("");
            setType("0");
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to create channel.", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (channelId: string) => {
    if (!confirm("Are you sure you want to delete this channel?")) return;
    deleteChannel.mutate(
      { channelId, data: { token } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Channel Deleted", description: "Successfully deleted channel." });
            queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey(guildId) });
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to delete channel.", variant: "destructive" });
        }
      }
    );
  };

  const sortedChannels = [...channels].sort((a, b) => ((a as any).position ?? 0) - ((b as any).position ?? 0));

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-4 border-b border-border bg-card/50 flex justify-between items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ListTree className="h-5 w-5 text-primary" />
          Server Channels
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Channel</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select value={type} onValueChange={(v: "0" | "2") => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Text Channel</SelectItem>
                    <SelectItem value="2">Voice Channel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Channel Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="new-channel" />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={createChannel.isPending}>Cancel</Button>
                <Button type="submit" disabled={createChannel.isPending || !name.trim()}>
                  {createChannel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sortedChannels.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No channels found.</div>
        ) : (
          <div className="grid gap-2">
            {sortedChannels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  {channel.type === 0 ? <Hash className="h-5 w-5 text-muted-foreground" /> : <Mic className="h-5 w-5 text-muted-foreground" />}
                  <span className="font-medium text-sm">{channel.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDelete(channel.id)} 
                  disabled={deleteChannel.isPending}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
