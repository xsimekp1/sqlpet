'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Mail,
  Plus,
  Search,
  Loader2,
  Play,
  Pause,
  CheckCircle,
  FileText,
  Send,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ApiClient, { OutreachCampaign } from '@/app/lib/api';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Play }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  active: { label: 'Active', variant: 'default', icon: Play },
  paused: { label: 'Paused', variant: 'outline', icon: Pause },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle },
};

export default function OutreachCampaignsPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    subject_template: 'PawShelter pro {shelter_name}',
    body_template: '',
    from_email: 'info@pets-log.com',
    reply_to: '',
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: () => ApiClient.getOutreachCampaigns(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newCampaign) => ApiClient.createOutreachCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      setCreateDialogOpen(false);
      setNewCampaign({
        name: '',
        description: '',
        subject_template: 'PawShelter pro {shelter_name}',
        body_template: '',
        from_email: 'info@pets-log.com',
        reply_to: '',
      });
      toast.success('Kampaň vytvořena');
    },
    onError: () => {
      toast.error('Nepodařilo se vytvořit kampaň');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'active' | 'paused' | 'completed' }) =>
      ApiClient.updateCampaignStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      toast.success('Status aktualizován');
    },
    onError: () => {
      toast.error('Nepodařilo se změnit status');
    },
  });

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === 'active').length,
    totalSent: campaigns.reduce((sum, c) => sum + c.sent_count, 0),
    totalReplied: campaigns.reduce((sum, c) => sum + c.replied_count, 0),
  };

  const handleCreate = () => {
    if (!newCampaign.name || !newCampaign.subject_template) {
      toast.error('Vyplňte název a šablonu předmětu');
      return;
    }
    createMutation.mutate(newCampaign);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Outreach Campaigns</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Outreach Campaigns</h1>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nová kampaň
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celkem kampaní
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktivních
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Odesláno emailů
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{stats.totalSent}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Odpovědí
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold text-purple-600">{stats.totalReplied}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hledat kampaně..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Název</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Drafty</TableHead>
              <TableHead className="text-center">Schváleno</TableHead>
              <TableHead className="text-center">Odesláno</TableHead>
              <TableHead className="text-center">Odpovědi</TableHead>
              <TableHead>Vytvořeno</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Žádné kampaně
                </TableCell>
              </TableRow>
            ) : (
              filteredCampaigns.map((campaign) => {
                const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/superadmin/outreach/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {campaign.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{campaign.draft_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{campaign.approved_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{campaign.sent_count}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {campaign.replied_count > 0 ? (
                        <Badge className="bg-purple-500">{campaign.replied_count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(campaign.created_at).toLocaleDateString('cs-CZ')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/superadmin/outreach/${campaign.id}`}>
                              Zobrazit emaily
                            </Link>
                          </DropdownMenuItem>
                          {campaign.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: campaign.id, status: 'active' })}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Aktivovat
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: campaign.id, status: 'paused' })}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pozastavit
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'paused' && (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: campaign.id, status: 'active' })}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Obnovit
                            </DropdownMenuItem>
                          )}
                          {campaign.status !== 'completed' && (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: campaign.id, status: 'completed' })}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Dokončit
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nová outreach kampaň</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Název kampaně *</Label>
              <Input
                id="name"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="Q1 2024 - České útulky"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Textarea
                id="description"
                value={newCampaign.description}
                onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                placeholder="Interní poznámky ke kampani..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Šablona předmětu *</Label>
              <Input
                id="subject"
                value={newCampaign.subject_template}
                onChange={(e) => setNewCampaign({ ...newCampaign, subject_template: e.target.value })}
                placeholder="PawShelter pro {shelter_name}"
              />
              <p className="text-xs text-muted-foreground">
                Proměnné: {'{shelter_name}'}, {'{shelter_region}'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from_email">Od (email)</Label>
                <Input
                  id="from_email"
                  value={newCampaign.from_email}
                  onChange={(e) => setNewCampaign({ ...newCampaign, from_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reply_to">Reply-To</Label>
                <Input
                  id="reply_to"
                  value={newCampaign.reply_to}
                  onChange={(e) => setNewCampaign({ ...newCampaign, reply_to: e.target.value })}
                  placeholder="petr@pawshelter.cz"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vytvořit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
