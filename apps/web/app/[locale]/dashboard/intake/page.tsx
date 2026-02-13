'use client';

import { ClipboardList, Search, Stethoscope, Home, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function IntakePage() {
  const plannedSteps = [
    { icon: Search, title: 'Identifikace zvířete', desc: 'Hledání dle čipu, jména nebo fotek — propojení s existujícím záznamem' },
    { icon: ClipboardList, title: 'Příjmové detaily', desc: 'Důvod příjmu, odkud přišlo, první zdravotní prohlídka' },
    { icon: Home, title: 'Přiřazení kotce', desc: 'Výběr volného kotce, zohlednění karantény a druhu zvířete' },
    { icon: CheckSquare, title: 'Automatické úkoly', desc: 'Šablony úkolů pro nový příjem — veterinář, registrace, foto' },
    { icon: Stethoscope, title: 'Zdravotní záznam', desc: 'Vstupní prohlídka, vakcinace, odčervení — rovnou při příjmu' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Příjem zvířete</h1>
          <p className="text-muted-foreground mt-1">Průvodce příjmem nového zvířete do útulku</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">Připravujeme</Badge>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Průvodce příjmem
          </CardTitle>
          <CardDescription>
            Příjmový wizard bude dostupný v další fázi vývoje. Prozatím zvířata přidávejte přes{' '}
            <a href="/dashboard/animals/new" className="underline text-primary">Přidat zvíře</a>.
            Plánujeme průchod těmito kroky:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plannedSteps.map((step, i) => (
              <div
                key={step.title}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-dashed"
              >
                <div className="p-2 rounded-lg bg-background border shrink-0">
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground mr-1">{i + 1}.</span>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
