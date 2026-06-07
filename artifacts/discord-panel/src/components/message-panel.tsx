import { useState } from "react";
import { Channel, useSendMessage, useSendImage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Hash, Send } from "lucide-react";

interface MessagePanelProps {
  channels: Channel[];
  token: string;
  type: "text" | "image";
}

export function MessagePanel({ channels, token, type }: MessagePanelProps) {
  const [channelId, setChannelId] = useState<string>("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const { toast } = useToast();

  const sendMsgMutation = useSendMessage();
  const sendImgMutation = useSendImage();

  const isPending = sendMsgMutation.isPending || sendImgMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!channelId) {
      toast({ title: "Error", description: "Please select a channel", variant: "destructive" });
      return;
    }

    if (type === "text") {
      if (!content.trim()) return;
      sendMsgMutation.mutate(
        { data: { token, channelId, content } },
        {
          onSuccess: (res) => {
            if (res.success) {
              toast({ title: "Message Sent", description: "Successfully sent message to channel" });
              setContent("");
            } else {
              toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
          },
          onError: (err) => {
            toast({ title: "Error", description: err.error, variant: "destructive" });
          }
        }
      );
    } else {
      if (!imageUrl.trim()) return;
      sendImgMutation.mutate(
        { data: { token, channelId, imageUrl, caption: content || null } },
        {
          onSuccess: (res) => {
            if (res.success) {
              toast({ title: "Image Sent", description: "Successfully sent image to channel" });
              setImageUrl("");
              setContent("");
            } else {
              toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
          },
          onError: (err) => {
            toast({ title: "Error", description: err.error, variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="space-y-3">
        <Label>Target Channel</Label>
        <Select value={channelId} onValueChange={setChannelId}>
          <SelectTrigger className="w-full md:max-w-md bg-background">
            <SelectValue placeholder="Select a text channel..." />
          </SelectTrigger>
          <SelectContent>
            {channels.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center">
                  <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                  {c.name}
                </div>
              </SelectItem>
            ))}
            {channels.length === 0 && (
              <SelectItem value="none" disabled>No text channels available</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {type === "image" && (
        <div className="space-y-3">
          <Label>Image URL</Label>
          <Input 
            value={imageUrl} 
            onChange={(e) => setImageUrl(e.target.value)} 
            placeholder="https://example.com/image.png"
            className="bg-background font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-3">
        <Label>{type === "image" ? "Caption (Optional)" : "Message Content"}</Label>
        <Textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "image" ? "Add a message with your image..." : "Type your message here..."}
          className="min-h-[150px] bg-background resize-y"
        />
      </div>

      <div className="pt-4 border-t border-border flex justify-end">
        <Button 
          type="submit" 
          disabled={isPending || !channelId || (type === "text" ? !content.trim() : !imageUrl.trim())}
          className="w-full md:w-auto"
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Deliver Payload
        </Button>
      </div>
    </form>
  );
}
