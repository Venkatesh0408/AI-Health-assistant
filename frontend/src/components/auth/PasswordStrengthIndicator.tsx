import { Check, Circle } from 'lucide-react';
import clsx from 'clsx';
import { getPasswordStrength } from '../../utils/validators';

interface PasswordStrengthIndicatorProps {
  password: string;
}

const barColors: Record<number, string> = {
  0: 'bg-gray-200',
  1: 'bg-red-500',
  2: 'bg-amber-500',
  3: 'bg-blue-500',
  4: 'bg-emerald-600',
};

const labelColors: Record<number, string> = {
  0: 'text-gray-500',
  1: 'text-red-600',
  2: 'text-amber-700',
  3: 'text-blue-700',
  4: 'text-emerald-700',
};

export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  const { score, label, checks } = getPasswordStrength(password);

  if (!password) return null;

  const requirements = [
    { key: 'minLength', label: 'At least 8 characters', met: checks.minLength },
    { key: 'upper', label: 'One uppercase letter', met: checks.hasUppercase },
    { key: 'lower', label: 'One lowercase letter', met: checks.hasLowercase },
    { key: 'number', label: 'One number', met: checks.hasNumber },
    { key: 'special', label: 'One special character (recommended)', met: checks.hasSpecial },
  ];

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">Password strength</span>
        <span className={clsx('font-semibold', labelColors[score])}>{label}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5" role="presentation">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={clsx(
              'h-1.5 rounded-full transition-colors',
              score >= step ? barColors[score] : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2">
        {requirements.map((req) => (
          <li
            key={req.key}
            className={clsx(
              'flex items-center gap-1.5 text-xs',
              req.met ? 'text-emerald-700' : 'text-gray-500'
            )}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
