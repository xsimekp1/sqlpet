'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import ApiClient, { type OrgSettings, type LegalRuleConfig } from '@/app/lib/api';
import { useAuth } from '@/app/context/AuthContext';

const TOTAL_STEPS = 4;

type StepKey = 'basic' | 'units' | 'legal' | 'summary';
const STEPS: StepKey[] = ['basic', 'units', 'legal', 'summary'];

type LegalDefaults = { finder_keeps: LegalRuleConfig; custody: LegalRuleConfig };

const CZ_LEGAL_DEFAULTS: LegalDefaults = {
  finder_keeps: { start: 'announced', fallback_start: 'found', days: 60, cz_later_of_announced_received: false },
  custody: { start: 'received', fallback_start: 'found', days: 120, cz_later_of_announced_received: true },
};

const SK_LEGAL_DEFAULTS: LegalDefaults = {
  finder_keeps: { start: 'announced', fallback_start: 'found', days: 60, cz_later_of_announced_received: false },
  custody: { start: 'received', fallback_start: 'found', days: 90, cz_later_of_announced_received: false },
};

const OTHER_LEGAL_DEFAULTS: LegalDefaults = {
  finder_keeps: { start: 'announced', fallback_start: 'found', days: 60, cz_later_of_announced_received: false },
  custody: { start: 'received', fallback_start: 'found', days: 90, cz_later_of_announced_received: false },
};

type LegalProfile = 'CZ' | 'SK' | 'OTHER';

function getDefaultRulesForProfile(profile: LegalProfile) {
  if (profile === 'CZ') return CZ_LEGAL_DEFAULTS;
  if (profile === 'SK') return SK_LEGAL_DEFAULTS;
  return OTHER_LEGAL_DEFAULTS;
}

