import { getDb } from '@/lib/db';

export type DueDateHistoryInput = {
  entity_type: 'risk' | 'issue';
  entity_id: string;
  old_due: string | null;
  new_due: string | null;
  changed_by: number;
};

/** Append-only INSERT into raid_due_date_history (D-06). No update or delete exports. */
export async function appendDueDateHistory(input: DueDateHistoryInput): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO raid_due_date_history (entity_type, entity_id, old_due, new_due, changed_by)
     VALUES (?, ?, ?, ?, ?)`,
    input.entity_type,
    input.entity_id,
    input.old_due,
    input.new_due,
    input.changed_by,
  );
}
