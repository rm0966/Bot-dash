import { useState } from "react";
import { 
  useGetAutoReplies, getGetAutoRepliesQueryKey, 
  useGetAutoReplyStatus, getGetAutoReplyStatusQueryKey,
  useCreateAutoReply, useActivateAutoReply, useDeactivateAutoReply, 
  useToggleAutoReply, useDeleteAutoReply, AutoReply
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Zap, MessageSquareDashed, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

interface AutoReplyPanelProps {
  guildId: string;
  token: string;
}

export function AutoReplyPanel({ guildId, token }: AutoReplyPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: statusLoading } = useGetAutoReplyStatus(guildId, {
    query: {
      queryKey: getGetAutoReplyStatusQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const { data: rules, isLoading: rulesLoading } = useGetAutoReplies(guildId, {
    query: {
      queryKey: getGetAutoRepliesQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const activate = useActivateAutoReply();
  const deactivate = useDeactivateAutoReply();
  const createRule = useCreateAutoReply();
  const toggleRule = useToggleAutoReply();
  const deleteRule = useDeleteAutoReply();

  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");
  const [matchType, setMatchType] = useState("contains");

  const isActive = statusData?.active || false;

  const handleToggleActivation = () => {
    if (isActive) {
      deactivate.mutate(
        { guildId, data: { token } },
        {
          onSuccess: (res: any) => {
            if (res.success) {
              toast({ title: "Listener Deactivated", description: "Auto-reply listener is now off." });
              queryClient.invalidateQueries({ queryKey: getGetAutoReplyStatusQueryKey(guildId) });
            } else {
              toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
          },
          onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to deactivate listener.", variant: "destructive" })
        }
      );
    } else {
      activate.mutate(
        { guildId, data: { token } },
        {
          onSuccess: (res: any) => {
            if (res.success) {
              toast({ title: "Listener Activated", description: "Auto-reply listener is now active." });
              queryClient.invalidateQueries({ queryKey: getGetAutoReplyStatusQueryKey(guildId) });
            } else {
              toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
          },
          onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to activate listener.", variant: "destructive" })
        }
      );
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !response.trim()) return;

    createRule.mutate(
      { guildId, data: { token, trigger, response, matchType } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Rule Created", description: "Successfully created auto-reply rule." });
            queryClient.invalidateQueries({ queryKey: getGetAutoRepliesQueryKey(guildId) });
            setOpen(false);
            setTrigger("");
            setResponse("");
            setMatchType("contains");
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to create rule.", variant: "destructive" })
      }
    );
  };

  const handleToggleRule = (ruleId: number) => {
    toggleRule.mutate(
      { guildId, ruleId, data: { token } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Rule Toggled", description: "Successfully toggled auto-reply rule." });
            queryClient.invalidateQueries({ queryKey: getGetAutoRepliesQueryKey(guildId) });
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to toggle rule.", variant: "destructive" })
      }
    );
  };

  const handleDeleteRule = (ruleId: number) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    deleteRule.mutate(
      { guildId, ruleId, data: { token } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Rule Deleted", description: "Successfully deleted auto-reply rule." });
            queryClient.invalidateQueries({ queryKey: getGetAutoRepliesQueryKey(guildId) });
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => toast({ title: "Error", description: err.error || "Failed to delete rule.", variant: "destructive" })
      }
    );
  };

  const isPendingActivation = activate.isPending || deactivate.isPending;

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-5 border-b border-border bg-card/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Auto-Reply
            </h3>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-background border border-border text-sm font-medium">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-muted-foreground'}`} />
              {isActive ? 'Listener Active' : 'Listener Inactive'}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            When active, the bot listens for messages and replies automatically based on the rules below.
          </p>
        </div>
        <Button 
          variant={isActive ? "outline" : "default"} 
          onClick={handleToggleActivation}
          disabled={isPendingActivation || statusLoading}
        >
          {isPendingActivation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isActive ? 'Deactivate Listener' : 'Activate Listener'}
        </Button>
      </div>

      <div className="p-4 border-b border-border bg-card/30 flex justify-between items-center">
        <h4 className="font-medium">Rules</h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Auto-Reply Rule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Trigger Keyword/Phrase</Label>
                <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. hello" required />
              </div>
              <div className="space-y-2">
                <Label>Match Type</Label>
                <Select value={matchType} onValueChange={setMatchType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="exact">Exact Match</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Response</Label>
                <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="e.g. Hi there!" required rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={createRule.isPending}>Cancel</Button>
                <Button type="submit" disabled={createRule.isPending || !trigger.trim() || !response.trim()}>
                  {createRule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Rule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rulesLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : !rules || rules.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquareDashed className="h-12 w-12 mb-4 opacity-20" />
            <p>No rules yet. Add your first auto-reply rule.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-card/50 sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr>
                <th className="px-6 py-3 font-medium">Trigger</th>
                <th className="px-6 py-3 font-medium">Match Type</th>
                <th className="px-6 py-3 font-medium">Response</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule: AutoReply) => (
                <tr key={rule.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {rule.trigger}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={
                      rule.matchType === 'exact' ? 'destructive' : 
                      rule.matchType === 'startsWith' ? 'secondary' : 'default'
                    } className={rule.matchType === 'contains' ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}>
                      {rule.matchType}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={rule.response}>
                    {rule.response}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={rule.isActive} 
                        onCheckedChange={() => handleToggleRule(rule.id)}
                        disabled={toggleRule.isPending}
                      />
                      <span className="text-xs text-muted-foreground">
                        {rule.isActive ? 'On' : 'Off'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteRule(rule.id)} 
                      disabled={deleteRule.isPending}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
