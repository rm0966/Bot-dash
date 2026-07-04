import { useState, useEffect, useRef } from "react";
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

interface JobStatus {
  id: string;
  status: "running" | "done" | "error";
  sent: number;
  failed: number;
  total: number;
  message: string;
}

type Mode = "server" | "all";

export function BroadcastPanel({ guildId, token }: BroadcastPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("server");
  const [content, setContent] = useState("");
  const [skipBots, setSkipBots] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/discord/broadcast-jobs/${jobId}`);
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJob(data);
        if (data.status !== "running") {
          stopPolling();
          setSending(false);
          setConfirmed(false);
          toast({ title: "اكتمل الإعلان ✅", description: data.message });
        }
      } catch {}
    }, 1200);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !confirmed) return;
    setSending(true);
    setJob(null);

    try {
      const url = mode === "all"
        ? `${apiBase}/api/discord/broadcast-all`
        : `${apiBase}/api/discord/guilds/${guildId}/broadcast`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, content: content.trim(), skipBots }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "خطأ", description: data.error || "فشل الإرسال", variant: "destructive" });
        setSending(false);
        setConfirmed(false);
        return;
      }
      const { jobId } = data;
      setJob({ id: jobId, status: "running", sent: 0, failed: 0, total: data.total ?? 0, message: "" });
      startPolling(jobId);
    } catch {
      toast({ title: "خطأ", description: "فشل الاتصال", variant: "destructive" });
      setSending(false);
      setConfirmed(false);
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 2000;
  const progress = job && job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0;
  const isDone = job?.status === "done";

  return (
    <div className="p-6 space-y-5 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">إعلان جماعي</h3>
          <p className="text-sm text-muted-foreground">أرسل رسالة في الخاص لجميع الأعضاء</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border/50">
        {(["server", "all"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setConfirmed(false); setJob(null); stopPolling(); setSending(false); }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              mode === m
                ? "bg-card border border-border shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "server" ? <Server className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            {m === "server" ? "هذا السيرفر" : "كل السيرفرات"}
          </button>
        ))}
      </div>

      {/* Warning */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          {mode === "all"
            ? "يجمع الأعضاء من كل السيرفرات ويُرسل لكل شخص مرة واحدة فقط. قد يستغرق وقتًا طويلاً."
            : "من أوقف خاصية الرسائل لن يستقبلها. راعِ ريت ليمت ديسكورد."}
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        {/* Message */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>الرسالة</Label>
            <span className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount}/2000
            </span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setConfirmed(false); setJob(null); }}
            placeholder="اكتب رسالة الإعلان هنا..."
            className="bg-background resize-y min-h-[130px] text-sm"
            disabled={sending}
          />
        </div>

        {/* Skip bots */}
        <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">تخطي البوتات</p>
              <p className="text-xs text-muted-foreground">لا ترسل للحسابات الآلية</p>
            </div>
          </div>
          <Switch checked={skipBots} onCheckedChange={(v) => { setSkipBots(v); setConfirmed(false); }} disabled={sending} />
        </div>

        {/* Confirm */}
        {content.trim() && !isOverLimit && !sending && !confirmed && !isDone && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-destructive">تأكيد الإعلان</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mode === "all"
                ? "سيُرسل لكل الأعضاء الفريدين عبر جميع سيرفراتك."
                : "سيُرسل لجميع أعضاء هذا السيرفر."}
              {" "}لا يمكن التراجع.
            </p>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmed(true)}>
              أفهم، أكمل
            </Button>
          </div>
        )}

        {/* Send button */}
        {confirmed && !sending && (
          <Button type="submit" disabled={!content.trim() || isOverLimit} className="w-full" variant="destructive">
            <Send className="mr-2 h-4 w-4" />
            {mode === "all" ? "إرسال لكل السيرفرات" : "إرسال الإعلان"}
          </Button>
        )}

        {/* Progress */}
        {sending && job && (
          <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">جاري الإرسال...</span>
              </div>
              <span className="text-muted-foreground font-mono text-xs">
                {job.sent + job.failed} / {job.total}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="text-green-400">✓ {job.sent} وصلت</span>
              <span className="font-medium">{progress}%</span>
              <span className="text-destructive">✗ {job.failed} فشلت</span>
            </div>
          </div>
        )}
      </form>

      {/* Result */}
      {isDone && job && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            اكتمل الإعلان
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-2xl font-bold text-green-400">{job.sent}</div>
              <div className="text-xs text-muted-foreground mt-1">وصلت</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="text-2xl font-bold text-destructive">{job.failed}</div>
              <div className="text-xs text-muted-foreground mt-1">فشلت</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/40 border border-border">
              <div className="text-2xl font-bold">{job.total}</div>
              <div className="text-xs text-muted-foreground mt-1">الإجمالي</div>
            </div>
          </div>
          {job.failed > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span>الأعضاء الذين فشل إرسالهم أوقفوا الرسائل الخاصة أو بلّغوا عن البوت.</span>
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={() => { setContent(""); setJob(null); setSending(false); }}>
            إرسال إعلان آخر
          </Button>
        </div>
      )}
    </div>
  );
}
