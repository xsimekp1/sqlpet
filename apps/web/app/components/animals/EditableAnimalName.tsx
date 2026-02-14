'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Animal } from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import ApiClient from '@/app/lib/api';

interface EditableAnimalNameProps {
  animal: Animal;
  onAnimalUpdate: (updatedAnimal: Animal) => void;
}

export function EditableAnimalName({ animal, onAnimalUpdate }: EditableAnimalNameProps) {
  const t = useTranslations('animals.editName');
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    setEditedName(animal.name);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditedName(animal.name);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (!editedName.trim()) {
      toast.error(t('nameRequired'));
      return;
    }

    if (editedName === animal.name) {
      cancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      const updatedAnimal = await ApiClient.updateAnimal(animal.id, {
        name: editedName
      });

      onAnimalUpdate(updatedAnimal);
      setIsEditing(false);
      toast.success(t('updated'));
    } catch (error) {
      toast.error(t('updateError'));
      console.error('Error updating animal name:', error);
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
      <div className="flex items-center gap-2 flex-1">
        <Input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="text-3xl font-bold bg-transparent border-none px-0 py-0 focus-visible:ring-0 h-auto"
          style={{ fontSize: '1.875rem', lineHeight: '2.25rem' }}
          autoFocus
          placeholder={t('placeholder')}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={saveEdit}
            disabled={isSaving || !editedName.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelEdit}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1">
      <h1
        className="text-3xl font-bold cursor-pointer hover:text-primary transition-colors"
        onClick={startEdit}
        title={t('clickHint')}
      >
        {animal.name}
      </h1>
      <Button
        size="sm"
        variant="outline"
        onClick={startEdit}
        title={t('editTitle')}
      >
        <Edit className="h-4 w-4" />
      </Button>
    </div>
  );
}
