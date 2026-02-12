import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Organization {
  id: string;
  name: string;
  slug: string;
  default_locale?: string;
}

interface OrganizationState {
  selectedOrg: Organization | null;
  setSelectedOrg: (org: Organization | null) => void;
  clearSelectedOrg: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      selectedOrg: null,
      setSelectedOrg: (org) => set({ selectedOrg: org }),
      clearSelectedOrg: () => set({ selectedOrg: null }),
    }),
    {
      name: 'pawshelter-org-storage',
      partialize: (state) => ({
        selectedOrg: state.selectedOrg,
      }),
    }
  )
);
