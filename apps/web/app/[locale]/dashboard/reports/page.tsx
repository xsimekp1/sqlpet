'use client';

import { useTranslations } from 'next-intl';
import { BarChart3, TrendingUp, FileText, PieChart, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ReportsPage() {
  const t = useTranslations();

  const plannedReports = [
    { icon: TrendingUp, title: 'Obsazenost v čase', desc: 'Počet zvířat v útulku po dnech/týdnech/měsících' },
    { icon: PieChart, title: 'Příjmy a výdeje', desc: 'Statistiky příjmů (intake) vs adopcí/výdejů' },
    { icon: FileText, title: 'Adopční přehled', desc: 'Úspěšnost adopcí, průměrná doba v útulku' },
    { icon: BarChart3, title: 'Lékařské záznamy', desc: 'Přehled veterinárních úkonů, očkování, léčby' },
    { icon: Clock, title: 'Denní operace', desc: 'Krmení, procházky, úkoly — denní souhrn' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reporty</h1>
          <p className="text-muted-foreground mt-1">Statistiky a přehledy provozu útulku</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">Připravujeme</Badge>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Analytické reporty
          </CardTitle>
          <CardDescription>
            Modul reportů bude dostupný v další fázi vývoje. Plánujeme následující přehledy:
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
