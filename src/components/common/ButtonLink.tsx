import React from 'react';

interface ButtonLinkProps {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

export default function ButtonLink({ 
  href, 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  target = '_self'
}: ButtonLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  if (href) {
    return (
      <a
        href={href}
        onClick={handleClick}
        className={`button-link ${className}`}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`button-link ${className}`}
    >
      {children}
    </button>
  );
}