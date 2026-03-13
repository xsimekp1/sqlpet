'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ApiClient, { DocumentInstance, DocumentListResponse } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Download, Eye } from 'lucide-react';
import Link from 'next/link';

export default function DocumentsPage() {
  const t = useTranslations();
  const [filter, setFilter] = useState<'all' | 'animal' | 'org'>('all');

  const { data, isLoading, error } = useQuery<DocumentListResponse>({
    queryKey: ['documents', filter],
    queryFn: () => ApiClient.getDocuments({ limit: 100 }),
    staleTime: 30 * 1000,
  });

  const { data: templatesData } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => ApiClient.getDocumentTemplates(),
    staleTime: 60 * 1000,
  });

  const documents = data?.items || [];
  const templates = templatesData?.items || [];

  const filteredDocuments = documents.filter((doc) => {
    if (filter === 'all') return true;
    if (filter === 'animal') return doc.animal_id !== null;
    if (filter === 'org') return doc.animal_id === null;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Koncept</Badge>;
      case 'final':
        return <Badge className="bg-green-100 text-green-800">Hotový</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Chyba při načítání dokumentů
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dokumenty</h1>
          <p className="text-muted-foreground mt-1">
            Přehled všech dokumentů v organizaci
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              <SelectItem value="animal">Ke zvířatům</SelectItem>
              <SelectItem value="org">Organizační</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Žádné dokumenty</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Šablona</TableHead>
                <TableHead>Zvíře</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vytvořeno</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {doc.template_name || doc.template_code || 'Neznámá šablona'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {doc.animal_id ? (
                      <Link
                        href={`/dashboard/animals/${doc.animal_id}`}
                        className="text-primary hover:underline"
                      >
                        {doc.animal_name || doc.animal_public_code || doc.animal_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(doc.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString('cs-CZ')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.created_by_name || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {doc.status === 'final' && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {filteredDocuments.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Zobrazeno {filteredDocuments.length} z {data?.total || 0} dokumentů
        </div>
      )}
    </div>
  );
}
