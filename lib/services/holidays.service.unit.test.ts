import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  listHolidaysRepo,
  findHolidayByDate,
  createHolidayRepo,
  deleteHolidayRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listHolidaysRepo: vi.fn(),
  findHolidayByDate: vi.fn(),
  createHolidayRepo: vi.fn(),
  deleteHolidayRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/holidays.repo', () => ({
  listHolidays: listHolidaysRepo,
  findHolidayByDate,
  createHoliday: createHolidayRepo,
  deleteHoliday: deleteHolidayRepo,
}));

import { createHoliday, deleteHoliday, listHolidays } from './holidays.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('holidays.service', () => {
  it('listHolidays does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listHolidays(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listHolidaysRepo).not.toHaveBeenCalled();
  });

  it('createHoliday throws ValidationError without date', async () => {
    await expect(createHoliday(7, owner, undefined, 'x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('createHoliday throws ConflictError on duplicate date', async () => {
    findHolidayByDate.mockResolvedValue({ id: 1 });
    await expect(createHoliday(7, owner, '2026-01-01', 'NY')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(createHolidayRepo).not.toHaveBeenCalled();
  });

  it('createHoliday does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(createHoliday(7, foreign, '2026-01-01', 'NY')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(findHolidayByDate).not.toHaveBeenCalled();
  });

  it('deleteHoliday throws NotFoundError on zero changes', async () => {
    deleteHolidayRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
    await expect(deleteHoliday(7, owner, '99')).rejects.toBeInstanceOf(NotFoundError);
  });
});
