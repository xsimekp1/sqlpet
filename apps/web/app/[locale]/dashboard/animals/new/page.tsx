'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function NewAnimalPage() {
  const router = useRouter();
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      species: formData.get('species'),
      sex: formData.get('sex'),
      color: formData.get('color'),
      estimated_age_years: parseInt(formData.get('estimated_age_years') as string) || null,
      intake_date: formData.get('intake_date'),
      status: 'AVAILABLE',
    };

    try {
      // TODO: M3 - Call API to create animal
      console.log('Creating animal:', data);
      toast.success('Animal created successfully!');
      router.push('/dashboard/animals');
    } catch (error) {
      toast.error('Failed to create animal');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/animals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Animal</h1>
          <p className="text-muted-foreground mt-1">
            Register a new animal in the shelter
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Fill in the animal's basic details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Max, Luna"
                required
              />
            </div>

            {/* Species & Sex */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="species">Species *</Label>
                <Select name="species" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select species" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOG">Dog</SelectItem>
                    <SelectItem value="CAT">Cat</SelectItem>
                    <SelectItem value="RABBIT">Rabbit</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">Sex *</Label>
                <Select name="sex" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color & Age */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  name="color"
                  placeholder="e.g. Brown, Black"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_age_years">Estimated Age (years)</Label>
                <Input
                  id="estimated_age_years"
                  name="estimated_age_years"
                  type="number"
                  min="0"
                  max="30"
                  placeholder="e.g. 2"
                />
              </div>
            </div>

            {/* Intake Date */}
            <div className="space-y-2">
              <Label htmlFor="intake_date">Intake Date *</Label>
              <Input
                id="intake_date"
                name="intake_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Animal'}
              </Button>
              <Link href="/dashboard/animals">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
