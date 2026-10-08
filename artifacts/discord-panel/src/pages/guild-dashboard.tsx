import { useState } from "react";
import { useBot } from "@/hooks/use-bot";
import { Redirect, useRoute } from "wouter";
import { useGetChannels, getGetChannelsQueryKey, useGetMembers, getGetMembersQueryKey } from "@workspace/api-client-react";
import {
  LayoutDashboard, MessageSquare, Image as ImageIcon, ListTree,
  Shield, Users, ShieldBan, Smile, Link2, Trash2, Zap, Megaphone,
  Sparkles, FileText, ChevronLeft, Loader2, Menu
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessagePanel } from "@/components/message-panel";
import { ModerationPanel } from "@/components/moderation-panel";
import { RolePanel } from "@/components/role-panel";
import { BanPanel } from "@/components/ban-panel";
import { ChannelPanel } from "@/components/channel-panel";
import { AutoReplyPanel } from "@/components/auto-reply-panel";
import { OverviewPanel } from "@/components/overview-panel";
import { EmojiPanel } from "@/components/emoji-panel";
import { InvitePanel } from "@/components/invite-panel";
import { PurgePanel } from "@/components/purge-panel";
import { BroadcastPanel } from "@/components/broadcast-panel";
import { AiPanel } from "@/components/ai-panel";
import { TemplatesPanel } from "@/components/templates-panel";
import { CommunityFeaturesPanel } from "@/components/community-features-panel";

type NavSection =
  | "overview" | "ai" | "broadcast" | "templates"
  | "community"
  | "message" | "image" | "channels"
  | "roles" | "members" | "bans" | "emojis"
  | "invites" | "purge" | "autoreply";

const navItems: { id: NavSection; label: string; icon: React.ElementType; color?: string; group?: string }[] = [
  { id: "overview",   label: "نظرة عامة",    icon: LayoutDashboard, group: "عام" },
  { id: "ai",         label: "ذكاء اصطناعي", icon: Sparkles,        group: "عام", color: "text-violet-400" },
  { id: "broadcast",  label: "إعلان جماعي",  icon: Megaphone,       group: "عام", color: "text-orange-400" },
  { id: "templates",  label: "قوالب جاهزة",  icon: FileText,        group: "عام" },
  { id: "community",  label: "ميزات المجتمع", icon: MessageSquare,  group: "المجتمع", color: "text-sky-400" },
  { id: "message",    label: "إرسال رسالة",  icon: MessageSquare,   group: "قنوات" },
  { id: "image",      label: "إرسال صورة",   icon: ImageIcon,       group: "قنوات" },
  { id: "channels",   label: "القنوات",      icon: ListTree,        group: "قنوات" },
  { id: "roles",      label: "الرتب",        icon: Shield,          group: "إدارة" },
  { id: "members",    label: "الأعضاء",      icon: Users,           group: "إدارة" },
  { id: "bans",       label: "المحظورون",    icon: ShieldBan,       group: "إدارة", color: "text-destructive" },
  { id: "emojis",     label: "الإيموجي",     icon: Smile,           group: "أدوات" },
  { id: "invites",    label: "دعوة",         icon: Link2,           group: "أدوات" },
  { id: "purge",      label: "حذف رسائل",   icon: Trash2,          group: "أدوات", color: "text-destructive" },
  { id: "autoreply",  label: "رد تلقائي",   icon: Zap,             group: "أدوات" },
];

const groups = ["عام", "قنوات", "إدارة", "المجتمع", "أدوات"];

const sectionTitles: Record<NavSection, string> = {
  overview:  "نظرة عامة",
  ai:        "الذكاء الاصطناعي",
  broadcast: "إعلان جماعي",
  templates: "قوالب جاهزة",
  community: "ميزات المجتمع",
  message:   "إرسال رسالة",
  image:     "إرسال صورة",
  channels:  "القنوات",
  roles:     "الرتب",
  members:   "الأعضاء",
  bans:      "المحظورون",
  emojis:    "الإيموجي",
  invites:   "دعوة",
  purge:     "حذف رسائل",
  autoreply: "رد تلقائي",
};

