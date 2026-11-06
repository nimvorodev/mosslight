import { AlertTriangle, Check, Info } from 'lucide-react';
import type { Toast } from '../lib/useTerrarium';

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          {toast.tone === 'warn' ? (
            <AlertTriangle size={12} />
          ) : toast.tone === 'info' ? (
            <Info size={12} />
          ) : (
            <Check size={12} />
          )}
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
