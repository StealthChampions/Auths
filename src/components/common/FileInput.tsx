import React from 'react';

interface FileInputProps {
  accept?: string;
  onChange?: (file: File) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  label?: string;
}

export default function FileInput({ 
  accept, 
  onChange,
  disabled = false,
  className = '',
  id,
  label
}: FileInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChange) {
      onChange(file);
    }
  };

  return (
    <div className={`file-input ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        type="file"
        id={id}
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="file-input-field"
      />
    </div>
  );
}