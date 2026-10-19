import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = 'w-8 h-8',
  size,
  color = '#B32D24',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      <path
        d="M 83.08 34.57 A 36.5 36.5 0 1 0 83.08 65.43"
        stroke={color}
        strokeWidth="14.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="7.5" fill={color} />
    </svg>
  );
};
