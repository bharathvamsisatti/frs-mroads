import React from 'react';

interface AnimatedButtonProps {
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  type = 'button',
  loading = false,
  disabled = false,
  children,
  className = '',
  onClick,
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full cursor-pointer rounded-lg border border-primary bg-primary p-3 text-white font-medium transition-all duration-200 transform ${
        isDisabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-opacity-90 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg'
      } ${className}`}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && (
          <svg
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </span>
    </button>
  );
};

export default AnimatedButton;

