import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  getProjectRepo,
  updateProjectRepo,
  deleteProjectRepo,
  listProjectsRepo,
  createProjectRepo,
  findProjectByCompanyCode,
  getProgram,
  auditLogFn,
  generateProjectChecklistFn,
  listChecklistByProjectFn,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  getProjectRepo: vi.fn(),
  updateProjectRepo: vi.fn(),
  deleteProjectRepo: vi.fn(),
  listProjectsRepo: vi.fn(),
  createProjectRepo: vi.fn(),
  findProjectByCompanyCode: vi.fn(),
  getProgram: vi.fn(),
  auditLogFn: vi.fn(),
  generateProjectChecklistFn: vi.fn(),
  listChecklistByProjectFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({
  assertProjectAccess,
  assertProjectWriteAccess,
  isCpmo: (actor: { roles?: string[] }) => actor.roles?.includes('cpmo') ?? false,
  hasRole: (actor: { roles?: string[] }, role: string) => actor.roles?.includes(role) ?? false,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
  deleteProject: deleteProjectRepo,
  listProjects: listProjectsRepo,
  createProject: createProjectRepo,
  findProjectByCompanyCode,
}));
vi.mock('@/lib/repositories/programs.repo', () => ({
  getProgram,
}));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({
  auditLog: auditLogFn,
}));
vi.mock('@/lib/services/document-checklist-generate', () => ({
  generateProjectChecklist: generateProjectChecklistFn,
}));
vi.mock('@/lib/repositories/project-document-checklist.repo', () => ({
  listChecklistByProject: listChecklistByProjectFn,
}));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects.service';
import { ConflictError, ForbiddenError, MandatoryIncompleteError, NotFoundError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  generateProjectChecklistFn.mockResolvedValue({ inserted: 0 });
  listChecklistByProjectFn.mockResolvedValue([]);
});

const pmActor = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
  status: 'active' as const,
};
const cpmoActor = {
  ...pmActor,
  roles: ['cpmo'] as const,
  is_admin: 1 as number | boolean,
};
const viewerActor = { ...pmActor, roles: ['viewer'] as const };
const foreign = { ...pmActor, company_id: 9 as number | null };

