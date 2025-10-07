import React from 'react';
import { Icon } from './Icon';

interface AvatarProps {
  src?: string | null;
  alt: string;
  className?: string;
  shape?: 'hexagon' | 'circle' | 'square';
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, className = 'w-10 h-10', shape = 'hexagon' }) => {
  const shapeClasses = {
    hexagon: 'shape-hexagon',
    circle: 'rounded-full',
    square: 'rounded-xl',
  };

  const finalClassName = `${className} object-cover shrink-0 ${shapeClasses[shape]}`;

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={finalClassName}
      />
    );
  }

  return (
    <div className={`${className} bg-slate-700 flex items-center justify-center shrink-0 ${shapeClasses[shape]}`}>
      <Icon name="character" className="w-1/2 h-1/2 text-slate-400" />
    </div>
  );
};

export default Avatar;