export default function SetupPage() {
  const t = useTranslations('setup');
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'cs';
  const { setOnboardingCompleted, permissions } = useAuth();
  const isAdmin = permissions.includes('organizations.manage');

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('nonAdminTitle')}</CardTitle>
            <CardDescription>{t('nonAdminBanner')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step A — Basic
  const [orgName, setOrgName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('CZ');
  const [timezone, setTimezone] = useState('Europe/Prague');
  const [localeDefault, setLocaleDefault] = useState('cs');
  const [timeFormat, setTimeFormat] = useState<'24h' | '12h'>('24h');
  const [dateFormat, setDateFormat] = useState('dd.MM.yyyy');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWeb, setContactWeb] = useState('');

  // Step B — Units
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [inventoryDecimals, setInventoryDecimals] = useState('2');

  // Step C — Legal
  const [legalProfile, setLegalProfile] = useState<LegalProfile>('CZ');
  const [finderKeepsDays, setFinderKeepsDays] = useState('60');
  const [custodyDays, setCustodyDays] = useState('120');

  const currentStep = STEPS[step];
  const progress = ((step) / (TOTAL_STEPS - 1)) * 100;

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleProfileChange = (profile: LegalProfile) => {
    setLegalProfile(profile);
    const defaults = getDefaultRulesForProfile(profile);
    setFinderKeepsDays(String(defaults.finder_keeps.days));
    setCustodyDays(String(defaults.custody.days));
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const rules = getDefaultRulesForProfile(legalProfile);
      const settingsPayload: OrgSettings = {
        locale_default: localeDefault,
        timezone,
        time_format: timeFormat,
        date_format: dateFormat,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        contact_web: contactWeb || null,
        org_address: { street, city, zip, country },
        units: {
          system: unitSystem,
          inventory_decimal_places: parseInt(inventoryDecimals),
        },
        legal: {
          profile: legalProfile,
          rules: {
            finder_keeps: { ...rules.finder_keeps, days: parseInt(finderKeepsDays) },
            custody: { ...rules.custody, days: parseInt(custodyDays) },
          },
        },
      };

      // Save org name via PATCH if provided
      if (orgName.trim()) {
        await ApiClient.updateOrganization({ name: orgName.trim() });
      }

      await ApiClient.updateOrganizationSettings(settingsPayload);
      await ApiClient.completeOnboarding();

      setOnboardingCompleted(true);
      toast.success(t('completeSuccess'));
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      toast.error(t('completeError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>

        {/* Step indicators */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((s, i) => (
              <span key={s} className={i === step ? 'text-primary font-medium' : ''}>
                {i + 1}. {t(`steps.${s}`)}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        {currentStep === 'basic' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('steps.basic')}</CardTitle>
              <CardDescription>{t('stepA.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t('stepA.orgName')}</Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder={t('stepA.orgNamePlaceholder')} />
              </div>
              <div className="grid gap-2">
                <Label>{t('stepA.street')}</Label>
                <Input value={street} onChange={e => setStreet(e.target.value)} placeholder={t('stepA.streetPlaceholder')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>{t('stepA.city')}</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>{t('stepA.zip')}</Label>
                  <Input value={zip} onChange={e => setZip(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t('stepA.timezone')}</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Prague">Europe/Prague (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Bratislava">Europe/Bratislava (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Warsaw">Europe/Warsaw (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Vienna">Europe/Vienna (CET/CEST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>{t('stepA.locale')}</Label>
                  <Select value={localeDefault} onValueChange={setLocaleDefault}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cs">Čeština</SelectItem>
                      <SelectItem value="sk">Slovenčina</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t('stepA.timeFormat')}</Label>
                  <RadioGroup value={timeFormat} onValueChange={v => setTimeFormat(v as '24h' | '12h')} className="flex gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="24h" id="tf-24" />
                      <Label htmlFor="tf-24">24h</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="12h" id="tf-12" />
                      <Label htmlFor="tf-12">12h AM/PM</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t('stepA.dateFormat')}</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd.MM.yyyy">DD.MM.YYYY (EU)</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/DD/YYYY (US)</SelectItem>
                    <SelectItem value="yyyy-MM-dd">YYYY-MM-DD (ISO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">{t('stepA.contactInfo')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>{t('stepA.phone')}</Label>
                    <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} type="tel" placeholder="+420 123 456 789" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('stepA.email')}</Label>
                    <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} type="email" placeholder="info@utulek.cz" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t('stepA.web')}</Label>
                  <Input value={contactWeb} onChange={e => setContactWeb(e.target.value)} type="url" placeholder="https://utulek.cz" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'units' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('steps.units')}</CardTitle>
              <CardDescription>{t('stepB.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t('stepB.unitSystem')}</Label>
                <RadioGroup value={unitSystem} onValueChange={v => setUnitSystem(v as 'metric' | 'imperial')} className="space-y-2">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <RadioGroupItem value="metric" id="us-metric" />
                    <div>
                      <Label htmlFor="us-metric" className="font-medium">{t('stepB.metric')}</Label>
                      <p className="text-xs text-muted-foreground">{t('stepB.metricDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <RadioGroupItem value="imperial" id="us-imperial" />
                    <div>
                      <Label htmlFor="us-imperial" className="font-medium">{t('stepB.imperial')}</Label>
                      <p className="text-xs text-muted-foreground">{t('stepB.imperialDesc')}</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid gap-2">
                <Label>{t('stepB.inventoryDecimals')}</Label>
                <Select value={inventoryDecimals} onValueChange={setInventoryDecimals}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('stepB.decimals0')}</SelectItem>
                    <SelectItem value="2">{t('stepB.decimals2')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('stepB.inventoryDecimalsHint')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'legal' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('steps.legal')}</CardTitle>
              <CardDescription>{t('stepC.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t('stepC.profile')}</Label>
                <RadioGroup value={legalProfile} onValueChange={v => handleProfileChange(v as LegalProfile)} className="space-y-2">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <RadioGroupItem value="CZ" id="lp-cz" />
                    <Label htmlFor="lp-cz" className="font-medium">{t('stepC.profileCZ')}</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <RadioGroupItem value="SK" id="lp-sk" />
                    <Label htmlFor="lp-sk" className="font-medium">{t('stepC.profileSK')}</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <RadioGroupItem value="OTHER" id="lp-other" />
                    <Label htmlFor="lp-other" className="font-medium">{t('stepC.profileOther')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>{t('stepC.rulesTitle')}</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">{t('stepC.rulesTable.scenario')}</th>
                        <th className="text-left p-3 font-medium">{t('stepC.rulesTable.startDate')}</th>
                        <th className="text-left p-3 font-medium">{t('stepC.rulesTable.days')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3">{t('stepC.scenarioFinderKeeps')}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {legalProfile === 'CZ' ? t('stepC.startAnnounced') : t('stepC.startAnnounced')}
                        </td>
                        <td className="p-3">
                          {legalProfile === 'OTHER' ? (
                            <Input
                              type="number"
                              min="1"
                              value={finderKeepsDays}
                              onChange={e => setFinderKeepsDays(e.target.value)}
                              className="w-20 h-7 text-sm"
                            />
                          ) : (
                            <span className="font-medium">{finderKeepsDays}</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3">{t('stepC.scenarioCustody')}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {legalProfile === 'CZ' ? t('stepC.startLaterOf') : t('stepC.startReceived')}
                        </td>
                        <td className="p-3">
                          {legalProfile === 'OTHER' ? (
                            <Input
                              type="number"
                              min="1"
                              value={custodyDays}
                              onChange={e => setCustodyDays(e.target.value)}
                              className="w-20 h-7 text-sm"
                            />
                          ) : (
                            <span className="font-medium">{custodyDays}</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">{t('stepC.rulesNote')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'summary' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('steps.summary')}</CardTitle>
              <CardDescription>{t('stepD.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('steps.basic')}</p>
                  {orgName && <p className="text-sm font-medium">{orgName}</p>}
                  {city && <p className="text-sm text-muted-foreground">{[street, city, zip].filter(Boolean).join(', ')}</p>}
                  <p className="text-sm">{timezone}</p>
                  <p className="text-sm">{localeDefault.toUpperCase()} · {timeFormat}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('steps.units')}</p>
                  <p className="text-sm font-medium">{unitSystem === 'metric' ? t('stepB.metric') : t('stepB.imperial')}</p>
                  <p className="text-sm text-muted-foreground">{t('stepB.decimals' + inventoryDecimals)}</p>
                </div>
                <div className="space-y-1 p-3 bg-muted/40 rounded-lg col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('steps.legal')}</p>
                  <p className="text-sm font-medium">{t(`stepC.profile${legalProfile}`)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('stepC.scenarioFinderKeeps')}: {finderKeepsDays} {t('stepD.days')} · {t('stepC.scenarioCustody')}: {custodyDays} {t('stepD.days')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('back')}
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={handleNext}>
              {t('next')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t('complete')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
