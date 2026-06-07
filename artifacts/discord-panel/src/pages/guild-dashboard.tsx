import { useBot } from "@/hooks/use-bot";
import { Redirect, useRoute } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetChannels, getGetChannelsQueryKey, useGetMembers, getGetMembersQueryKey } from "@workspace/api-client-react";
import { Loader2, MessageSquare, Shield, Image as ImageIcon, ChevronLeft, ListTree, ShieldAlert, ShieldBan } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessagePanel } from "@/components/message-panel";
import { ModerationPanel } from "@/components/moderation-panel";
import { RolePanel } from "@/components/role-panel";
import { BanPanel } from "@/components/ban-panel";
import { ChannelPanel } from "@/components/channel-panel";

export default function GuildDashboard() {
  const { token } = useBot();
  const [, params] = useRoute("/guild/:guildId");
  const guildId = params?.guildId;

  if (!token) return <Redirect href="/" />;
  if (!guildId) return <Redirect href="/" />;

  return <DashboardContent guildId={guildId} token={token} />;
}

function DashboardContent({ guildId, token }: { guildId: string; token: string }) {
  const { data: channels, isLoading: channelsLoading } = useGetChannels(guildId, {
    query: {
      queryKey: getGetChannelsQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const { data: members, isLoading: membersLoading } = useGetMembers(guildId, {
    query: {
      queryKey: getGetMembersQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const textChannels = channels?.filter(c => c.type === 0) || [];

  if (channelsLoading || membersLoading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1200px]">
      <div className="mb-6 flex items-center">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Servers
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="message" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8 bg-transparent border-b border-border h-auto gap-0 p-0 rounded-none">
          <TabsTrigger value="message" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 data-[state=active]:shadow-none">
            <MessageSquare className="h-4 w-4 mr-2" />
            Msg
          </TabsTrigger>
          <TabsTrigger value="image" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 data-[state=active]:shadow-none">
            <ImageIcon className="h-4 w-4 mr-2" />
            Img
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 data-[state=active]:shadow-none">
            <ListTree className="h-4 w-4 mr-2" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 data-[state=active]:shadow-none">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 data-[state=active]:shadow-none">
            <Shield className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="bans" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 data-[state=active]:shadow-none">
            <ShieldBan className="h-4 w-4 mr-2" />
            Bans
          </TabsTrigger>
        </TabsList>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <TabsContent value="message" className="m-0 border-0 outline-none">
            <MessagePanel channels={textChannels} token={token} type="text" />
          </TabsContent>
          <TabsContent value="image" className="m-0 border-0 outline-none">
            <MessagePanel channels={textChannels} token={token} type="image" />
          </TabsContent>
          <TabsContent value="channels" className="m-0 border-0 outline-none">
            <ChannelPanel guildId={guildId} token={token} channels={channels || []} />
          </TabsContent>
          <TabsContent value="roles" className="m-0 border-0 outline-none">
            <RolePanel guildId={guildId} token={token} />
          </TabsContent>
          <TabsContent value="members" className="m-0 border-0 outline-none">
            <ModerationPanel guildId={guildId} members={members || []} token={token} />
          </TabsContent>
          <TabsContent value="bans" className="m-0 border-0 outline-none">
            <BanPanel guildId={guildId} token={token} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
