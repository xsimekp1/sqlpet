'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import ApiClient from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Eye, EyeOff, FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const animalId = params.id as string;
  const t = useTranslations('animals.documents');
  const locale = useLocale();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [animalName, setAnimalName] = useState('');
  const [templateCode, setTemplateCode] = useState('donation_contract_dog');
  const [place, setPlace] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [healthState, setHealthState] = useState('');
  const [temperament, setTemperament] = useState('');
  const [otherImportant, setOtherImportant] = useState('');
  const [otherNotes, setOtherNotes] = useState('');

  const [foundDate, setFoundDate] = useState('');
  const [foundStreet, setFoundStreet] = useState('');
  const [foundCity, setFoundCity] = useState('');
  const [foundTime, setFoundTime] = useState('');
  const [foundRegistry, setFoundRegistry] = useState('');

  const [handoverPlace, setHandoverPlace] = useState('');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);
  const [handoverTime, setHandoverTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getAnimal(animalId)
      .then((a) => { if (a) setAnimalName(a.name); })
      .catch(() => {});
  }, [animalId]);

  const buildManualFields = () => ({
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
  });

  const handlePreview = async () => {
    setLoading(true);
    try {
      const result = await ApiClient.post(`/animals/${animalId}/documents/preview`, {
        template_code: templateCode,
        manual_fields: buildManualFields(),
        locale,
      });
      setPreviewHtml(result.rendered_html);
    } catch (err: any) {
      toast.error(err?.message || t('previewError'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await ApiClient.post(`/animals/${animalId}/documents`, {
        template_code: templateCode,
        manual_fields: buildManualFields(),
        status: 'final',
        locale,
      });
      toast.success(t('documentCreated'));
      router.push(`/dashboard/animals/${animalId}`);
    } catch (err: any) {
      toast.error(err?.message || t('createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/animals/${animalId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back')}
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{t('createDocument')}</span>
          {animalName && <span className="text-muted-foreground">— {animalName}</span>}
        </div>
        <div className="flex-1" />
        {previewHtml ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setPreviewHtml(null)}>
              <EyeOff className="h-4 w-4 mr-2" />
              {t('back')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => iframeRef.current?.contentWindow?.print()}>
              <Printer className="h-4 w-4 mr-2" />
              {t('print')}
            </Button>
            <Button onClick={handleGenerate} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? t('generating') : t('generate')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {t('preview')}
            </Button>
            <Button onClick={handleGenerate} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? t('generating') : t('generate')}
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      {previewHtml ? (
        /* Preview pane */
        <div className="flex-1 overflow-auto bg-muted/30 flex justify-center p-8">
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            scrolling="no"
            style={{
              width: '210mm',
              minHeight: '297mm',
              border: 'none',
              background: 'white',
              boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
            }}
            title={t('preview')}
          />
        </div>
      ) : (
        /* Form */
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label>{t('template')}</Label>
              <Select value={templateCode} onValueChange={setTemplateCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="donation_contract_dog">
                    {t('templates.donationContract')}
                  </SelectItem>
                  <SelectItem value="surrender_contract_dog">
                    {t('templates.surrenderContract')}
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
        </div>
      )}
    </div>
  );
}
