"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Loader2, GripVertical, X } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import ApiClient from "@/app/lib/api";
import Link from "next/link";

interface VaccinationsExpiringWidgetProps {
  editMode?: boolean;
  onRemove?: () => void;
  dragHandleProps?: any;
}

export default function VaccinationsExpiringWidget({ editMode, onRemove, dragHandleProps }: VaccinationsExpiringWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["vaccinations-expiring"],
    queryFn: () => ApiClient.getExpiringVaccinations(14),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasExpiring = (data?.expiring_within_14_days || 0) > 0;
  const hasExpired = (data?.expired || 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          {editMode && dragHandleProps && (
            <button {...dragHandleProps} className="cursor-grab active:cursor-grabbing mt-1">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Očkování (platnost)
            </CardTitle>
            <CardDescription>Přehled expirujících vakcín</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {(hasExpiring || hasExpired) && !editMode && (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Vyžaduje pozornost
              </Badge>
            )}
            {editMode && onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.upcoming && data.upcoming.length > 0 ? (
          <>
            {data.upcoming.map((vacc) => (
              <Link
                key={vacc.id}
                href={`/dashboard/animals/${vacc.animal_id}`}
                className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {vacc.animal_name} ({vacc.animal_public_code || 'N/A'})
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {vacc.vaccine_type} •{" "}
                      {vacc.valid_until && format(new Date(vacc.valid_until), "d.M.yyyy")}
                    </div>
                  </div>
                  <Badge
                    variant={
                      vacc.status === "expired"
                        ? "destructive"
                        : vacc.status === "expiring_soon"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {vacc.status === "expired"
                      ? "Vypršelo"
                      : `${vacc.days_until_expiration} dní`}
                  </Badge>
                </div>
              </Link>
            ))}

            <div className="pt-2 text-sm text-muted-foreground text-center border-t">
              Celkem: {data.total_vaccinations} očkování •{" "}
              {data.expiring_within_14_days} do 14 dní •{" "}
              {data.expired} prošlých
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Žádná očkování nekončí v nejbližší době
          </div>
        )}
      </CardContent>
    </Card>
  );
}
