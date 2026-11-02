import React from 'react';

interface AvatarProps {
  name: string;
  photoURL?: string;
  className: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, photoURL, className }) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return photoURL ? (
    <img src={photoURL} alt={name} className={`${className} object-cover`} />
  ) : (
    <span
      role="img"
      aria-label={name}
      className={`${className} inline-flex items-center justify-center bg-orange-100 text-[#F37A1F] font-bold`}
    >
      {initials}
    </span>
  );
};
