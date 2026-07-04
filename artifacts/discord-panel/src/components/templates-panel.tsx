import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSendMessage } from "@workspace/api-client-react";
import { useGetChannels, getGetChannelsQueryKey } from "@workspace/api-client-react";
import {
  FileText, Send, ChevronRight, Hash, Loader2, Edit3, X, CheckCircle2
} from "lucide-react";

interface TemplatesPanelProps {
  guildId: string;
  token: string;
}

interface Template {
  id: string;
  title: string;
  emoji: string;
  category: string;
  content: string;
}

const TEMPLATES: Template[] = [
  {
    id: "admin-app",
    title: "طلب انضمام إداري",
    emoji: "👑",
    category: "تقديمات",
    content:
      `**📋 | نموذج التقديم على منصب إداري**

━━━━━━━━━━━━━━━━━━━━━━━━━━
**الاسم في الديسكورد:**
**العمر:**
**التوقيت الزمني:**
**ساعات التواجد اليومي:**
**هل سبق وعملت إداريًا؟:** نعم / لا
**لماذا تريد الانضمام للفريق؟:**
**ماذا يمكنك تقديمه للسيرفر؟:**
━━━━━━━━━━━━━━━━━━━━━━━━━━

> 📌 سيتم مراجعة طلبك والرد عليك في أقرب وقت.`,
  },
  {
    id: "mediator-app",
    title: "طلب انضمام وسيط",
    emoji: "🕊️",
    category: "تقديمات",
    content:
      `**🕊️ | نموذج التقديم على منصب وسيط**

━━━━━━━━━━━━━━━━━━━━━━━━━━
**الاسم في الديسكورد:**
**العمر:**
**خبرتك في الوساطة:**
**هل لديك خبرة في حل النزاعات؟:** نعم / لا
**اشرح كيف ستتعامل مع خلاف بين عضوين:**
**لماذا تريد أن تكون وسيطًا؟:**
━━━━━━━━━━━━━━━━━━━━━━━━━━

> 📌 يُشترط الحياد التام وعدم التحيز في جميع الحالات.`,
  },
  {
    id: "moderator-app",
    title: "طلب انضمام مشرف",
    emoji: "🛡️",
    category: "تقديمات",
    content:
      `**🛡️ | نموذج التقديم على منصب مشرف**

━━━━━━━━━━━━━━━━━━━━━━━━━━
**الاسم في الديسكورد:**
**العمر:**
**التوقيت الزمني:**
**ساعات تواجدك:**
**خبرتك في الإشراف:**
**كيف ستتعامل مع مخالف؟:**
**ما الذي يميزك عن غيرك؟:**
━━━━━━━━━━━━━━━━━━━━━━━━━━

> 📌 يُقيَّم التقديم خلال 48 ساعة.`,
  },
  {
    id: "giveaway",
    title: "مسابقة / هبة",
    emoji: "🎁",
    category: "فعاليات",
    content:
      `🎁 **| مسابقة |** 🎁

━━━━━━━━━━━━━━━━━━━━━━━━━━
**الجائزة:** 
**عدد الفائزين:** 
**طريقة المشاركة:** تفاعل بـ 🎉 على هذه الرسالة
**موعد السحب:** 
━━━━━━━━━━━━━━━━━━━━━━━━━━

🍀 حظ موفق للجميع!`,
  },
  {
    id: "welcome",
    title: "رسالة ترحيب",
    emoji: "👋",
    category: "عام",
    content:
      `👋 **مرحبًا بك في السيرفر!**

━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 يسعدنا انضمامك إلى عائلتنا!

📜 تأكد من قراءة القوانين في قناة #القوانين
🎭 اختر رتبتك من قناة #الرتب
💬 ابدأ بالتعارف في قناة #العام
━━━━━━━━━━━━━━━━━━━━━━━━━━

> 🔔 إذا احتجت أي مساعدة، تواصل مع الفريق الإداري.`,
  },
  {
    id: "rules",
    title: "قوانين السيرفر",
    emoji: "📜",
    category: "عام",
    content:
      `📜 **| قوانين السيرفر |**

━━━━━━━━━━━━━━━━━━━━━━━━━━
**1️⃣** احترام جميع الأعضاء بدون استثناء.
**2️⃣** ممنوع السب والشتم بجميع أشكاله.
**3️⃣** ممنوع الإعلان عن أي سيرفر بدون إذن.
**4️⃣** ممنوع إرسال روابط ضارة أو محتوى مسيء.
**5️⃣** احترام قرارات الإدارة وعدم الجدال معها.
**6️⃣** ممنوع مضايقة الأعضاء في الخاص.
━━━━━━━━━━━━━━━━━━━━━━━━━━

> ⚠️ مخالفة القوانين تؤدي إلى عقوبات تبدأ بالإنذار وقد تصل للحظر.`,
  },
  {
    id: "announcement",
    title: "إعلان عام",
    emoji: "📢",
    category: "عام",
    content:
      `📢 **| إعلان |**

━━━━━━━━━━━━━━━━━━━━━━━━━━
@everyone

[اكتب تفاصيل الإعلان هنا]

━━━━━━━━━━━━━━━━━━━━━━━━━━
> 📌 للاستفسار تواصل مع الإدارة.`,
  },
  {
    id: "partner",
    title: "شراكة سيرفر",
    emoji: "🤝",
    category: "عام",
    content:
      `🤝 **| شراكة جديدة |**

━━━━━━━━━━━━━━━━━━━━━━━━━━
**اسم السيرفر:** 
**وصفه:** 
**رابط الانضمام:** 

━━━━━━━━━━━━━━━━━━━━━━━━━━
> للشراكة معنا تواصل مع الإدارة.`,
  },
];

