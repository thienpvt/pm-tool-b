import {
  listSettings as listSettingsRepo,
  setSetting,
} from '@/lib/repositories/settings.repo';

export async function listSettings() {
  return listSettingsRepo();
}

export async function setSettings(entries: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, String(value));
  }
}
