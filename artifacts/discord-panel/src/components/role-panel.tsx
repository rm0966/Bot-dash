import { useState } from "react";
import { useGetRoles, getGetRolesQueryKey, useCreateRole, useDeleteRole, Role } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";

interface RolePanelProps {
  guildId: string;
  token: string;
}

export function RolePanel({ guildId, token }: RolePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useGetRoles(guildId, {
    query: {
      queryKey: getGetRolesQueryKey(guildId),
      enabled: !!guildId && !!token,
    },
    request: { headers: { "X-Bot-Token": token } }
  });

  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#000000");
  const [mentionable, setMentionable] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Convert hex to integer
    const colorInt = parseInt(color.replace("#", ""), 16);

    createRole.mutate(
      { guildId, data: { token, name, color: colorInt, mentionable } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Role Created", description: "Successfully created role" });
            queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey(guildId) });
            setOpen(false);
            setName("");
            setColor("#000000");
            setMentionable(false);
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to create role", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    deleteRole.mutate(
      { guildId, roleId, data: { token } },
      {
        onSuccess: (res: any) => {
          if (res.success) {
            toast({ title: "Role Deleted", description: "Successfully deleted role" });
            queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey(guildId) });
          } else {
            toast({ title: "Failed", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to delete role", variant: "destructive" });
        }
      }
    );
  };

  const sortedRoles = roles ? [...roles].sort((a, b) => b.position - a.position) : [];

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-4 border-b border-border bg-card/50 flex justify-between items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Server Roles
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Role Color</Label>
                <div className="flex gap-3">
                  <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#000000" className="flex-1 font-mono" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <Label>Mentionable</Label>
                <Switch checked={mentionable} onCheckedChange={setMentionable} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={createRole.isPending}>Cancel</Button>
                <Button type="submit" disabled={createRole.isPending || !name.trim()}>
                  {createRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Role
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : sortedRoles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No roles found.</div>
        ) : (
          <div className="grid gap-2">
            {sortedRoles.map((role) => {
              const hexColor = role.color === 0 ? null : '#' + role.color.toString(16).padStart(6, '0');
              return (
                <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: hexColor || '#6b7280' }} />
                    <span className="font-medium text-sm">{role.name}</span>
                    {role.managed && <Badge variant="secondary" className="text-[10px]">Managed</Badge>}
                    {role.mentionable && <Badge variant="outline" className="text-[10px]">Mentionable</Badge>}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(role.id)} 
                    disabled={role.managed || deleteRole.isPending}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
