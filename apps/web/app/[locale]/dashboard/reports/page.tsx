'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { BarChart3, TrendingUp, FileText, PieChart, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';
// ApiClient imported for chart data only — document preview navigates to /reports/preview

// ── Simple SVG line chart for daily animal count ────────────────────────────
function DailyCountChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Nedostatek dat pro zobrazení grafu</p>;
  if (data.length < 2) return <p className="text-sm text-muted-foreground">Nedostatek dat pro zobrazení grafu</p>;

  const W = 600, H = 200;
  const padL = 40, padR = 30, padT = 16, padB = 32;

  const counts = data.map(d => d.count);
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);
  // Add 10% padding to range for better visualization, ensure at least some visual range
  const rangePadding = Math.max((maxC - minC) * 0.1, 1);
  const rangeC = Math.max(maxC - minC, 1) + rangePadding;
  const displayMin = Math.max(minC - rangePadding, 0);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

  const toX = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const toY = (v: number) => padT + (H - padT - padB) - ((v - displayMin) / rangeC) * (H - padT - padB);

  const avgY = toY(avg);
  const polyline = data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(' ');

  // Show ~6 date labels
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  // Grid line values: multiples of 5 within chart range
  const gridStep = 5;
  const gridStart = Math.floor(displayMin / gridStep) * gridStep;
  const gridEnd = Math.ceil((displayMin + rangeC) / gridStep) * gridStep;
  const gridValues = Array.from(
    { length: Math.ceil((gridEnd - gridStart) / gridStep) + 1 },
    (_, i) => gridStart + i * gridStep,
  ).filter(v => v >= displayMin && v <= displayMin + rangeC);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden>
      {/* Horizontal dotted grid lines every 5 animals */}
      {gridValues.map(v => (
        <line key={v}
          x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)}
          stroke="hsl(var(--border))" strokeDasharray="3 3" strokeWidth="1" opacity="0.6"
        />
      ))}

      {/* Average reference line */}
      <line
        x1={padL} y1={avgY} x2={W - padR} y2={avgY}
        stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth="1" opacity="0.5"
      />
      <text x={W - padR + 2} y={avgY + 4} fontSize="10" fill="hsl(var(--muted-foreground))">
        avg {avg.toFixed(0)}
      </text>

      {/* Y-axis labels for grid lines */}
      {gridValues.map(v => (
        <text key={v} x={padL - 4} y={toY(v) + 4} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="end">
          {v}
        </text>
      ))}

      {/* Area fill */}
      <polygon
        points={`${padL},${H - padB} ${polyline} ${W - padR},${H - padB}`}
        fill="hsl(var(--primary))"
        fillOpacity="0.08"
      />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots — only for small datasets, hidden when many points */}
      {data.length <= 30 && data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.count)} r="3" fill="hsl(var(--primary))" stroke="white" strokeWidth="1">
          <title>{`${d.date}: ${d.count} zvířat`}</title>
        </circle>
      ))}

      {/* X-axis date labels */}
      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null;
        return (
          <text key={i} x={toX(i)} y={H - 4} fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle">
            {d.date.slice(5, 10)}
          </text>
        );
      })}
    </svg>
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

export default function ReportsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  // Org documents state
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedTemplate, setSelectedTemplate] = useState('annual_intake_report');

  useEffect(() => {
    ApiClient.getAnimalDailyCount(90)
      .then(setDailyData)
      .catch(() => toast.error('Nepodařilo se načíst statistiky'))
      .finally(() => setLoadingChart(false));
  }, []);

  function handleGeneratePreview() {
    router.push(`/dashboard/reports/preview?template=${selectedTemplate}&year=${selectedYear}`);
  }

const plannedReports = [
    { icon: PieChart, title: 'Příjmy a výdeje', desc: 'Statistiky příjmů (intake) vs adopcí/výdejů' },
    { icon: FileText, title: 'Adopční přehled', desc: 'Úspěšnost adopcí, průměrná doba v útulku' },
    { icon: Clock, title: 'Denní operace', desc: 'Krmení, procházky, úkoly — denní souhrn' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reporty</h1>
          <p className="text-muted-foreground mt-1">Statistiky a přehledy provozu útulku</p>
        </div>
      </div>

      {/* ── Live chart: daily animal count ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('reports.animalCountTitle')}
          </CardTitle>
          <CardDescription>
            {t('reports.animalCountDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingChart ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <DailyCountChart data={dailyData} />
          )}
</CardContent>
      </Card>

      {/* ── Org documents ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('reports.orgDocuments')}
          </CardTitle>
          <CardDescription>{t('reports.orgDocumentsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t('reports.selectTemplate')}</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="w-64 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_intake_report">
                    {t('reports.templates.annual_intake_report')}
                  </SelectItem>
                  <SelectItem value="annual_food_consumption">
                    {t('reports.templates.annual_food_consumption')}
                  </SelectItem>
                  <SelectItem value="website_listing_report">
                    {t('reports.templates.website_listing_report')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t('reports.selectYear')}</label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-28 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGeneratePreview}>
              {t('reports.generatePreview')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Planned reports placeholder ── */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Další reporty
            </CardTitle>
            <Badge variant="secondary" className="text-sm px-3 py-1">Připravujeme</Badge>
          </div>
          <CardDescription>
            Plánované přehledy pro další fáze vývoje:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plannedReports.map((report) => (
              <div
                key={report.title}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-dashed"
              >
                <div className="p-2 rounded-lg bg-background border">
                  <report.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">{report.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