export default function GuildDashboard() {
  const { token } = useBot();
  const [, params] = useRoute("/guild/:guildId");
  const guildId = params?.guildId;
  if (!token) return <Redirect href="/" />;
  if (!guildId) return <Redirect href="/" />;
  return <DashboardContent guildId={guildId} token={token} />;
}

function DashboardContent({ guildId, token }: { guildId: string; token: string }) {
  const [active, setActive] = useState<NavSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useGetChannels(guildId, {
    query: { queryKey: getGetChannelsQueryKey(guildId), enabled: !!guildId && !!token },
    request: { headers: { "X-Bot-Token": token } }
  });

  const { data: members, isLoading: membersLoading } = useGetMembers(guildId, {
    query: { queryKey: getGetMembersQueryKey(guildId), enabled: !!guildId && !!token },
    request: { headers: { "X-Bot-Token": token } }
  });

  const textChannels = channels?.filter(c => c.type === 0) || [];

  const renderContent = () => {
    if (active === "overview")  return <OverviewPanel guildId={guildId} token={token} />;
    if (active === "ai")        return <AiPanel guildId={guildId} token={token} />;
    if (active === "broadcast") return <BroadcastPanel guildId={guildId} token={token} />;
    if (active === "templates") return <TemplatesPanel guildId={guildId} token={token} />;
    if (active === "community") return <CommunityFeaturesPanel guildId={guildId} token={token} />;
    if (active === "message")   return <MessagePanel channels={textChannels} token={token} type="text" />;
    if (active === "image")     return <MessagePanel channels={textChannels} token={token} type="image" />;
    if (active === "channels")  return <ChannelPanel guildId={guildId} token={token} channels={channels || []} />;
    if (active === "roles")     return <RolePanel guildId={guildId} token={token} />;
    if (active === "members") {
      if (membersLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
      return <ModerationPanel guildId={guildId} members={members || []} token={token} />;
    }
    if (active === "bans")      return <BanPanel guildId={guildId} token={token} />;
    if (active === "emojis")    return <EmojiPanel guildId={guildId} token={token} />;
    if (active === "invites")   return <InvitePanel guildId={guildId} token={token} />;
    if (active === "purge")     return <PurgePanel guildId={guildId} token={token} />;
    if (active === "autoreply") return <AutoReplyPanel guildId={guildId} token={token} />;
    return null;
  };

  const handleNav = (id: NavSection) => { setActive(id); setSidebarOpen(false); };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-52 z-30 flex flex-col
        bg-sidebar border-r border-sidebar-border
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:top-0 lg:translate-x-0 lg:z-auto lg:h-auto lg:flex-shrink-0
      `}>
        <div className="p-2.5 border-b border-sidebar-border">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2 text-xs gap-2">
              <ChevronLeft className="h-3.5 w-3.5" />
              كل السيرفرات
            </Button>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {groups.map((group) => {
            const items = navItems.filter(n => n.group === group);
            return (
              <div key={group} className="mb-3">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ id, label, icon: Icon, color }) => {
                    const isActive = active === id;
                    return (
                      <button
                        key={id}
                        onClick={() => handleNav(id)}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
                          ${isActive
                            ? "bg-primary/15 text-primary border border-primary/20"
                            : `text-muted-foreground hover:text-foreground hover:bg-sidebar-accent`
                          }
                        `}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : color || "text-muted-foreground"}`} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-12 border-b border-border bg-card/30 flex items-center px-4 gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold text-sm">{sectionTitles[active]}</h2>
        </div>

        <div className="flex-1 overflow-y-auto bg-card">
          {channelsLoading && (active === "message" || active === "image") ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : renderContent()}
        </div>
      </div>
    </div>
  );
}