describe('projects.service', () => {
  describe('getProject', () => {
    it('asserts access before reading', async () => {
      getProjectRepo.mockResolvedValue({ id: 7, name: 'Acme' });
      await expect(getProject(7, pmActor)).resolves.toEqual({ id: 7, name: 'Acme' });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, pmActor);
      expect(getProjectRepo).toHaveBeenCalledWith(7);
    });

    it('throws NotFoundError when the repository returns undefined', async () => {
      getProjectRepo.mockResolvedValue(undefined);
      await expect(getProject(7, pmActor)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(getProject(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(getProjectRepo).not.toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('asserts write access before updating', async () => {
      getProjectRepo.mockResolvedValue({ id: 7, name: 'Before', progress_pct: 50, status: 'Active' });
      updateProjectRepo.mockResolvedValue({ id: 7, name: 'Renamed' });
      await expect(updateProject(7, pmActor, { name: 'Renamed' })).resolves.toEqual({
        id: 7,
        name: 'Renamed',
        warnings: [],
      });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, pmActor);
      expect(updateProjectRepo).toHaveBeenCalledWith(7, { name: 'Renamed' });
    });

    it('calls auditLog action update when general fields change (D-02, D-03)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        name: 'Before',
        status: 'Active',
        rag: 'Green',
        progress_pct: 50,
      });
      updateProjectRepo.mockResolvedValue({ id: 7, name: 'Renamed', status: 'Active', rag: 'Green' });
      await updateProject(7, pmActor, { name: 'Renamed' });
      expect(auditLogFn).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entity_type: 'project',
          entity_id: '7',
          before: expect.objectContaining({ name: 'Before' }),
          after: expect.objectContaining({ name: 'Renamed' }),
        }),
      );
    });

    it('calls auditLog action update when status or rag changes (D-02)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        name: 'Alpha',
        status: 'Active',
        rag: 'Green',
        progress_pct: 50,
      });
      updateProjectRepo.mockResolvedValue({
        id: 7,
        name: 'Alpha',
        status: 'On Hold',
        rag: 'Amber',
      });
      await updateProject(7, pmActor, { status: 'On Hold', rag: 'Amber' });
      expect(auditLogFn).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entity_type: 'project',
          before: expect.objectContaining({ status: 'Active', rag: 'Green' }),
          after: expect.objectContaining({ status: 'On Hold', rag: 'Amber' }),
        }),
      );
    });

    it('strips project_code from PM update payload (D-03)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        project_code: 'PRJ-OLD',
        progress_pct: 50,
        status: 'Active',
      });
      updateProjectRepo.mockResolvedValue({ id: 7, name: 'Renamed', project_code: 'PRJ-OLD' });
      await updateProject(7, pmActor, { name: 'Renamed', project_code: 'PRJ-HACK' });
      expect(updateProjectRepo).toHaveBeenCalledWith(7, { name: 'Renamed' });
      expect(deleteProjectRepo).not.toHaveBeenCalled();
    });

    it('CPMO in-place project_code change audits code_change without deleteProject (D-02, D-19, PROJ-02)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        project_code: 'PRJ-OLD',
        progress_pct: 50,
        status: 'Active',
      });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      updateProjectRepo.mockResolvedValue({ id: 7, project_code: 'PRJ-NEW' });
      await updateProject(7, cpmoActor, { project_code: 'PRJ-NEW' });
      expect(findProjectByCompanyCode).toHaveBeenCalledWith(5, 'PRJ-NEW');
      expect(updateProjectRepo).toHaveBeenCalledWith(7, { project_code: 'PRJ-NEW' });
      expect(deleteProjectRepo).not.toHaveBeenCalled();
      expect(auditLogFn).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'code_change',
          entity_type: 'project',
          entity_id: '7',
          before: { project_code: 'PRJ-OLD' },
          after: { project_code: 'PRJ-NEW' },
        }),
      );
    });

    it('CPMO PATCH duplicate check uses project company_id not actor company (CR-02, D-01)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 99,
        project_code: 'PRJ-OLD',
        progress_pct: 50,
        status: 'Active',
      });
      findProjectByCompanyCode.mockResolvedValue({ id: 88 });
      await expect(updateProject(7, cpmoActor, { project_code: 'PRJ-DUP' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(findProjectByCompanyCode).toHaveBeenCalledWith(99, 'PRJ-DUP');
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('CPMO PATCH rejects empty or whitespace project_code (WR-02, PROJ-01)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        project_code: 'PRJ-OLD',
        progress_pct: 50,
        status: 'Active',
      });
      await expect(updateProject(7, cpmoActor, { project_code: '   ' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('CPMO duplicate project_code throws ConflictError excluding current id (D-01)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        project_code: 'PRJ-OLD',
        progress_pct: 50,
        status: 'Active',
      });
      findProjectByCompanyCode.mockResolvedValue({ id: 99 });
      await expect(updateProject(7, cpmoActor, { project_code: 'PRJ-DUP' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('stage L5 returns id and warnings on 200-shaped object (D-07)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        progress_pct: 40,
        status: 'Active',
        rag: 'Green',
        stage: 'L4',
      });
      updateProjectRepo.mockResolvedValue({
        id: 7,
        stage: 'L5',
        status: 'Completed',
        rag: 'Not applicable',
        progress_pct: 100,
      });
      const result = await updateProject(7, pmActor, { stage: 'L5', status: 'Active', rag: 'Green' });
      expect(result.id).toBe(7);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(updateProjectRepo).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          stage: 'L5',
          status: 'Completed',
          rag: 'Not applicable',
          progress_pct: 100,
        }),
      );
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateProject(7, foreign, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('propagates UnknownColumnError from the repository untouched (REPO-03/T-04-25)', async () => {
      getProjectRepo.mockResolvedValue({ id: 7, progress_pct: 50, status: 'Active' });
      updateProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));
      await expect(updateProject(7, pmActor, { company_id: 99 })).rejects.toBeInstanceOf(
        UnknownColumnError,
      );
    });

    it('L2→L3 with incomplete mandatory L2 row throws MandatoryIncompleteError (D-09)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        stage: 'L2',
        progress_pct: 50,
        status: 'Active',
      });
      listChecklistByProjectFn.mockResolvedValue([
        {
          id: 100,
          catalog_id: 10,
          catalog_name: 'Charter',
          catalog_stage: 'L2',
          catalog_mandatory: true,
          status: 'none',
        },
      ]);
      await expect(updateProject(7, cpmoActor, { stage: 'L3' })).rejects.toBeInstanceOf(
        MandatoryIncompleteError,
      );
      expect(updateProjectRepo).not.toHaveBeenCalled();
      expect(generateProjectChecklistFn).not.toHaveBeenCalled();
    });

    it('destination-stage incomplete rows do not block when current stage is complete (D-09)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        stage: 'L2',
        progress_pct: 50,
        status: 'Active',
      });
      listChecklistByProjectFn.mockResolvedValue([
        {
          id: 100,
          catalog_id: 10,
          catalog_name: 'Charter',
          catalog_stage: 'L2',
          catalog_mandatory: true,
          status: 'approved',
        },
        {
          id: 101,
          catalog_id: 11,
          catalog_name: 'Design Doc',
          catalog_stage: 'L3',
          catalog_mandatory: true,
          status: 'none',
        },
      ]);
      updateProjectRepo.mockResolvedValue({ id: 7, stage: 'L3' });
      await updateProject(7, cpmoActor, { stage: 'L3' });
      expect(updateProjectRepo).toHaveBeenCalled();
      expect(generateProjectChecklistFn).toHaveBeenCalledWith(7, {
        companyId: 5,
        stage: 'L3',
      });
    });

    it('stage-change generate uses project company_id not actor company (CR-01, D-02)', async () => {
      const customerPm = { ...pmActor, company_id: 9 };
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 99,
        stage: 'L2',
        progress_pct: 50,
        status: 'Active',
      });
      listChecklistByProjectFn.mockResolvedValue([
        {
          id: 100,
          catalog_id: 10,
          catalog_name: 'Charter',
          catalog_stage: 'L2',
          catalog_mandatory: true,
          status: 'approved',
        },
      ]);
      updateProjectRepo.mockResolvedValue({ id: 7, stage: 'L3' });
      await updateProject(7, customerPm, { stage: 'L3' });
      expect(generateProjectChecklistFn).toHaveBeenCalledWith(7, {
        companyId: 99,
        stage: 'L3',
      });
    });

    it('null stage treats ALL mandatory rows as current-stage guard (WR-03, D-09)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        stage: null,
        progress_pct: 50,
        status: 'Active',
      });
      listChecklistByProjectFn.mockResolvedValue([
        {
          id: 100,
          catalog_id: 10,
          catalog_name: 'Global Policy',
          catalog_stage: 'ALL',
          catalog_mandatory: true,
          status: 'none',
        },
      ]);
      await expect(updateProject(7, cpmoActor, { stage: 'L2' })).rejects.toBeInstanceOf(
        MandatoryIncompleteError,
      );
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('acknowledge_incomplete_mandatory allows stage write, generate, and auditLog (D-09, D-14)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        stage: 'L2',
        progress_pct: 50,
        status: 'Active',
      });
      listChecklistByProjectFn.mockResolvedValue([
        {
          id: 100,
          catalog_id: 10,
          catalog_name: 'Charter',
          catalog_stage: 'L2',
          catalog_mandatory: true,
          status: 'drafting',
        },
      ]);
      updateProjectRepo.mockResolvedValue({ id: 7, stage: 'L3' });
      await updateProject(7, cpmoActor, {
        stage: 'L3',
        acknowledge_incomplete_mandatory: true,
      });
      expect(updateProjectRepo).toHaveBeenCalledWith(7, { stage: 'L3' });
      expect(generateProjectChecklistFn).toHaveBeenCalledWith(7, {
        companyId: 5,
        stage: 'L3',
      });
      expect(auditLogFn).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'stage_change_ack',
          entity_type: 'project',
          entity_id: '7',
          before: { stage: 'L2' },
          after: { stage: 'L3' },
        }),
      );
    });

    it('acknowledge_incomplete_mandatory is not passed to updateProjectRepo (D-09)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        company_id: 5,
        stage: 'L2',
        progress_pct: 50,
        status: 'Active',
      });
      updateProjectRepo.mockResolvedValue({ id: 7, stage: 'L3' });
      await updateProject(7, cpmoActor, {
        stage: 'L3',
        acknowledge_incomplete_mandatory: false,
      });
      const repoFields = updateProjectRepo.mock.calls[0][1];
      expect(repoFields).not.toHaveProperty('acknowledge_incomplete_mandatory');
    });
  });

  describe('deleteProject', () => {
    it('asserts write access before deleting', async () => {
      deleteProjectRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
      await expect(deleteProject(7, pmActor)).resolves.toEqual({ lastInsertRowid: 0, changes: 1 });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, pmActor);
      expect(deleteProjectRepo).toHaveBeenCalledWith(7);
    });

    it('calls auditLog action delete with before snapshot and after null (D-02, D-03)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        name: 'Alpha',
        project_code: 'PRJ-001',
        status: 'Active',
        rag: 'Green',
        stage: 'L2',
        company_id: 5,
        customer_id: 10,
        portfolio_year: 2026,
      });
      deleteProjectRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
      await deleteProject(7, pmActor);
      expect(getProjectRepo).toHaveBeenCalledWith(7);
      expect(auditLogFn).toHaveBeenCalledWith({
        actor_id: pmActor.user_id,
        company_id: pmActor.company_id,
        entity_type: 'project',
        entity_id: '7',
        action: 'delete',
        before: {
          id: 7,
          name: 'Alpha',
          project_code: 'PRJ-001',
          status: 'Active',
          rag: 'Green',
          stage: 'L2',
          company_id: 5,
          customer_id: 10,
          portfolio_year: 2026,
        },
        after: null,
      });
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteProject(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deleteProjectRepo).not.toHaveBeenCalled();
    });

    it('does not audit when delete affects zero rows (WR-02, D-03)', async () => {
      getProjectRepo.mockResolvedValue({
        id: 7,
        name: 'Alpha',
        project_code: 'PRJ-001',
        status: 'Active',
        rag: 'Green',
        stage: 'L2',
        company_id: 5,
        customer_id: 10,
        portfolio_year: 2026,
      });
      deleteProjectRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
      await expect(deleteProject(7, pmActor)).resolves.toEqual({ lastInsertRowid: 0, changes: 0 });
      expect(deleteProjectRepo).toHaveBeenCalledWith(7);
      expect(auditLogFn).not.toHaveBeenCalled();
    });
  });

  describe('listProjects', () => {
    it('scopes to the actor company for CPMO without global bypass (D-13)', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await expect(listProjects(cpmoActor)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(cpmoActor.company_id);
    });

    it('passes pmUserId for PM-only actors (D-13, PMAS-04)', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listProjects(pmActor)).resolves.toEqual([{ id: 1 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(pmActor.company_id, {
        pmUserId: pmActor.user_id,
      });
    });

    it('uses company filter only for viewer-only (D-13)', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listProjects(viewerActor)).resolves.toEqual([{ id: 1 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(viewerActor.company_id);
    });
  });

  describe('createProject', () => {
    it('throws ForbiddenError for PM (D-13, D-15)', async () => {
      await expect(createProject(pmActor, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
      expect(auditLogFn).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for viewer-only (D-15)', async () => {
      await expect(createProject(viewerActor, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('stamps actor.company_id for CPMO, ignoring body.company_id (D-13)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: cpmoActor.company_id });
      await createProject(cpmoActor, {
        name: 'Alpha',
        company_id: 999,
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
      });
      expect(createProjectRepo).toHaveBeenCalledWith(cpmoActor.company_id, {
        name: 'Alpha',
        company_id: 999,
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
      });
    });

    it('throws ForbiddenError when CPMO has null company_id', async () => {
      const nullCompanyCpmo = { ...cpmoActor, company_id: null };
      await expect(createProject(nullCompanyCpmo, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('propagates UnknownColumnError from the repository untouched', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'PRJ-001',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(UnknownColumnError);
    });

    it('throws ValidationError when project_code is missing (PROJ-01, D-01)', async () => {
      await expect(
        createProject(cpmoActor, { name: 'Alpha', portfolio_year: 2026, customer_id: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ValidationError when portfolio_year is missing (PROJ-01, D-04)', async () => {
      await expect(
        createProject(cpmoActor, { name: 'Alpha', project_code: 'PRJ-001', customer_id: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ValidationError when customer_id is missing (PROJ-01, D-04)', async () => {
      await expect(
        createProject(cpmoActor, { name: 'Alpha', project_code: 'PRJ-001', portfolio_year: 2026 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('creates project with project_code, portfolio_year, and in-company program (D-03, D-04, PROJ-01)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockResolvedValue({
        id: 1,
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
        company_id: cpmoActor.company_id,
        stage: 'L2',
      });
      const result = await createProject(cpmoActor, {
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
        stage: 'L2',
      });
      expect(result.warnings).toEqual([]);
      expect(getProgram).toHaveBeenCalledWith(10);
      expect(findProjectByCompanyCode).toHaveBeenCalledWith(cpmoActor.company_id, 'PRJ-001');
      expect(createProjectRepo).toHaveBeenCalledWith(cpmoActor.company_id, {
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
        stage: 'L2',
      });
      expect(generateProjectChecklistFn).toHaveBeenCalledWith(1, {
        companyId: cpmoActor.company_id,
        stage: 'L2',
      });
      expect(auditLogFn).toHaveBeenCalledWith({
        actor_id: cpmoActor.user_id,
        company_id: cpmoActor.company_id,
        entity_type: 'project',
        entity_id: '1',
        action: 'create',
        before: null,
        after: {
          id: 1,
          name: 'Alpha',
          project_code: 'PRJ-001',
          portfolio_year: 2026,
          customer_id: 10,
          company_id: cpmoActor.company_id,
          stage: 'L2',
          status: undefined,
          rag: undefined,
        },
      });
    });

    it('createProject attaches warnings from applyProjectGovernance (D-07)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockResolvedValue({
        id: 1,
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
        stage: 'L5',
        status: 'Completed',
        rag: 'Not applicable',
        progress_pct: 100,
      });
      const result = await createProject(cpmoActor, {
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
        stage: 'L5',
        status: 'Active',
      });
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('throws ConflictError for duplicate project_code in same company (D-01, PROJ-01)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue({ id: 99 });
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'prj-001',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when program belongs to another company (D-04)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: 99, name: 'Foreign Prog' });
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'PRJ-002',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when program id does not exist (D-04)', async () => {
      getProgram.mockResolvedValue(undefined);
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'PRJ-003',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });
  });
});
