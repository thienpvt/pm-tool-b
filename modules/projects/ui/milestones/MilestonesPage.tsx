'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { weightedProgress } from '@/lib/status-weights';
import type { Activity, ActivityItem, Milestone, PickerPhase } from './types';
import { useMilestonesPage } from './useMilestonesPage';
import { useMilestonesActions, computeItemPct } from './useMilestonesActions';
import { blank } from './_components/helpers';
import { MilestonePageHeader, MilestoneList } from './_components/MilestoneList';
import { MilestoneToolbar } from './_components/MilestoneToolbar';
import { MilestoneTree } from './_components/MilestoneTree';
import {
  MilestoneEditDialog,
  ActivityPickerDialog,
  ActivityDetailDialog,
  EpicConfirmDialog,
} from './_components/MilestoneDialogs';

export default function MilestonesPage() {
  const { id } = useParams<{ id: string }>();
  const {
    project, milestones, allActivities, setAllActivities, teamMembers,
    loadMilestones, loadMilestoneItems,
  } = useMilestonesPage(id);

  const [selected, setSelected] = useState<Milestone | null>(null);
  const [milestoneItems, setMilestoneItems] = useState<ActivityItem[]>([]);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(blank());
  const [editingId, setEditingId] = useState<number | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [epicConfirmOpen, setEpicConfirmOpen] = useState(false);
  const [pendingEpic, setPendingEpic] = useState<ActivityItem | null>(null);
  const [collapsedEpics, setCollapsedEpics] = useState<Set<number>>(new Set());

  const [pickerCollapsedPhases, setPickerCollapsedPhases] = useState<Set<string>>(new Set());
  const [pickerCollapsedEpics, setPickerCollapsedEpics] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selected) {
      loadMilestoneItems(selected.id).then(setMilestoneItems);
      setCollapsedEpics(new Set());
    }
  }, [selected, loadMilestoneItems]);

  const actions = useMilestonesActions(
    id, project, selected, milestoneItems, allActivities, setAllActivities,
    setMilestoneItems, setSelected, loadMilestones, loadMilestoneItems,
    setDetailActivity, setEditOpen, setEditForm, setEditingId,
    setEpicConfirmOpen, setPendingEpic,
    editingId, editForm, pendingEpic,
  );

  const toggleEpic = useCallback((epicId: number) => {
    setCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId); else next.add(epicId);
      return next;
    });
  }, []);

  const togglePickerPhase = useCallback((phase: string) => {
    setPickerCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  }, []);

  const togglePickerEpic = useCallback((epicId: number) => {
    setPickerCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId); else next.add(epicId);
      return next;
    });
  }, []);

  const inMilestoneIds = useMemo(() => new Set(milestoneItems.map(e => e.id)), [milestoneItems]);

  const q = search.toLowerCase().trim();
  const matchesQ = useCallback((a: ActivityItem) => {
    if (!q) return true;
    return (
      a.activity.toLowerCase().includes(q) ||
      a.phase.toLowerCase().includes(q) ||
      (a.jira_key ?? '').toLowerCase().includes(q) ||
      (a.no ?? '').toLowerCase().includes(q)
    );
  }, [q]);

  const { filteredPickerEntries } = useMemo(() => {
    const available = allActivities.filter(a => !inMilestoneIds.has(a.id));
    const phases: Record<string, PickerPhase> = {};

    for (const a of available) {
      if (!phases[a.phase]) phases[a.phase] = { epics: [], standalone: [], orphanChildren: [] };
      if (a.no === 'EPIC') phases[a.phase].epics.push({ epic: a, children: [] });
    }
    for (const a of available) {
      if (a.no === 'EPIC') continue;
      if (!phases[a.phase]) phases[a.phase] = { epics: [], standalone: [], orphanChildren: [] };
      if (a.parent_id) {
        const epicGroup = phases[a.phase].epics.find(eg => eg.epic.id === a.parent_id);
        if (epicGroup) epicGroup.children.push(a);
        else phases[a.phase].orphanChildren.push(a);
      } else {
        phases[a.phase].standalone.push(a);
      }
    }

    const filtered = Object.entries(phases).filter(([, g]) =>
      g.epics.some(eg => matchesQ(eg.epic) || eg.children.some(matchesQ)) ||
      g.standalone.some(matchesQ) ||
      g.orphanChildren.some(matchesQ)
    );

    return { filteredPickerEntries: filtered };
  }, [allActivities, inMilestoneIds, matchesQ]);

  const { childrenByParent, displayByPhase, topLevelItems, milestoneLeaves, milestonePct } = useMemo(() => {
    const children: Record<number, ActivityItem[]> = {};
    for (const item of milestoneItems) {
      if (item.parent_id && inMilestoneIds.has(item.parent_id)) {
        (children[item.parent_id] = children[item.parent_id] ?? []).push(item);
      }
    }
    const top = milestoneItems.filter(item => !item.parent_id || !inMilestoneIds.has(item.parent_id));
    const byPhase: Record<string, ActivityItem[]> = {};
    for (const item of top) {
      (byPhase[item.phase] = byPhase[item.phase] ?? []).push(item);
    }
    const leaves = milestoneItems.filter(i => i.no !== 'EPIC');
    const pct = weightedProgress(leaves.map(i => i.status));
    return {
      childrenByParent: children,
      displayByPhase: byPhase,
      topLevelItems: top,
      milestoneLeaves: leaves,
      milestonePct: pct,
    };
  }, [milestoneItems, inMilestoneIds]);

  const itemPct = useCallback(
    (item: ActivityItem) => computeItemPct(item, childrenByParent),
    [childrenByParent],
  );

  const pendingEpicNewChildren = useMemo(() => {
    if (!pendingEpic) return [];
    return allActivities.filter(a => a.parent_id === pendingEpic.id && !inMilestoneIds.has(a.id));
  }, [pendingEpic, allActivities, inMilestoneIds]);

  const handleExportPDF = useCallback(() => {
    actions.exportPDF(displayByPhase, childrenByParent, itemPct, milestonePct);
  }, [actions, displayByPhase, childrenByParent, itemPct, milestonePct]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 overflow-auto">
        <MilestonePageHeader project={project} onCreate={actions.openCreate} />

        <div className="flex gap-0 h-[calc(100vh-73px)]">
          <div className="w-80 border-r border-slate-200 bg-white overflow-y-auto shrink-0">
            <MilestoneList
              milestones={milestones}
              selected={selected}
              onSelect={setSelected}
              onEdit={actions.openEdit}
              onDelete={actions.deleteMilestone}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <>
                <MilestoneToolbar
                  selected={selected}
                  milestoneItems={milestoneItems}
                  milestonePct={milestonePct}
                  milestoneLeavesCount={milestoneLeaves.length}
                  topLevelItems={topLevelItems}
                  childrenByParent={childrenByParent}
                  collapsedEpics={collapsedEpics}
                  onExpandAll={() => setCollapsedEpics(new Set())}
                  onCollapseAll={epicIds => setCollapsedEpics(new Set(epicIds))}
                  onExportPDF={handleExportPDF}
                  onOpenPicker={() => {
                    setSearch('');
                    setPickerCollapsedPhases(new Set());
                    setPickerCollapsedEpics(new Set());
                    setPickerOpen(true);
                  }}
                />
                <MilestoneTree
                  selected={selected}
                  displayByPhase={displayByPhase}
                  childrenByParent={childrenByParent}
                  collapsedEpics={collapsedEpics}
                  itemPct={itemPct}
                  onOpenDetail={actions.openDetail}
                  onRemoveItem={actions.removeItem}
                  onToggleEpic={toggleEpic}
                />
              </>
            ) : (
              <MilestoneTree
                selected={null}
                displayByPhase={{}}
                childrenByParent={{}}
                collapsedEpics={collapsedEpics}
                itemPct={itemPct}
                onOpenDetail={actions.openDetail}
                onRemoveItem={actions.removeItem}
                onToggleEpic={toggleEpic}
              />
            )}
          </div>
        </div>
      </main>

      <MilestoneEditDialog
        open={editOpen}
        editingId={editingId}
        editForm={editForm}
        onOpenChange={setEditOpen}
        onFormChange={setEditForm}
        onSave={actions.saveMilestone}
      />

      <ActivityPickerDialog
        open={pickerOpen}
        selected={selected}
        search={search}
        filteredPickerEntries={filteredPickerEntries}
        allActivities={allActivities}
        pickerCollapsedPhases={pickerCollapsedPhases}
        pickerCollapsedEpics={pickerCollapsedEpics}
        matchesQ={matchesQ}
        onOpenChange={setPickerOpen}
        onSearchChange={setSearch}
        onPickerClick={actions.handlePickerClick}
        onTogglePickerPhase={togglePickerPhase}
        onTogglePickerEpic={togglePickerEpic}
        onPickerCollapseAll={(phases, epicIds) => {
          setPickerCollapsedPhases(new Set(phases));
          setPickerCollapsedEpics(new Set(epicIds));
        }}
        onPickerExpandAll={() => {
          setPickerCollapsedPhases(new Set());
          setPickerCollapsedEpics(new Set());
        }}
      />

      <ActivityDetailDialog
        detailActivity={detailActivity}
        teamMembers={teamMembers}
        projectId={id}
        allActivities={allActivities}
        onClose={() => setDetailActivity(null)}
        onSave={actions.handleDetailSave}
        onViewChild={child => setDetailActivity(child)}
      />

      <EpicConfirmDialog
        open={epicConfirmOpen}
        pendingEpic={pendingEpic}
        pendingEpicNewChildrenCount={pendingEpicNewChildren.length}
        onOpenChange={open => {
          if (!open) { setEpicConfirmOpen(false); setPendingEpic(null); }
        }}
        onConfirm={actions.confirmBulkAdd}
        onCancel={() => { setEpicConfirmOpen(false); setPendingEpic(null); }}
      />
    </div>
  );
}
