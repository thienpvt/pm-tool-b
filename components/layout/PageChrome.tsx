import Sidebar from '@/components/layout/Sidebar';

export function PageChrome({
  children,
  projectId,
  mainClassName = 'flex-1 overflow-auto',
}: {
  children: React.ReactNode;
  projectId?: string;
  mainClassName?: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={projectId} />
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
