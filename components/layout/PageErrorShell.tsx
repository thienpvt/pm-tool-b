import { AlertTriangle } from 'lucide-react';

export function PageErrorShell({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4">
      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}
