import { useState } from "react";
import { useBot } from "@/hooks/use-bot";
import { Redirect, useRoute } from "wouter";
import { useGetChannels, getGetChannelsQueryKey, useGetMembers, getGetMembersQueryKey } from "@workspace/api-client-react";
import {
  LayoutDashboard, MessageSquare, Image as ImageIcon, ListTree,
  Shield, Users, ShieldBan, Smile, Link2, Trash2, Zap, ChevronLeft, Loader2, Menu, X
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

type NavSection =
  | "overview" | "message" | "image" | "channels"
  | "roles" | "members" | "bans" | "emojis"
  | "invites" | "purge" | "autoreply";

const navItems: { id: NavSection; label: string; icon: React.ElementType; color?: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "message", label: "Send Message", icon: MessageSquare },
  { id: "image", label: "Send Image", icon: ImageIcon },
  { id: "channels", label: "Channels", icon: ListTree },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "members", label: "Members", icon: Users },
  { id: "bans", label: "Bans", icon: ShieldBan, color: "text-destructive" },
  { id: "emojis", label: "Emojis", icon: Smile },
  { id: "invites", label: "Invites", icon: Link2 },
  { id: "purge", label: "Purge Messages", icon: Trash2, color: "text-destructive" },
  { id: "autoreply", label: "Auto-Reply", icon: Zap },
];

const sectionTitles: Record<NavSection, string> = {
  overview: "Server Overview",
  message: "Send Message",
  image: "Send Image",
  channels: "Manage Channels",
  roles: "Server Roles",
  members: "Members",
  bans: "Banned Members",
  emojis: "Server Emojis",
  invites: "Create Invite",
  purge: "Purge Messages",
  autoreply: "Auto-Reply",
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
    if (active === "overview") return <OverviewPanel guildId={guildId} token={token} />;
    if (active === "message") return <MessagePanel channels={textChannels} token={token} type="text" />;
    if (active === "image") return <MessagePanel channels={textChannels} token={token} type="image" />;
    if (active === "channels") return <ChannelPanel guildId={guildId} token={token} channels={channels || []} />;
    if (active === "roles") return <RolePanel guildId={guildId} token={token} />;
    if (active === "members") {
      if (membersLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
      return <ModerationPanel guildId={guildId} members={members || []} token={token} />;
    }
    if (active === "bans") return <BanPanel guildId={guildId} token={token} />;
    if (active === "emojis") return <EmojiPanel guildId={guildId} token={token} />;
    if (active === "invites") return <InvitePanel guildId={guildId} token={token} />;
    if (active === "purge") return <PurgePanel guildId={guildId} token={token} />;
    if (active === "autoreply") return <AutoReplyPanel guildId={guildId} token={token} />;
    return null;
  };

  const handleNav = (id: NavSection) => {
    setActive(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-56 z-30 flex flex-col
        bg-sidebar border-r border-sidebar-border
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:top-0 lg:translate-x-0 lg:z-auto lg:h-auto lg:flex-shrink-0
      `}>
        <div className="p-3 border-b border-sidebar-border">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2 text-xs gap-2">
              <ChevronLeft className="h-3.5 w-3.5" />
              All Servers
            </Button>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon, color }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
                  ${isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : `text-muted-foreground hover:text-foreground hover:bg-sidebar-accent ${color || ""}`
                  }
                `}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : color || ""}`} />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="h-12 border-b border-border bg-card/30 flex items-center px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold text-sm">{sectionTitles[active]}</h2>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto bg-card">
          {channelsLoading && (active === "message" || active === "image") ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </div>
  );
}
