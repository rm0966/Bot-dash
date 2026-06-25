import { useState } from "react";
import { useBroadcastDm } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Megaphone, Users, CheckCircle2, XCircle, AlertTriangle, Send } from "lucide-react";

interface BroadcastPanelProps {
  guildId: string;
  token: string;
}

type BroadcastStatus = {
  sent: number;
  failed: number;
  total: number;
  message: string;
} | null;

export function BroadcastPanel({ guildId, token }: BroadcastPanelProps) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [skipBots, setSkipBots] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<BroadcastStatus>(null);

  const broadcast = useBroadcastDm();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !confirmed) return;

    setResult(null);

    broadcast.mutate(
      { guildId, data: { token, content: content.trim(), skipBots } },
      {
        onSuccess: (res: any) => {
          setResult({
            sent: res.sent,
            failed: res.failed,
            total: res.total,
            message: res.message,
          });
          setConfirmed(false);
          toast({ title: "Broadcast Complete", description: res.message });
        },
        onError: (err: any) => {
          toast({
            title: "Broadcast Failed",
            description: err.error || "Something went wrong",
            variant: "destructive",
          });
          setConfirmed(false);
        },
      }
    );
  };

  const charCount = content.length;
  const isOverLimit = charCount > 2000;

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Broadcast Message</h3>
          <p className="text-sm text-muted-foreground">
            Send a DM to all members in this server
          </p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-xs text-yellow-200/80 space-y-1">
          <p>
            <strong>Important:</strong> Members who have DMs disabled will not receive the message.
            Sending to large servers may take several minutes due to Discord rate limits.
          </p>
          <p>Use this feature responsibly — mass DMs may result in your bot being reported.</p>
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Message</Label>
            <span className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount}/2000
            </span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setConfirmed(false);
              setResult(null);
            }}
            placeholder="Type your broadcast message here..."
            className="bg-background resize-y min-h-[140px] text-sm"
            disabled={broadcast.isPending}
          />
        </div>

        <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Skip bots</p>
              <p className="text-xs text-muted-foreground">Don't send DMs to bot accounts</p>
            </div>
          </div>
          <Switch
            checked={skipBots}
            onCheckedChange={(v) => { setSkipBots(v); setConfirmed(false); }}
            disabled={broadcast.isPending}
          />
        </div>

        {content.trim() && !isOverLimit && !broadcast.isPending && !confirmed && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-destructive">Confirm Broadcast</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will send the message above as a <strong>private DM</strong> to every member
              {skipBots ? " (excluding bots)" : ""} in this server.
              This action <strong>cannot be undone</strong>.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmed(true)}
            >
              I understand, confirm broadcast
            </Button>
          </div>
        )}

        {confirmed && !broadcast.isPending && (
          <Button
            type="submit"
            disabled={!content.trim() || isOverLimit}
            className="w-full"
            variant="destructive"
          >
            <Send className="mr-2 h-4 w-4" />
            Send Broadcast Now
          </Button>
        )}

        {broadcast.isPending && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 bg-muted/20 rounded-xl border border-border/50">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">Broadcasting...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sending messages to members. Please wait — this may take a few minutes for large servers.
              </p>
            </div>
          </div>
        )}
      </form>

      {result && !broadcast.isPending && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Broadcast Complete
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-2xl font-bold text-green-400">{result.sent}</div>
              <div className="text-xs text-muted-foreground mt-1">Sent</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="text-2xl font-bold text-destructive">{result.failed}</div>
              <div className="text-xs text-muted-foreground mt-1">Failed</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/40 border border-border">
              <div className="text-2xl font-bold">{result.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Total</div>
            </div>
          </div>

          {result.failed > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span>Failed members likely have DMs disabled or have blocked the bot.</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setContent(""); setResult(null); }}
          >
            Send Another Broadcast
          </Button>
        </div>
      )}
    </div>
  );
}
