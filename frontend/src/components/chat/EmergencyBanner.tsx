import { Link } from 'react-router-dom';
import { AlertTriangle, PhoneCall, X } from 'lucide-react';
import type { EmergencyInfo } from '../../types';

interface EmergencyBannerProps {
  emergency: EmergencyInfo;
  onDismiss?: () => void;
}

export function EmergencyBanner({ emergency, onDismiss }: EmergencyBannerProps) {
  if (!emergency.is_emergency) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-b-2 border-red-600 bg-red-600 px-4 py-3 text-white"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">
              Medical Emergency Detected
              {emergency.category ? ` — ${emergency.category}` : ''}
            </p>
            <p className="mt-0.5 text-sm text-red-50">
              {emergency.message ||
                'Your message indicates a potentially urgent situation. Please seek immediate emergency medical assistance.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50"
          >
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            Call 112
          </a>
          <a
            href="tel:108"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-red-800"
          >
            Ambulance 108
          </a>
          <Link
            to="/emergency"
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold underline hover:text-red-100"
          >
            All Helplines
          </Link>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss emergency alert"
              className="rounded-md p-1 text-red-100 hover:bg-red-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
