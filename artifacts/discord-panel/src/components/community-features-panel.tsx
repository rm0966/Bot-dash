import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useGetChannels,
  getGetChannelsQueryKey,
} from "@workspace/api-client-react";
import {
  CalendarClock,
  Check,
  Hash,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Ticket,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type FeatureTab = "welcome" | "spam" | "announcements" | "tickets" | "audit";
type RepeatType = "once" | "daily" | "weekly";

interface FeatureSettings {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  leaveEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string;
  spamEnabled: boolean;
  spamMaxMessages: number;
  spamWindowSeconds: number;
  spamDuplicateLimit: number;
  spamBlockInvites: boolean;
  spamBlockLinks: boolean;
  spamTimeoutMinutes: number;
  ticketsEnabled: boolean;
  ticketPanelChannelId: string | null;
  ticketCategoryId: string | null;
  supportRoleId: string | null;
  transcriptChannelId: string | null;
  auditEnabled: boolean;
}

interface Announcement {
  id: number;
  channelId: string;
  content: string;
  repeatType: RepeatType;
  timeZone: string;
  nextRunAt: string;
  lastSentAt: string | null;
  lastError: string | null;
  isActive: boolean;
}

interface TicketItem {
  id: number;
  channelId: string;
  openerId: string;
  openerName: string;
  status: "open" | "closed";
  summary: string | null;
  createdAt: string;
  closedAt: string | null;
}

interface AuditItem {
  id: number;
  action: string;
  targetId: string | null;
  executorId: string | null;
  channelId: string | null;
  reason: string | null;
  details: string | null;
  occurredAt: string;
}

const defaultSettings: FeatureSettings = {
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: "أهلًا {user} بك في {server}!",
  leaveEnabled: false,
  leaveChannelId: null,
  leaveMessage: "غادر {user} السيرفر.",
  spamEnabled: false,
  spamMaxMessages: 5,
  spamWindowSeconds: 6,
  spamDuplicateLimit: 3,
  spamBlockInvites: true,
  spamBlockLinks: false,
  spamTimeoutMinutes: 10,
  ticketsEnabled: false,
  ticketPanelChannelId: null,
  ticketCategoryId: null,
  supportRoleId: null,
  transcriptChannelId: null,
  auditEnabled: false,
};

const tabs: Array<{ id: FeatureTab; label: string; icon: typeof UserRoundPlus }> = [
  { id: "welcome", label: "الترحيب والمغادرة", icon: UserRoundPlus },
  { id: "spam", label: "مكافحة السبام", icon: ShieldAlert },
  { id: "announcements", label: "الإعلانات المجدولة", icon: CalendarClock },
  { id: "tickets", label: "التذاكر", icon: Ticket },
  { id: "audit", label: "سجل الإجراءات", icon: ScrollText },
];

async function requestJson<T>(
  apiBase: string,
  guildId: string,
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Bot-Token", token);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${apiBase}/api/discord/guilds/${encodeURIComponent(guildId)}${path}`,
    { ...init, headers }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || "تعذّر تنفيذ الطلب");
  }
  return data as T;
}

