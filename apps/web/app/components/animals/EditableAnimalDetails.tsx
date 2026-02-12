'use client';

import { useState } from 'react';
import { Animal } from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Edit, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import ApiClient from '@/app/lib/api';

interface EditableAnimalDetailsProps {
  animal: Animal;
  onAnimalUpdate: (updatedAnimal: Animal) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'adopted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'fostered':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'transferred':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'deceased':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'escaped':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function EditableAnimalDetails({ animal, onAnimalUpdate }: EditableAnimalDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState({
    sex: animal.sex,
    color: animal.color || '',
    estimated_age_years: animal.estimated_age_years || 0,
    intake_date: animal.intake_date ? new Date(animal.intake_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  });

  const startEdit = () => {
    setEditedData({
      sex: animal.sex,
      color: animal.color || '',
      estimated_age_years: animal.estimated_age_years || 0,
      intake_date: animal.intake_date ? new Date(animal.intake_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditedData({
      sex: animal.sex,
      color: animal.color || '',
      estimated_age_years: animal.estimated_age_years || 0,
      intake_date: animal.intake_date ? new Date(animal.intake_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      // Prepare only changed fields
      const updateData: any = {};
      
      if (editedData.sex !== animal.sex) {
        updateData.sex = editedData.sex;
      }
      if (editedData.color !== (animal.color || '')) {
        updateData.color = editedData.color || null;
      }
      if (editedData.estimated_age_years !== animal.estimated_age_years) {
        updateData.estimated_age_years = editedData.estimated_age_years;
      }
      if (editedData.intake_date !== (animal.intake_date ? new Date(animal.intake_date).toISOString().split('T')[0] : '')) {
        updateData.intake_date = editedData.intake_date;
      }

      if (Object.keys(updateData).length === 0) {
        cancelEdit();
        return;
      }

      const updatedAnimal = await ApiClient.updateAnimal(animal.id, updateData);
      onAnimalUpdate(updatedAnimal);
      setIsEditing(false);
      toast.success('Informace o zvířeti byly aktualizovány');
    } catch (error) {
      toast.error('Nepodařilo se aktualizovat informace');
      console.error('Error updating animal details:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onKeyDown={handleKeyDown}>
        {/* Sex */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Sex</p>
          <Select value={editedData.sex} onValueChange={(value) => setEditedData(prev => ({ ...prev, sex: value }))}>
            <SelectTrigger disabled={isSaving}>
              <SelectValue placeholder="Vyberte pohlaví" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">♂ Male</SelectItem>
              <SelectItem value="female">♀ Female</SelectItem>
              <SelectItem value="unknown">? Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Color */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Color</p>
          <Input
            value={editedData.color}
            onChange={(e) => setEditedData(prev => ({ ...prev, color: e.target.value }))}
            disabled={isSaving}
            placeholder="Zadejte barvu"
          />
        </div>

        {/* Estimated Age */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Estimated Age</p>
          <Input
            type="number"
            value={editedData.estimated_age_years}
            onChange={(e) => setEditedData(prev => ({ ...prev, estimated_age_years: parseInt(e.target.value) || 0 }))}
            disabled={isSaving}
            min="0"
            max="30"
          />
          <p className="text-xs text-muted-foreground">years</p>
        </div>

        {/* Intake Date */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Intake Date</p>
          <Input
            type="date"
            value={editedData.intake_date}
            onChange={(e) => setEditedData(prev => ({ ...prev, intake_date: e.target.value }))}
            disabled={isSaving}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Save/Cancel buttons */}
        <div className="col-span-1 md:col-span-2 flex gap-2 justify-end mt-4">
          <Button
            onClick={cancelEdit}
            disabled={isSaving}
            variant="outline"
          >
            <X className="h-4 w-4 mr-2" />
            Zrušit
          </Button>
          <Button
            onClick={saveEdit}
            disabled={isSaving}
          >
            <Check className="h-4 w-4 mr-2" />
            {isSaving ? 'Ukládám...' : 'Uložit'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Public Code - static */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Public Code</p>
        <p className="font-medium">#{animal.public_code}</p>
      </div>

      {/* Species - static */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Species</p>
        <p className="font-medium capitalize">{animal.species}</p>
      </div>

      {/* Sex - editable */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          Sex
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </p>
        <p className="font-medium">
          {animal.sex === 'male' ? '♂ Male' : animal.sex === 'female' ? '♀ Female' : '? Unknown'}
        </p>
      </div>

      {/* Color - editable */}
      {animal.color !== null && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Color
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
          </p>
          <p className="font-medium">{animal.color}</p>
        </div>
      )}

      {/* Estimated Age - editable */}
      {animal.estimated_age_years !== null && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Estimated Age
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
          </p>
          <p className="font-medium">
            {animal.estimated_age_years} {animal.estimated_age_years === 1 ? 'year' : 'years'}
          </p>
        </div>
      )}

      {/* Intake Date - editable */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          Intake Date
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </p>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium">{new Date(animal.intake_date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Status - static */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Status</p>
        <Badge className={getStatusColor(animal.status)}>
          {animal.status}
        </Badge>
      </div>
    </div>
  );
}