const CATEGORIES = [...new Set(TEMPLATES.map((t) => t.category))];

export function TemplatesPanel({ guildId, token }: TemplatesPanelProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendMsg = useSendMessage();

  const { data: channels } = useGetChannels(guildId, {
    query: { queryKey: getGetChannelsQueryKey(guildId) },
    request: { headers: { "X-Bot-Token": token } },
  });
  const textChannels = channels?.filter((c) => c.type === 0) || [];

  const filtered = selectedCategory
    ? TEMPLATES.filter((t) => t.category === selectedCategory)
    : TEMPLATES;

  const handleSelect = (tpl: Template) => {
    setEditing(tpl);
    setEditContent(tpl.content);
    setSent(false);
  };

  const handleSend = () => {
    if (!selectedChannel || !editContent.trim()) return;
    setSending(true);
    sendMsg.mutate(
      { data: { token, channelId: selectedChannel, content: editContent } },
      {
        onSuccess: () => {
          toast({ title: "تم الإرسال ✅", description: "تم إرسال القالب بنجاح" });
          setSent(true);
          setSending(false);
        },
        onError: (err: any) => {
          toast({ title: "خطأ", description: err.error || "فشل الإرسال", variant: "destructive" });
          setSending(false);
        },
      }
    );
  };

  if (editing) {
    return (
      <div className="p-6 space-y-5 max-w-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEditing(null); setSent(false); }}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">{editing.emoji}</span>
            <h3 className="font-semibold text-base">{editing.title}</h3>
          </div>
        </div>

        <div className="space-y-2">
          <Label>تعديل المحتوى</Label>
          <Textarea
            value={editContent}
            onChange={(e) => { setEditContent(e.target.value); setSent(false); }}
            className="bg-background min-h-[260px] resize-y text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">{editContent.length}/2000</p>
        </div>

        <div className="space-y-2">
          <Label>إرسال إلى قناة</Label>
          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
            {textChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannel(ch.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left border ${
                  selectedChannel === ch.id
                    ? "bg-primary/15 text-primary border-primary/20"
                    : "border-border hover:bg-muted/30 text-muted-foreground"
                }`}
              >
                <Hash className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        </div>

        {sent ? (
          <div className="flex items-center gap-2 p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <p className="text-sm text-green-300">تم إرسال القالب بنجاح!</p>
          </div>
        ) : (
          <Button
            onClick={handleSend}
            disabled={!selectedChannel || !editContent.trim() || sending || editContent.length > 2000}
            className="w-full"
          >
            {sending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Send className="mr-2 h-4 w-4" />}
            إرسال القالب
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">قوالب جاهزة</h3>
          <p className="text-sm text-muted-foreground">اختر قالبًا وعدّله وأرسله مباشرة</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            !selectedCategory
              ? "bg-primary/15 text-primary border-primary/20"
              : "border-border text-muted-foreground hover:bg-muted/30"
          }`}
        >
          الكل
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              selectedCategory === cat
                ? "bg-primary/15 text-primary border-primary/20"
                : "border-border text-muted-foreground hover:bg-muted/30"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleSelect(tpl)}
            className="group flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-card/60 transition-all text-left"
          >
            <span className="text-2xl shrink-0">{tpl.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {tpl.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{tpl.category}</p>
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed font-mono opacity-70">
                {tpl.content.split("\n").find(l => l.trim() && !l.startsWith("*") && !l.startsWith("━") && !l.startsWith(">")) || tpl.content.slice(0, 60)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0 mt-1" />
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        اضغط على أي قالب لمعاينته وتعديله قبل الإرسال
      </p>
    </div>
  );
}