function localDateTimeInOneHour(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString("ar-SA");
  }
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function CommunityFeaturesPanel({
  guildId,
  token,
}: {
  guildId: string;
  token: string;
}) {
  const { toast } = useToast();
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [activeTab, setActiveTab] = useState<FeatureTab>("welcome");
  const [settings, setSettings] = useState<FeatureSettings>(defaultSettings);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [announcementChannel, setAnnouncementChannel] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementType, setAnnouncementType] = useState<RepeatType>("once");
  const [announcementDate, setAnnouncementDate] = useState(localDateTimeInOneHour);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useGetChannels(guildId, {
    query: { queryKey: getGetChannelsQueryKey(guildId), enabled: !!guildId && !!token },
    request: { headers: { "X-Bot-Token": token } },
  });
  const textChannels = useMemo(() => channels?.filter((channel) => channel.type === 0) ?? [], [channels]);
  const categories = useMemo(() => channels?.filter((channel) => channel.type === 4) ?? [], [channels]);

  const loadFeatureData = useCallback(async () => {
    setListLoading(true);
    try {
      const [nextSettings, nextAnnouncements, nextTickets, nextAuditLogs] = await Promise.all([
        requestJson<FeatureSettings>(apiBase, guildId, token, "/community-features"),
        requestJson<Announcement[]>(apiBase, guildId, token, "/announcements"),
        requestJson<TicketItem[]>(apiBase, guildId, token, "/tickets"),
        requestJson<AuditItem[]>(apiBase, guildId, token, "/audit-logs"),
      ]);
      setSettings({ ...defaultSettings, ...nextSettings });
      setAnnouncements(nextAnnouncements);
      setTickets(nextTickets);
      setAuditLogs(nextAuditLogs);
    } catch (error) {
      toast({
        title: "تعذّر تحميل ميزات المجتمع",
        description: error instanceof Error ? error.message : "تحقق من رمز البوت واتصاله بالسيرفر.",
        variant: "destructive",
      });
    } finally {
      setListLoading(false);
      setLoading(false);
    }
  }, [apiBase, guildId, token, toast]);

  useEffect(() => {
    void loadFeatureData();
  }, [loadFeatureData]);

  const updateSetting = <K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const result = await requestJson<FeatureSettings & { ticketPanelWarning?: string | null }>(
        apiBase,
        guildId,
        token,
        "/community-features",
        {
          method: "PUT",
          body: JSON.stringify({ ...settings, token }),
        }
      );
      setSettings({ ...defaultSettings, ...result });
      toast({
        title: "تم حفظ الإعدادات",
        description: result.ticketPanelWarning ?? "تُطبّق الإعدادات على هذا السيرفر فقط.",
        ...(result.ticketPanelWarning ? { variant: "destructive" as const } : {}),
      });
    } catch (error) {
      toast({
        title: "تعذّر حفظ الإعدادات",
        description: error instanceof Error ? error.message : "حاول مجددًا.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!announcementChannel || !announcementDate || !announcementContent.trim()) return;
    setCreatingAnnouncement(true);
    try {
      await requestJson<Announcement>(apiBase, guildId, token, "/announcements", {
        method: "POST",
        body: JSON.stringify({
          token,
          channelId: announcementChannel,
          content: announcementContent.trim(),
          repeatType: announcementType,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh",
          nextRunAt: new Date(announcementDate).toISOString(),
        }),
      });
      setAnnouncementContent("");
      await loadFeatureData();
      toast({ title: "تمت جدولة الإعلان" });
    } catch (error) {
      toast({
        title: "تعذّرت جدولة الإعلان",
        description: error instanceof Error ? error.message : "تحقق من البيانات وحاول مجددًا.",
        variant: "destructive",
      });
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const cancelAnnouncement = async (announcementId: number) => {
    if (!window.confirm("هل تريد إلغاء هذا الإعلان؟")) return;
    try {
      await requestJson(apiBase, guildId, token, `/announcements/${announcementId}`, {
        method: "DELETE",
        body: JSON.stringify({ token }),
      });
      await loadFeatureData();
      toast({ title: "تم إلغاء الإعلان" });
    } catch (error) {
      toast({
        title: "تعذّر إلغاء الإعلان",
        description: error instanceof Error ? error.message : "حاول مجددًا.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const channelSelect = (
    value: string | null,
    onChange: (value: string | null) => void,
    placeholder = "اختر قناة نصية"
  ) => (
    <Select
      value={value ?? "none"}
      onValueChange={(next) => onChange(next === "none" ? null : next)}
      disabled={channelsLoading}
    >
      <SelectTrigger className="bg-background">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">غير محددة</SelectItem>
        {textChannels.map((channel) => (
          <SelectItem key={channel.id} value={channel.id}>
            <span className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {channel.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const currentTab = tabs.find((tab) => tab.id === activeTab)!;
  const CurrentIcon = currentTab.icon;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5">
            <CurrentIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">إدارة المجتمع</h2>
            <p className="text-sm text-muted-foreground">إعدادات مستقلة لكل سيرفر، والميزات الإشرافية متوقفة افتراضيًا.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadFeatureData()} disabled={listLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          {activeTab !== "announcements" && activeTab !== "audit" && (
            <Button size="sm" onClick={saveSettings} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              حفظ الإعدادات
            </Button>
          )}
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-2" role="tablist" aria-label="ميزات المجتمع">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`community-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`community-panel-${id}`}
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              activeTab === id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div
        id={`community-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`community-tab-${activeTab}`}
        className="space-y-4"
      >
        {activeTab === "welcome" && (
          <>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-100/90">
              رسائل الانضمام والمغادرة تحتاج إلى تفعيل <strong>Server Members Intent</strong> في إعدادات تطبيق البوت على Discord.
              استخدم المتغيرات: <code>{"{user}"}</code> و<code>{"{server}"}</code> و<code>{"{memberCount}"}</code>.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="رسالة الترحيب" description="تُرسل عند انضمام عضو جديد.">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="welcome-enabled">تفعيل الترحيب</Label>
                  <Switch
                    id="welcome-enabled"
                    checked={settings.welcomeEnabled}
                    onCheckedChange={(value) => updateSetting("welcomeEnabled", value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>القناة</Label>
                  {channelSelect(settings.welcomeChannelId, (value) => updateSetting("welcomeChannelId", value))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcome-message">نص الترحيب</Label>
                  <Textarea
                    id="welcome-message"
                    value={settings.welcomeMessage}
                    maxLength={2000}
                    onChange={(event) => updateSetting("welcomeMessage", event.target.value)}
                    className="min-h-24 bg-background"
                  />
                </div>
              </SectionCard>
              <SectionCard title="رسالة المغادرة" description="تُرسل عند مغادرة عضو للسيرفر.">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="leave-enabled">تفعيل رسالة المغادرة</Label>
                  <Switch
                    id="leave-enabled"
                    checked={settings.leaveEnabled}
                    onCheckedChange={(value) => updateSetting("leaveEnabled", value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>القناة</Label>
                  {channelSelect(settings.leaveChannelId, (value) => updateSetting("leaveChannelId", value))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-message">نص المغادرة</Label>
                  <Textarea
                    id="leave-message"
                    value={settings.leaveMessage}
                    maxLength={2000}
                    onChange={(event) => updateSetting("leaveMessage", event.target.value)}
                    className="min-h-24 bg-background"
                  />
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {activeTab === "spam" && (
          <>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100/90">
              عند التفعيل، يحذف البوت الرسائل المخالفة؛ تنبيه أولًا ثم إسكات مؤقت للمخالفات المتكررة. يبقى هذا الخيار متوقفًا حتى تفعّله وتحفظه.
            </div>
            <SectionCard title="قواعد مكافحة السبام">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div>
                  <Label htmlFor="spam-enabled">تفعيل مكافحة السبام</Label>
                  <p className="mt-1 text-xs text-muted-foreground">يتجاهل البوت والرتب التي لديها صلاحية إدارة الرسائل.</p>
                </div>
                <Switch
                  id="spam-enabled"
                  checked={settings.spamEnabled}
                  onCheckedChange={(value) => updateSetting("spamEnabled", value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="spam-max">الرسائل المسموحة</Label>
                  <Input id="spam-max" type="number" min={3} max={30} value={settings.spamMaxMessages} onChange={(e) => updateSetting("spamMaxMessages", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spam-window">خلال (ثوانٍ)</Label>
                  <Input id="spam-window" type="number" min={2} max={60} value={settings.spamWindowSeconds} onChange={(e) => updateSetting("spamWindowSeconds", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spam-duplicate">تكرار النص</Label>
                  <Input id="spam-duplicate" type="number" min={2} max={15} value={settings.spamDuplicateLimit} onChange={(e) => updateSetting("spamDuplicateLimit", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spam-timeout">الإسكات الأساسي (دقيقة)</Label>
                  <Input id="spam-timeout" type="number" min={1} max={10080} value={settings.spamTimeoutMinutes} onChange={(e) => updateSetting("spamTimeoutMinutes", Number(e.target.value))} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
                  منع روابط دعوات Discord
                  <Switch checked={settings.spamBlockInvites} onCheckedChange={(value) => updateSetting("spamBlockInvites", value)} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
                  منع الروابط عمومًا
                  <Switch checked={settings.spamBlockLinks} onCheckedChange={(value) => updateSetting("spamBlockLinks", value)} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">تتضاعف مدة الإسكات في المخالفات التالية، وتُعاد المخالفات إلى البداية بعد 30 يومًا.</p>
            </SectionCard>
          </>
        )}

        {activeTab === "announcements" && (
          <>
            <SectionCard title="إنشاء إعلان" description="اختر وقتًا محليًا؛ تحفظ المنطقة الزمنية تلقائيًا.">
              <form onSubmit={createAnnouncement} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>القناة</Label>
                    <Select value={announcementChannel} onValueChange={setAnnouncementChannel} disabled={channelsLoading}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="اختر قناة نصية" /></SelectTrigger>
                      <SelectContent>
                        {textChannels.map((channel) => <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>التكرار</Label>
                    <Select value={announcementType} onValueChange={(value) => setAnnouncementType(value as RepeatType)}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">مرة واحدة</SelectItem>
                        <SelectItem value="daily">يوميًا</SelectItem>
                        <SelectItem value="weekly">أسبوعيًا</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-date">موعد الإرسال</Label>
                  <Input
                    id="announcement-date"
                    type="datetime-local"
                    value={announcementDate}
                    onChange={(event) => setAnnouncementDate(event.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-content">نص الإعلان</Label>
                  <Textarea
                    id="announcement-content"
                    value={announcementContent}
                    onChange={(event) => setAnnouncementContent(event.target.value)}
                    maxLength={1900}
                    placeholder="اكتب نص الإعلان..."
                    className="min-h-24 bg-background"
                  />
                </div>
                <Button type="submit" disabled={creatingAnnouncement || !announcementChannel || !announcementContent.trim()}>
                  {creatingAnnouncement ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                  جدولة الإعلان
                </Button>
              </form>
            </SectionCard>
            <SectionCard title="الإعلانات المجدولة">
              {announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد إعلانات مجدولة.</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((announcement) => (
                    <div key={announcement.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>#{textChannels.find((channel) => channel.id === announcement.channelId)?.name ?? announcement.channelId}</span>
                          <span>·</span>
                          <span>{announcement.repeatType === "once" ? "مرة واحدة" : announcement.repeatType === "daily" ? "يوميًا" : "أسبوعيًا"}</span>
                          <span>·</span>
                          <span>{announcement.isActive ? formatDate(announcement.nextRunAt, announcement.timeZone) : "منتهٍ"}</span>
                        </div>
                        <p className="mt-1 break-words text-sm">{announcement.content}</p>
                        {announcement.lastError && <p className="mt-1 text-xs text-destructive">تعذّر الإرسال: {announcement.lastError}</p>}
                      </div>
                      {announcement.isActive && (
                        <Button variant="outline" size="sm" onClick={() => void cancelAnnouncement(announcement.id)}>إلغاء</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeTab === "tickets" && (
          <>
            <SectionCard title="إعداد نظام التذاكر" description="عند الحفظ، ينشر البوت لوحة زر لفتح قناة خاصة. يحتاج صلاحية إنشاء القنوات وإدارة الصلاحيات.">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label htmlFor="tickets-enabled">تفعيل التذاكر</Label>
                <Switch id="tickets-enabled" checked={settings.ticketsEnabled} onCheckedChange={(value) => updateSetting("ticketsEnabled", value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>قناة لوحة فتح التذاكر</Label>
                  {channelSelect(settings.ticketPanelChannelId, (value) => updateSetting("ticketPanelChannelId", value))}
                </div>
                <div className="space-y-2">
                  <Label>تصنيف قنوات التذاكر (اختياري)</Label>
                  <Select
                    value={settings.ticketCategoryId ?? "none"}
                    onValueChange={(value) => updateSetting("ticketCategoryId", value === "none" ? null : value)}
                  >
                    <SelectTrigger className="bg-background"><SelectValue placeholder="بدون تصنيف" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون تصنيف</SelectItem>
                      {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-role">معرّف رتبة الدعم (اختياري)</Label>
                  <Input
                    id="support-role"
                    value={settings.supportRoleId ?? ""}
                    onChange={(event) => updateSetting("supportRoleId", event.target.value || null)}
                    placeholder="Discord role ID"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>قناة ملخصات التذاكر (اختياري)</Label>
                  {channelSelect(settings.transcriptChannelId, (value) => updateSetting("transcriptChannelId", value))}
                </div>
              </div>
            </SectionCard>
            <SectionCard title="سجل التذاكر">
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد تذاكر حتى الآن. يغلق العضو أو فريق الدعم التذكرة من داخل قناتها.</p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <details key={ticket.id} className="rounded-lg border border-border/60 p-3">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium">تذكرة #{ticket.id}</span>
                        <span>{ticket.openerName}</span>
                        <span className={ticket.status === "open" ? "text-emerald-400" : "text-muted-foreground"}>
                          {ticket.status === "open" ? "مفتوحة" : "مغلقة"}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</span>
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground">القناة: <code>{ticket.channelId}</code> · العضو: <code>{ticket.openerId}</code></p>
                      {ticket.summary && <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-xs">{ticket.summary}</pre>}
                    </details>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeTab === "audit" && (
          <>
            <SectionCard title="سجل إجراءات الإشراف" description="يسجل الحظر والطرد وحذف الرسائل عند وصول أحداث سجل تدقيق Discord.">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="audit-enabled">تفعيل سجل الإجراءات</Label>
                  <p className="mt-1 text-xs text-muted-foreground">يحتاج البوت إلى صلاحية View Audit Log.</p>
                </div>
                <Switch id="audit-enabled" checked={settings.auditEnabled} onCheckedChange={(value) => updateSetting("auditEnabled", value)} />
              </div>
              <Button size="sm" onClick={saveSettings} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                حفظ إعداد السجل
              </Button>
            </SectionCard>
            <SectionCard title="أحدث الإجراءات">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد إجراءات محفوظة. فعّل السجل أعلاه وانتظر أحداث الإشراف الجديدة.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 font-medium">الإجراء</th>
                        <th className="px-2 py-2 font-medium">المنفذ</th>
                        <th className="px-2 py-2 font-medium">المستهدف</th>
                        <th className="px-2 py-2 font-medium">السبب</th>
                        <th className="px-2 py-2 font-medium">الوقت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="px-2 py-3">{entry.action}</td>
                          <td className="px-2 py-3 font-mono text-xs">{entry.executorId ?? "غير معروف"}</td>
                          <td className="px-2 py-3 font-mono text-xs">{entry.targetId ?? "—"}</td>
                          <td className="max-w-52 truncate px-2 py-3 text-muted-foreground">{entry.reason ?? "—"}</td>
                          <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">{formatDate(entry.occurredAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
