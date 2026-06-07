import { useBot } from "@/hooks/use-bot";
import { Redirect, useRoute } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetChannels, getGetChannelsQueryKey, useGetMembers, getGetMembersQueryKey } from "@workspace/api-client-react";
import { Loader2, MessageSquare, Shield, Image as ImageIcon, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessagePanel } from "@/components/message-panel";
import { ModerationPanel } from "@/components/moderation-panel";

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
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6 flex items-center">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Servers
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="message" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-card/50">
          <TabsTrigger value="message" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Message
          </TabsTrigger>
          <TabsTrigger value="image" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ImageIcon className="h-4 w-4 mr-2" />
            Send Image
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="h-4 w-4 mr-2" />
            Moderation
          </TabsTrigger>
        </TabsList>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <TabsContent value="message" className="m-0 border-0 outline-none">
            <MessagePanel channels={textChannels} token={token} type="text" />
          </TabsContent>
          <TabsContent value="image" className="m-0 border-0 outline-none">
            <MessagePanel channels={textChannels} token={token} type="image" />
          </TabsContent>
          <TabsContent value="members" className="m-0 border-0 outline-none">
            <ModerationPanel guildId={guildId} members={members || []} token={token} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
