import { useState } from "react";
import { useBroadcastDm, useBroadcastAll } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Megaphone, Users, CheckCircle2, XCircle,
  AlertTriangle, Send, Globe, Server
} from "lucide-react";

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

type Mode = "server" | "all";

export function BroadcastPanel({ guildId, token }: BroadcastPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("server");
  const [content, setContent] = useState("");
  const [skipBots, setSkipBots] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<BroadcastStatus>(null);

  const broadcastServer = useBroadcastDm();
  const broadcastAll = useBroadcastAll();

  const isPending = broadcastServer.isPending || broadcastAll.isPending;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !confirmed) return;
    setResult(null);

    const onSuccess = (res: any) => {
      setResult({ sent: res.sent, failed: res.failed, total: res.total, message: res.message });
      setConfirmed(false);
      toast({ title: "Broadcast Complete", description: res.message });
    };
    const onError = (err: any) => {
      toast({ title: "Broadcast Failed", description: err.error || "Something went wrong", variant: "destructive" });
      setConfirmed(false);
    };

    if (mode === "server") {
      broadcastServer.mutate(
        { guildId, data: { token, content: content.trim(), skipBots } },
        { onSuccess, onError }
      );
    } else {
      broadcastAll.mutate(
        { data: { token, content: content.trim(), skipBots } },
        { onSuccess, onError }
      );
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 2000;

  return (
    <div className="p-6 space-y-5 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Broadcast Message</h3>
          <p className="text-sm text-muted-foreground">
            Send a DM to members via your bot
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border/50">
        <button
          type="button"
          onClick={() => { setMode("server"); setConfirmed(false); setResult(null); }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
            mode === "server"
              ? "bg-card border border-border shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          هذا السيرفر
        </button>
        <button
          type="button"
          onClick={() => { setMode("all"); setConfirmed(false); setResult(null); }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
            mode === "all"
              ? "bg-card border border-border shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          كل السيرفرات
        </button>
      </div>

      {/* Warning */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/80 space-y-1">
          {mode === "all" ? (
            <>
              <p><strong>إعلان شامل:</strong> سيُرسل الخاص لكل عضو فريد عبر جميع السيرفرات — بدون تكرار.</p>
              <p>قد يستغرق وقتًا طويلاً على السيرفرات الكبيرة.</p>
            </>
          ) : (
            <>
              <p><strong>تنبيه:</strong> من أوقف خاصية الرسائل لن يستقبل الرسالة.</p>
              <p>قد تستغرق العملية عدة دقائق في السيرفرات الكبيرة.</p>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        {/* Message Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>الرسالة</Label>
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
            placeholder="اكتب رسالة الإعلان هنا..."
            className="bg-background resize-y min-h-[130px] text-sm"
            disabled={isPending}
          />
        </div>

        {/* Skip Bots */}
        <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">تخطي البوتات</p>
              <p className="text-xs text-muted-foreground">لا ترسل للحسابات الآلية</p>
            </div>
          </div>
          <Switch
            checked={skipBots}
            onCheckedChange={(v) => { setSkipBots(v); setConfirmed(false); }}
            disabled={isPending}
          />
        </div>

        {/* Confirm Step */}
        {content.trim() && !isOverLimit && !isPending && !confirmed && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-destructive">تأكيد الإعلان</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mode === "all"
                ? "سيُرسل هذا الإعلان لكل الأعضاء الفريدين عبر جميع سيرفراتك (مرة واحدة لكل شخص)."
                : "سيُرسل هذا الإعلان في الخاص لجميع أعضاء هذا السيرفر."
              }
              {skipBots ? " (باستثناء البوتات)" : ""}
              {" "}لا يمكن التراجع عن هذه العملية.
            </p>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmed(true)}>
              أفهم، أرسل الإعلان
            </Button>
          </div>
        )}

        {/* Send Button */}
        {confirmed && !isPending && (
          <Button type="submit" disabled={!content.trim() || isOverLimit} className="w-full" variant="destructive">
            <Send className="mr-2 h-4 w-4" />
            {mode === "all" ? "إرسال لكل السيرفرات الآن" : "إرسال الإعلان الآن"}
          </Button>
        )}

        {/* Progress */}
        {isPending && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 bg-muted/20 rounded-xl border border-border/50">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">جاري الإرسال...</p>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "all"
                  ? "يتم الإرسال لجميع السيرفرات — قد يستغرق وقتًا أطول."
                  : "يتم الإرسال للأعضاء — برجاء الانتظار."}
              </p>
            </div>
          </div>
        )}
      </form>

      {/* Result */}
      {result && !isPending && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            اكتمل الإعلان
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-2xl font-bold text-green-400">{result.sent}</div>
              <div className="text-xs text-muted-foreground mt-1">تم الإرسال</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="text-2xl font-bold text-destructive">{result.failed}</div>
              <div className="text-xs text-muted-foreground mt-1">فشل</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/40 border border-border">
              <div className="text-2xl font-bold">{result.total}</div>
              <div className="text-xs text-muted-foreground mt-1">الإجمالي</div>
            </div>
          </div>

          {result.failed > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span>الأعضاء الذين فشل إرسالهم أوقفوا الرسائل الخاصة أو بلّغوا عن البوت.</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setContent(""); setResult(null); }}
          >
            إرسال إعلان آخر
          </Button>
        </div>
      )}
    </div>
  );
}
