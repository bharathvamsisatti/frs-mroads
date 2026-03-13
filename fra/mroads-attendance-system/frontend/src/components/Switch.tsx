import React from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, className = '', disabled = false }) => {
  return (
    <label className={`flex cursor-pointer select-none items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onCheckedChange(e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div className={`block h-8 w-14 rounded-full transition ${checked ? 'bg-primary' : 'bg-meta-9 dark:bg-[#5A616B]'} ${className}`}></div>
        <div
          className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition ${
            checked ? '!right-1 !translate-x-full' : ''
          }`}
        ></div>
      </div>
    </label>
  );
};

export default Switch;

