import React from 'react';

interface ToggleInputProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  label?: string;
}

export default function ToggleInput({ 
  checked = false, 
  onChange,
  disabled = false,
  className = '',
  id,
  label
}: ToggleInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.checked);
    }
  };

  return (
    <div className={`toggle-input ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="toggle-checkbox"
      />
      <span className="toggle-slider"></span>
    </div>
  );
}