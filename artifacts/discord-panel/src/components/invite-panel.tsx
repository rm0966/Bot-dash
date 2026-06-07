import { useState } from "react";
import { useGetChannels, getGetChannelsQueryKey, useCreateInvite } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2, Copy, Check, Hash } from "lucide-react";

interface InvitePanelProps {
  guildId: string;
  token: string;
}

export function InvitePanel({ guildId, token }: InvitePanelProps) {
  const { toast } = useToast();
  const [channelId, setChannelId] = useState("");
  const [maxAge, setMaxAge] = useState("86400");
  const [maxUses, setMaxUses] = useState("0");
  const [result, setResult] = useState<{ url: string; code: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useGetChannels(guildId, {
    query: { queryKey: getGetChannelsQueryKey(guildId), enabled: !!guildId && !!token },
    request: { headers: { "X-Bot-Token": token } }
  });

  const createInvite = useCreateInvite();
  const textChannels = channels?.filter(c => c.type === 0) || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId) return;
    setResult(null);

    createInvite.mutate(
      {
        guildId,
        channelId,
        data: { token, maxAge: parseInt(maxAge) || 86400, maxUses: parseInt(maxUses) || 0 }
      },
      {
        onSuccess: (res: any) => {
          setResult({ url: res.url, code: res.code, expiresAt: res.expiresAt });
          toast({ title: "Invite Created", description: `Code: ${res.code}` });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to create invite", variant: "destructive" });
        }
      }
    );
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Invite link copied to clipboard." });
  };

  const ageOptions = [
    { label: "30 minutes", value: "1800" },
    { label: "1 hour", value: "3600" },
    { label: "6 hours", value: "21600" },
    { label: "12 hours", value: "43200" },
    { label: "1 day", value: "86400" },
    { label: "7 days", value: "604800" },
    { label: "Never", value: "0" },
  ];

  const usesOptions = [
    { label: "Unlimited", value: "0" },
    { label: "1 use", value: "1" },
    { label: "5 uses", value: "5" },
    { label: "10 uses", value: "10" },
    { label: "25 uses", value: "25" },
    { label: "50 uses", value: "50" },
    { label: "100 uses", value: "100" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Create Invite Link</h3>
          <p className="text-sm text-muted-foreground">Generate an invite link for any channel</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select value={channelId} onValueChange={setChannelId} disabled={channelsLoading}>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Expires After</Label>
            <Select value={maxAge} onValueChange={setMaxAge}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ageOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Uses</Label>
            <Select value={maxUses} onValueChange={setMaxUses}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {usesOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!channelId || createInvite.isPending}
          className="w-full"
        >
          {createInvite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
          Generate Invite
        </Button>
      </form>

      {result && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-primary">Invite Created!</div>
          <div className="flex items-center gap-2">
            <Input
              value={result.url}
              readOnly
              className="bg-background font-mono text-sm"
            />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {result.expiresAt && (
            <p className="text-xs text-muted-foreground">
              Expires: {new Date(result.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
