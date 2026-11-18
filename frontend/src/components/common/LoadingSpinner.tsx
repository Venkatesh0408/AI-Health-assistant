import clsx from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  fullScreen = false,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'min-h-screen w-full' : 'py-8',
        className
      )}
    >
      <div
        className={clsx(
          'animate-spin rounded-full border-blue-200 border-t-blue-600',
          sizeClasses[size]
        )}
      />
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  );
}
