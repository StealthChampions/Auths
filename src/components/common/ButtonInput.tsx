import React from 'react';

interface ButtonInputProps {
  type?: 'small' | 'normal';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}

export default function ButtonInput({ 
  type, 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  title
}: ButtonInputProps) {
  const buttonClass = type === 'small' ? 'button-small' : 'button';
  
  return (
    <button
      className={`${buttonClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}