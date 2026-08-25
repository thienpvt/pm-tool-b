import { useEffect, useState } from 'react';
import type { SavedMapping } from './types';

export function useImportMapping({ open, projectId }: { open: boolean; projectId: string }) {
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [existingJiraKeys, setExistingJiraKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetch('/api/import-mapping').then(r => r.json()).then(setSavedMappings).catch(() => {});
      fetch(`/api/projects/${projectId}/activities/import`)
        .then(r => r.json())
        .then((keys: string[]) => setExistingJiraKeys(new Set(keys)))
        .catch(() => {});
    }
  }, [open, projectId]);

  return { savedMappings, setSavedMappings, existingJiraKeys };
}
