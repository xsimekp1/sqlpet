'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ApiClient, { Animal } from '@/app/lib/api';
import { toast } from 'sonner';

interface IntakeRecord {
  id: string;
  animal_id: string;
  reason: string;
  intake_date: string;
  notes: string | null;
}

const STEPS = [
  'Zvíře',
  'Důvod a datum',
  'Lidé',
  'Finance',
  'Potvrzení',
];

const REASON_OPTIONS = [
  { value: 'found', label: 'Nález' },
  { value: 'return', label: 'Návrat z adopce' },
  { value: 'surrender', label: 'Dobrovolné odevzdání' },
  { value: 'official', label: 'Úřední příděl' },
  { value: 'transfer', label: 'Převod z jiného útulku' },
  { value: 'other', label: 'Jiné' },
];

interface FormState {
  // Step 1
  animal_id: string;
  animal_name: string;
  // Step 2
  reason: string;
  intake_date: string;
  notes: string;
  // Step 3
  finder_notes: string;
  // Step 4
  funding_source: string;
  funding_notes: string;
}

export default function NewIntakePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<FormState>({
    animal_id: '',
    animal_name: '',
    reason: '',
    intake_date: today,
    notes: '',
    finder_notes: '',
    funding_source: '',
    funding_notes: '',
  });

  // Animal search
  const [animalSearch, setAnimalSearch] = useState('');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [searchingAnimals, setSearchingAnimals] = useState(false);

  // Previous intakes for selected animal
  const [previousIntakes, setPreviousIntakes] = useState<IntakeRecord[]>([]);
  const [loadingPreviousIntakes, setLoadingPreviousIntakes] = useState(false);

  useEffect(() => {
    if (!animalSearch || animalSearch.length < 2) { setAnimals([]); return; }
    const t = setTimeout(async () => {
      setSearchingAnimals(true);
      try {
        const data = await ApiClient.getAnimals({ search: animalSearch });
        setAnimals(data.items.slice(0, 8));
      } catch { setAnimals([]); }
      finally { setSearchingAnimals(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [animalSearch]);

  const selectAnimal = async (a: Animal) => {
    set('animal_id', a.id);
    set('animal_name', a.name);
    setAnimalSearch('');
    setAnimals([]);
    // Check for previous intakes
    setLoadingPreviousIntakes(true);
    try {
      const rawData = await ApiClient.get(`/intakes?animal_id=${a.id}`);
      const intakes: IntakeRecord[] = Array.isArray(rawData)
        ? rawData
        : (rawData?.items ?? []);
      setPreviousIntakes(intakes);
    } catch {
      setPreviousIntakes([]);
    } finally {
      setLoadingPreviousIntakes(false);
    }
  };

  const set = (key: keyof FormState, value: string) =>
    setForm(p => ({ ...p, [key]: value }));

  const canNext = () => {
    if (step === 0) return !!form.animal_id;
    if (step === 1) return !!form.reason && !!form.intake_date;
    return true;
  };

  const handleSubmit = async () => {
    if (!form.animal_id || !form.reason || !form.intake_date) return;
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        animal_id: form.animal_id,
        reason: form.reason,
        intake_date: form.intake_date,
        notes: form.notes || undefined,
        finder_notes: form.finder_notes || undefined,
        funding_source: form.funding_source || undefined,
        funding_notes: form.funding_notes || undefined,
      };
      await ApiClient.post('/intakes', body);
      toast.success('Příjem byl zaznamenán');
      router.push('/dashboard/intake');
    } catch (err: any) {
      toast.error('Nepodařilo se vytvořit příjem: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/intake">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nový příjem zvířete</h1>
          <p className="text-muted-foreground text-sm">Krok {step + 1} z {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              i < step ? 'bg-primary text-primary-foreground' :
              i === step ? 'bg-primary/20 text-primary border border-primary' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Step 0: Zvíře */}
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Hledat zvíře</Label>
                <Input
                  placeholder="Zadejte jméno nebo kód..."
                  value={animalSearch}
                  onChange={e => setAnimalSearch(e.target.value)}
                />
              </div>
              {searchingAnimals && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {animals.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {animals.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectAnimal(a)}
                      className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm ${form.animal_id === a.id ? 'bg-primary/10' : ''}`}
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">#{a.public_code} · {a.species}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.animal_id && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{form.animal_name}</span>
                    <button
                      type="button"
                      onClick={() => { set('animal_id', ''); set('animal_name', ''); setPreviousIntakes([]); }}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      Změnit
                    </button>
                  </div>
                  {loadingPreviousIntakes && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Načítám předchozí pobyty…
                    </div>
                  )}
                  {!loadingPreviousIntakes && previousIntakes.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Toto zvíře bylo u nás již {previousIntakes.length}x. Viz předchozí pobyty:{' '}
                        {previousIntakes.map((intake, idx) => (
                          <span key={intake.id}>
                            <Link href="/dashboard/intake" className="underline hover:no-underline">
                              {new Date(intake.intake_date).toLocaleDateString()}
                            </Link>
                            {idx < previousIntakes.length - 1 && ', '}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  Zvíře nenalezeno?{' '}
                  <Link href="/dashboard/animals/new" className="text-primary hover:underline">
                    Vytvořte nové zvíře
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Důvod a datum */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Důvod příjmu *</Label>
                <Select value={form.reason} onValueChange={v => set('reason', v)}>
                  <SelectTrigger><SelectValue placeholder="Vyberte důvod" /></SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Datum příjmu *</Label>
                <Input type="date" value={form.intake_date} onChange={e => set('intake_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Poznámky</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Volitelné poznámky k příjmu"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Lidé */}
          {step === 2 && (
            <div className="space-y-4">
              {form.reason === 'found' ? (
                <div className="space-y-1">
                  <Label>Poznámky k nálezu</Label>
                  <p className="text-xs text-muted-foreground">Kde bylo zvíře nalezeno, kdo ho přinesl, okolnosti nálezu atd.</p>
                  <textarea
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Popis okolností nálezu…"
                    value={form.finder_notes}
                    onChange={e => set('finder_notes', e.target.value)}
                  />
                  {/* TODO: M4+ - link to contacts search */}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <p>Pro tento důvod příjmu není potřeba zadávat kontaktní informace.</p>
                  <p className="text-sm mt-1">Pokračujte dále.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Finance */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Způsob financování</Label>
                <Input
                  value={form.funding_source}
                  onChange={e => set('funding_source', e.target.value)}
                  placeholder="např. obec, soukromník, spolek…"
                />
              </div>
              <div className="space-y-1">
                <Label>Poznámky k financování</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Volitelné poznámky k financování…"
                  value={form.funding_notes}
                  onChange={e => set('funding_notes', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 4: Potvrzení */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zvíře:</span>
                  <span className="font-medium">{form.animal_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Důvod:</span>
                  <span>{REASON_OPTIONS.find(o => o.value === form.reason)?.label ?? form.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Datum příjmu:</span>
                  <span>{form.intake_date}</span>
                </div>
                {form.funding_source && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Financování:</span>
                    <span>{form.funding_source}</span>
                  </div>
                )}
                {form.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poznámky:</span>
                    <span className="text-right max-w-[60%]">{form.notes}</span>
                  </div>
                )}
              </div>
              {previousIntakes.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-blue-800 dark:text-blue-200">
                    Toto zvíře bylo u nás již {previousIntakes.length}x.
                  </span>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zpět
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
            Další
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Vytvořit příjem
          </Button>
        )}
      </div>
    </div>
  );
}
