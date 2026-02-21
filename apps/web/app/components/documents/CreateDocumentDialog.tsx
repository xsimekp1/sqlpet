'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ApiClient from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface CreateDocumentDialogProps {
  animalId: string;
  animalName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentCreated?: () => void;
}

export default function CreateDocumentDialog({
  animalId,
  animalName,
  open,
  onOpenChange,
  onDocumentCreated,
}: CreateDocumentDialogProps) {
  const t = useTranslations('animals.documents');

  // Form state
  const [templateCode] = useState('donation_contract_dog'); // MVP: only one template
  const [place, setPlace] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [healthState, setHealthState] = useState('');
  const [temperament, setTemperament] = useState('');
  const [otherImportant, setOtherImportant] = useState('');
  const [otherNotes, setOtherNotes] = useState('');

  // Finding details (for contract)
  const [foundDate, setFoundDate] = useState('');
  const [foundStreet, setFoundStreet] = useState('');
  const [foundCity, setFoundCity] = useState('');
  const [foundTime, setFoundTime] = useState('');
  const [foundRegistry, setFoundRegistry] = useState('');

  // Handover details
  const [handoverPlace, setHandoverPlace] = useState('');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);
  const [handoverTime, setHandoverTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const manualFields = {
        place,
        date,
        time,
        health_state: healthState,
        temperament,
        other_important: otherImportant,
        other_notes: otherNotes,
        found_date: foundDate,
        found_street: foundStreet,
        found_city: foundCity,
        found_time: foundTime,
        found_registry: foundRegistry,
        handover_place: handoverPlace,
        handover_date: handoverDate,
        handover_time: handoverTime,
      };

      const result = await ApiClient.post(`/animals/${animalId}/documents`, {
        template_code: templateCode,
        manual_fields: manualFields,
        status: 'draft', // Preview as draft
      });

      setPreviewHtml(result.rendered_html);
      setShowPreview(true);
    } catch (err: any) {
      toast.error(err?.message || t('previewError'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const manualFields = {
        place,
        date,
        time,
        health_state: healthState,
        temperament,
        other_important: otherImportant,
        other_notes: otherNotes,
        found_date: foundDate,
        found_street: foundStreet,
        found_city: foundCity,
        found_time: foundTime,
        found_registry: foundRegistry,
        handover_place: handoverPlace,
        handover_date: handoverDate,
        handover_time: handoverTime,
      };

      await ApiClient.post(`/animals/${animalId}/documents`, {
        template_code: templateCode,
        manual_fields: manualFields,
        status: 'final',
      });

      toast.success(t('documentCreated'));
      onOpenChange(false);
      onDocumentCreated?.();
    } catch (err: any) {
      toast.error(err?.message || t('createError'));
    } finally {
      setLoading(false);
    }
  };

  if (showPreview && previewHtml) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('preview')}</DialogTitle>
            <DialogDescription>{t('previewDescription')}</DialogDescription>
          </DialogHeader>

          <div
            className="border rounded-lg p-6 bg-white"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
            >
              {t('back')}
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
            >
              {t('print')}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? t('generating') : t('generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('createDocument')}
          </DialogTitle>
          <DialogDescription>
            {t('createDescription', { name: animalName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Template Selection - MVP: fixed to donation contract */}
          <div className="space-y-2">
            <Label>{t('template')}</Label>
            <Select value={templateCode} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="donation_contract_dog">
                  {t('templates.donationContract')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="place">{t('place')}</Label>
              <Input
                id="place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder={t('placePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t('date')}</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Animal Health & Temperament */}
          <div className="space-y-2">
            <Label htmlFor="health-state">{t('healthState')}</Label>
            <Textarea
              id="health-state"
              value={healthState}
              onChange={(e) => setHealthState(e.target.value)}
              placeholder={t('healthStatePlaceholder')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperament">{t('temperament')}</Label>
            <Textarea
              id="temperament"
              value={temperament}
              onChange={(e) => setTemperament(e.target.value)}
              placeholder={t('temperamentPlaceholder')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="other-important">{t('otherImportant')}</Label>
            <Textarea
              id="other-important"
              value={otherImportant}
              onChange={(e) => setOtherImportant(e.target.value)}
              placeholder={t('otherImportantPlaceholder')}
              rows={2}
            />
          </div>

          {/* Finding Details */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">{t('findingDetails')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="found-date">{t('foundDate')}</Label>
                <Input
                  id="found-date"
                  type="date"
                  value={foundDate}
                  onChange={(e) => setFoundDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="found-time">{t('foundTime')}</Label>
                <Input
                  id="found-time"
                  type="time"
                  value={foundTime}
                  onChange={(e) => setFoundTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="found-street">{t('foundStreet')}</Label>
                <Input
                  id="found-street"
                  value={foundStreet}
                  onChange={(e) => setFoundStreet(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="found-city">{t('foundCity')}</Label>
                <Input
                  id="found-city"
                  value={foundCity}
                  onChange={(e) => setFoundCity(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="found-registry">{t('foundRegistry')}</Label>
                <Input
                  id="found-registry"
                  value={foundRegistry}
                  onChange={(e) => setFoundRegistry(e.target.value)}
                  placeholder={t('foundRegistryPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Handover Details */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">{t('handoverDetails')}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="handover-place">{t('handoverPlace')}</Label>
                <Input
                  id="handover-place"
                  value={handoverPlace}
                  onChange={(e) => setHandoverPlace(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handover-date">{t('handoverDate')}</Label>
                <Input
                  id="handover-date"
                  type="date"
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handover-time">{t('handoverTime')}</Label>
                <Input
                  id="handover-time"
                  type="time"
                  value={handoverTime}
                  onChange={(e) => setHandoverTime(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={loading}
          >
            <Eye className="h-4 w-4 mr-2" />
            {t('preview')}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? t('generating') : t('generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
