import React, { useState, useRef } from 'react';

interface AnimatedInputProps {
  type?: string;
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

const AnimatedInput: React.FC<AnimatedInputProps> = ({
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  className = '',
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label
          className={`mb-2 block text-sm font-medium transition-all duration-200 ${
            error
              ? 'text-red-600 dark:text-red-400'
              : isFocused
              ? 'text-primary dark:text-primary'
              : 'text-black dark:text-white'
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full rounded-lg border bg-transparent py-3 px-4 text-black outline-none transition-all duration-200 dark:text-white ${
            error
              ? 'border-red-500 focus:border-red-600 dark:border-red-500 dark:focus:border-red-400'
              : isFocused
              ? 'border-primary focus:border-primary dark:border-primary dark:focus:border-primary'
              : 'border-stroke dark:border-form-strokedark'
          } ${
            disabled
              ? 'cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-800'
              : 'dark:bg-form-input'
          } focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/30`}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400 animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
};

export default AnimatedInput;

