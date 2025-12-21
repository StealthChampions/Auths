import React, { useRef, useEffect } from 'react';

interface TextInputProps {
  label?: string;
  value?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  onChange?: (value: string) => void;
  onEnter?: () => void;
  autofocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function TextInput({ 
  label, 
  value = '', 
  type = 'text',
  onChange,
  onEnter,
  autofocus = false,
  placeholder,
  disabled = false,
  className = ''
}: TextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autofocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autofocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) {
      onEnter();
    }
  };

  return (
    <div className={`text-input ${className}`}>
      {label && <label>{label}</label>}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="input"
      />
    </div>
  );
}