'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Mail,
  ArrowLeft,
  Loader2,
  Check,
  X,
  Eye,
  Pencil,
  Send,
  MessageSquare,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  Building2,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ApiClient, { OutreachCampaign, OutreachEmail } from '@/app/lib/api';

const EMAIL_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  pending: { label: 'Čekající', variant: 'outline', color: 'text-yellow-600' },
  draft: { label: 'Draft', variant: 'secondary', color: 'text-blue-600' },
  approved: { label: 'Schváleno', variant: 'default', color: 'text-green-600' },
  sent: { label: 'Odesláno', variant: 'outline', color: 'text-gray-600' },
  replied: { label: 'Odpověď', variant: 'default', color: 'text-purple-600' },
  skipped: { label: 'Přeskočeno', variant: 'outline', color: 'text-gray-400' },
  bounced: { label: 'Nedoručeno', variant: 'destructive', color: 'text-red-600' },
};

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [viewEmail, setViewEmail] = useState<OutreachEmail | null>(null);
  const [editEmail, setEditEmail] = useState<OutreachEmail | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const pageSize = 50;

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['outreach-campaign', campaignId],
    queryFn: () => ApiClient.getOutreachCampaign(campaignId),
  });

  const { data: emailsData, isLoading: loadingEmails } = useQuery({
    queryKey: ['outreach-emails', campaignId, statusFilter, page],
    queryFn: () =>
      ApiClient.getCampaignEmails(campaignId, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        offset: page * pageSize,
        limit: pageSize,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (emailId: string) => ApiClient.approveOutreachEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign', campaignId] });
      toast.success('Email schválen');
    },
    onError: () => toast.error('Nepodařilo se schválit email'),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (emailIds: string[]) => ApiClient.bulkApproveOutreachEmails(emailIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign', campaignId] });
      setSelectedEmails(new Set());
      toast.success(`Schváleno ${data.approved} emailů`);
    },
    onError: () => toast.error('Nepodařilo se schválit emaily'),
  });

  const skipMutation = useMutation({
    mutationFn: (emailId: string) => ApiClient.skipOutreachEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails', campaignId] });
      toast.success('Email přeskočen');
    },
    onError: () => toast.error('Nepodařilo se přeskočit email'),
  });

  const editMutation = useMutation({
    mutationFn: ({ emailId, data }: { emailId: string; data: { generated_subject?: string; generated_body?: string } }) =>
      ApiClient.editOutreachEmailDraft(emailId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails', campaignId] });
      setEditEmail(null);
      toast.success('Email upraven');
    },
    onError: () => toast.error('Nepodařilo se upravit email'),
  });

  const emails = emailsData?.items || [];
  const totalEmails = emailsData?.total || 0;
  const totalPages = Math.ceil(totalEmails / pageSize);

  const handleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.filter((e) => e.status === 'draft').map((e) => e.id)));
    }
  };

  const handleSelectEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleBulkApprove = () => {
    if (selectedEmails.size === 0) return;
    bulkApproveMutation.mutate(Array.from(selectedEmails));
  };

  const openEditDialog = (email: OutreachEmail) => {
    setEditEmail(email);
    setEditSubject(email.generated_subject || '');
    setEditBody(email.generated_body || '');
  };

  const handleSaveEdit = () => {
    if (!editEmail) return;
    editMutation.mutate({
      emailId: editEmail.id,
      data: {
        generated_subject: editSubject,
        generated_body: editBody,
      },
    });
  };

  if (loadingCampaign) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Kampaň nenalezena</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/superadmin/outreach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}
        </div>
        <Badge
          variant={campaign.status === 'active' ? 'default' : 'secondary'}
          className="text-sm"
        >
          {campaign.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {totalEmails - campaign.draft_count - campaign.approved_count - campaign.sent_count}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Drafty</span>
            </div>
            <div className="text-2xl font-bold mt-1">{campaign.draft_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Schváleno</span>
            </div>
            <div className="text-2xl font-bold mt-1">{campaign.approved_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-muted-foreground">Odesláno</span>
            </div>
            <div className="text-2xl font-bold mt-1">{campaign.sent_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Odpovědi</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-purple-600">{campaign.replied_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <TabsList>
            <TabsTrigger value="all">Vše</TabsTrigger>
            <TabsTrigger value="draft">Drafty</TabsTrigger>
            <TabsTrigger value="approved">Schváleno</TabsTrigger>
            <TabsTrigger value="sent">Odesláno</TabsTrigger>
            <TabsTrigger value="replied">Odpovědi</TabsTrigger>
          </TabsList>
        </Tabs>

        {selectedEmails.size > 0 && (
          <Button onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending} className="gap-2">
            {bulkApproveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckSquare className="h-4 w-4" />
            )}
            Schválit vybrané ({selectedEmails.size})
          </Button>
        )}
      </div>

      {/* Email Table */}
      <Card>
        {loadingEmails ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedEmails.size > 0 && selectedEmails.size === emails.filter((e) => e.status === 'draft').length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Útulek</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Předmět</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Žádné emaily v této kategorii
                    </TableCell>
                  </TableRow>
                ) : (
                  emails.map((email) => {
                    const statusConfig = EMAIL_STATUS_CONFIG[email.status] || EMAIL_STATUS_CONFIG.pending;
                    const canSelect = email.status === 'draft';

                    return (
                      <TableRow key={email.id}>
                        <TableCell>
                          {canSelect && (
                            <Checkbox
                              checked={selectedEmails.has(email.id)}
                              onCheckedChange={() => handleSelectEmail(email.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{email.shelter.name}</div>
                              <div className="text-xs text-muted-foreground">{email.shelter.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{email.shelter.region || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate text-sm">
                            {email.generated_subject || <span className="text-muted-foreground italic">Nebyl vygenerován</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant} className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          {email.error_message && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {email.error_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewEmail(email)}
                              title="Zobrazit"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {email.status === 'draft' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(email)}
                                  title="Upravit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => approveMutation.mutate(email.id)}
                                  disabled={approveMutation.isPending}
                                  title="Schválit"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => skipMutation.mutate(email.id)}
                                  disabled={skipMutation.isPending}
                                  title="Přeskočit"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                  Zobrazeno {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalEmails)} z {totalEmails}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* View Email Sheet */}
      <Sheet open={!!viewEmail} onOpenChange={() => setViewEmail(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {viewEmail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {viewEmail.shelter.name}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Shelter Info */}
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {viewEmail.shelter.email || 'Bez emailu'}
                  </div>
                  {viewEmail.shelter.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={viewEmail.shelter.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {viewEmail.shelter.website}
                      </a>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Region: {viewEmail.shelter.region || '-'}
                  </div>
                </div>

                {/* Email Content */}
                <div>
                  <Label className="text-muted-foreground">Předmět</Label>
                  <div className="mt-1 p-3 bg-white border rounded-md font-medium">
                    {viewEmail.generated_subject || <span className="text-muted-foreground italic">Nebyl vygenerován</span>}
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Obsah emailu</Label>
                  <div className="mt-1 p-3 bg-white border rounded-md whitespace-pre-wrap text-sm min-h-[200px]">
                    {viewEmail.generated_body || <span className="text-muted-foreground italic">Nebyl vygenerován</span>}
                  </div>
                </div>

                {/* Reply if exists */}
                {viewEmail.status === 'replied' && viewEmail.reply_content && (
                  <div className="border-t pt-4">
                    <Label className="text-purple-600">Odpověď</Label>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Od: {viewEmail.reply_from} | {viewEmail.replied_at && new Date(viewEmail.replied_at).toLocaleString('cs-CZ')}
                    </div>
                    {viewEmail.reply_subject && (
                      <div className="mt-2 font-medium">{viewEmail.reply_subject}</div>
                    )}
                    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md whitespace-pre-wrap text-sm">
                      {viewEmail.reply_content}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {viewEmail.status === 'draft' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => {
                        setViewEmail(null);
                        openEditDialog(viewEmail);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Upravit
                    </Button>
                    <Button
                      onClick={() => {
                        approveMutation.mutate(viewEmail.id);
                        setViewEmail(null);
                      }}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Schválit
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Email Dialog */}
      <Dialog open={!!editEmail} onOpenChange={() => setEditEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Upravit email - {editEmail?.shelter.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Předmět</Label>
              <Input
                id="edit-subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-body">Obsah emailu</Label>
              <Textarea
                id="edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmail(null)}>
              Zrušit
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
              {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Uložit změny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
