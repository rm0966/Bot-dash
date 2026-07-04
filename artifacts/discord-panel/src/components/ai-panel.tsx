import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useGetChannels, getGetChannelsQueryKey } from "@workspace/api-client-react";
import {
  Bot, Loader2, Sparkles, Radio, RadioTower, Trash2,
  Info, CheckCircle2, Hash, RefreshCw
} from "lucide-react";

interface AiPanelProps {
  guildId: string;
  token: string;
}

interface AiStatus {
  active: boolean;
  enabled: boolean;
  channels: string[];
  systemPrompt: string;
}

export function AiPanel({ guildId, token }: AiPanelProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState(
    "أنت مساعد ذكي ومفيد في سيرفر ديسكورد. أجب بإيجاز وأدب."
  );

  const { data: channels } = useGetChannels(guildId, {
    query: { queryKey: getGetChannelsQueryKey(guildId) },
    request: { headers: { "X-Bot-Token": token } },
  });
  const textChannels = channels?.filter((c) => c.type === 0) || [];

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/discord/guilds/${guildId}/ai-session`, {
        headers: { "X-Bot-Token": token },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setEnabled(data.enabled ?? false);
        setSelectedChannels(data.channels ?? []);
        setSystemPrompt(data.systemPrompt ?? systemPrompt);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, [guildId]);

  const handleActivate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/discord/guilds/${guildId}/ai-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, enabled, channels: selectedChannels, systemPrompt }),
      });
      if (res.ok) {
        toast({ title: "تم الحفظ", description: "تم تطبيق إعدادات الذكاء الاصطناعي" });
        fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "خطأ", description: (err as any).error || "فشل الحفظ", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ", description: "فشل الاتصال بالسيرفر", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/discord/guilds/${guildId}/ai-session`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      toast({ title: "تم الإيقاف", description: "تم إيقاف البوت من السيرفر" });
      fetchStatus();
    } catch {}
    setSaving(false);
  };

  const handleClearHistory = async () => {
    await fetch(`${apiBase}/api/discord/guilds/${guildId}/ai-session/history`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    toast({ title: "تم المسح", description: "تم مسح سجل المحادثات" });
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((c) => c !== channelId) : [...prev, channelId]
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isActive = status?.active ?? false;

  return (
    <div className="p-6 space-y-6 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">ذكاء اصطناعي للسيرفر</h3>
          <p className="text-sm text-muted-foreground">يتكلم مع الأعضاء تلقائيًا باستخدام AI مجاني</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`flex items-center gap-2.5 p-3.5 rounded-xl border ${
        isActive
          ? "bg-green-500/10 border-green-500/20"
          : "bg-muted/30 border-border/50"
      }`}>
        {isActive ? (
          <RadioTower className="h-4 w-4 text-green-400 animate-pulse shrink-0" />
        ) : (
          <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isActive ? "البوت متصل بالسيرفر" : "البوت غير متصل"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive
              ? enabled
                ? "الذكاء الاصطناعي مفعّل ويرد على الرسائل"
                : "متصل لكن AI معطّل — فعّله من الأسفل"
              : "اضغط 'تفعيل' لتوصيل البوت وتشغيل AI"}
          </p>
        </div>
        {isActive && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={fetchStatus}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-200/80 leading-relaxed">
          يستخدم <strong>Pollinations.ai</strong> — خدمة AI مجانية بالكامل بدون مفتاح API.
          البوت يحفظ آخر 10 رسائل لكل مستخدم لمحادثة متسلسلة.
        </p>
      </div>

      <div className="space-y-5">
        {/* AI Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">تفعيل الذكاء الاصطناعي</p>
              <p className="text-xs text-muted-foreground">يرد البوت على رسائل الأعضاء بـ AI</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <Label className="text-sm">القنوات المستهدفة</Label>
          <p className="text-xs text-muted-foreground">بدون اختيار = يرد في كل القنوات</p>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-muted/20 p-2 space-y-1">
            {textChannels.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد قنوات نصية</p>
            ) : (
              textChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggleChannel(ch.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    selectedChannels.includes(ch.id)
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {selectedChannels.includes(ch.id) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {ch.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Label>شخصية البوت (System Prompt)</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="أنت مساعد ذكي..."
            className="bg-background resize-y min-h-[100px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            حدد كيف يتصرف البوت — شخصيته، لغته، أسلوبه
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleActivate} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isActive ? "حفظ التغييرات" : "تفعيل البوت"}
          </Button>

          {isActive && (
            <>
              <Button variant="outline" size="icon" onClick={handleClearHistory} title="مسح المحادثات">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="destructive" onClick={handleDeactivate} disabled={saving}>
                إيقاف
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
