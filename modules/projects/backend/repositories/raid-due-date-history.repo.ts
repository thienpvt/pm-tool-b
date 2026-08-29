import { getKysely } from '@/lib/db/kysely';

export type DueDateHistoryInput = {
  entity_type: 'risk' | 'issue';
  entity_id: string;
  old_due: string | null;
  new_due: string | null;
  changed_by: number;
};

/** Append-only INSERT into raid_due_date_history (D-06). No update or delete exports. */
export async function appendDueDateHistory(input: DueDateHistoryInput): Promise<void> {
  const db = await getKysely();
  await db
    .insertInto('raid_due_date_history')
    .values({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      old_due: input.old_due,
      new_due: input.new_due,
      changed_by: input.changed_by,
    })
    .execute();
}
