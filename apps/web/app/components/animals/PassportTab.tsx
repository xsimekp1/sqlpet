"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileUp, Calendar, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { toast } from "sonner";
import ApiClient from "@/app/lib/api";

interface PassportTabProps {
  animalId: string;
}

export default function PassportTab({ animalId }: PassportTabProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch passport data
  const { data: passport, isLoading } = useQuery({
    queryKey: ["animal-passport", animalId],
    queryFn: () => ApiClient.getAnimalPassport(animalId),
  });

  // Fetch vaccinations for summary
  const { data: vaccinationsData } = useQuery({
    queryKey: ["animal-vaccinations", animalId],
    queryFn: () => ApiClient.getAnimalVaccinations(animalId, 1, 100),
  });

  const vaccinations = vaccinationsData?.items || [];

  // Update passport mutation
  const updatePassportMutation = useMutation({
    mutationFn: (data: any) => ApiClient.updateAnimalPassport(animalId, data),
    onSuccess: () => {
      toast.success("Očkovací průkaz aktualizován");
      queryClient.invalidateQueries({ queryKey: ["animal-passport", animalId] });
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Chyba při ukládání průkazu");
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: (file: File) => ApiClient.uploadPassportDocument(animalId, file),
    onSuccess: () => {
      toast.success("Dokument nahrán");
      queryClient.invalidateQueries({ queryKey: ["animal-passport", animalId] });
      setUploading(false);
    },
    onError: () => {
      toast.error("Chyba při nahrávání dokumentu");
      setUploading(false);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadDocumentMutation.mutate(file);
    }
    // Reset input
    e.target.value = '';
  };

  const getExpirationStatus = (validUntil: string | null) => {
    if (!validUntil) return null;
    const today = new Date();
    const expiryDate = new Date(validUntil);
    const daysUntil = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { status: "expired", label: "Vypršelo", variant: "destructive" as const };
    if (daysUntil <= 14) return { status: "expiring_soon", label: `${daysUntil} dní`, variant: "default" as const };
    if (daysUntil <= 30) return { status: "expiring_later", label: `${daysUntil} dní`, variant: "secondary" as const };
    return { status: "valid", label: "Platné", variant: "outline" as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Passport Metadata Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Očkovací průkaz</CardTitle>
              <CardDescription>Základní informace o očkovacím průkazu</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Upravit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updatePassportMutation.mutate({
                  passport_number: formData.get("passport_number"),
                  issued_at: formData.get("issued_at") || null,
                  issuer_name: formData.get("issuer_name"),
                  notes: formData.get("notes"),
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="passport_number">Číslo průkazu</Label>
                <Input
                  id="passport_number"
                  name="passport_number"
                  defaultValue={passport?.passport_number || ""}
                  placeholder="např. CZ123456789"
                  className="bg-white"
                />
              </div>
              <div>
                <Label htmlFor="issued_at">Datum vydání</Label>
                <Input
                  id="issued_at"
                  name="issued_at"
                  type="date"
                  defaultValue={passport?.issued_at || ""}
                  className="bg-white"
                />
              </div>
              <div>
                <Label htmlFor="issuer_name">Vydal (klinika/veterinář)</Label>
                <Input
                  id="issuer_name"
                  name="issuer_name"
                  defaultValue={passport?.issuer_name || ""}
                  placeholder="Veterinární klinika"
                  className="bg-white"
                />
              </div>
              <div>
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={passport?.notes || ""}
                  rows={3}
                  className="bg-white"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={updatePassportMutation.isPending}>
                  {updatePassportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Uložit
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Zrušit
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Číslo průkazu</div>
                <div className="text-base">{passport?.passport_number || "—"}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Datum vydání</div>
                <div className="text-base">
                  {passport?.issued_at
                    ? format(new Date(passport.issued_at), "d. MMMM yyyy", { locale: cs })
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Vydal</div>
                <div className="text-base">{passport?.issuer_name || "—"}</div>
              </div>
              {passport?.notes && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Poznámky</div>
                  <div className="text-base whitespace-pre-wrap">{passport.notes}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Card */}
      <Card>
        <CardHeader>
          <CardTitle>Dokumenty (scany/fotky)</CardTitle>
          <CardDescription>Naskenované stránky očkovacího průkazu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="document-upload" className="cursor-pointer">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                <div className="text-center">
                  {uploading ? (
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-2" />
                  ) : (
                    <FileUp className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  )}
                  <div className="text-sm text-muted-foreground">
                    {uploading ? "Nahrávání..." : "Klikněte pro nahrání dokumentu"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG</div>
                </div>
              </div>
              <Input
                id="document-upload"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </Label>
          </div>

          {passport?.documents && passport.documents.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {passport.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.file_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm font-medium truncate">{doc.file_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(doc.created_at), "d.M.yyyy")}
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vaccination Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Přehled očkování</CardTitle>
          <CardDescription>Aktuální stav a platnost očkování</CardDescription>
        </CardHeader>
        <CardContent>
          {vaccinations && vaccinations.length > 0 ? (
            <div className="space-y-3">
              {vaccinations.map((vacc: any) => {
                const expStatus = getExpirationStatus(vacc.valid_until);
                return (
                  <div
                    key={vacc.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{vacc.vaccination_type}</div>
                      <div className="text-sm text-muted-foreground">
                        Podáno: {format(new Date(vacc.administered_at), "d.M.yyyy")}
                        {vacc.valid_until && (
                          <> • Platné do: {format(new Date(vacc.valid_until), "d.M.yyyy")}</>
                        )}
                      </div>
                    </div>
                    {expStatus && (
                      <Badge variant={expStatus.variant}>
                        {expStatus.status === "expired" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {expStatus.status === "valid" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {expStatus.label}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Žádné záznamy o očkování
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
