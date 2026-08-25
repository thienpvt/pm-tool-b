export type SavedMapping = { id: number; name: string; mappings_json: string; created_at: string };
export type FileData = { columns: string[]; allRows: string[][]; preview: string[][] };
export type ImportStep = 1 | 2 | 3;
export type EpicCorrection = { epicKey: string; epicName: string; oldStatus: string; newStatus: string };
