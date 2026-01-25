import { useState } from 'react';
import { Instagram } from 'lucide-react';

interface InstagramAvatarProps {
  username: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Instagram Avatar component that attempts to load the profile picture
 * using unavatar.io (a public avatar proxy service).
 * Falls back to Instagram icon on error.
 */
export const InstagramAvatar = ({ username, size = 'md', className = '' }: InstagramAvatarProps) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  // If no username or image failed to load, show fallback
  if (!username || imageError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full shrink-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 ${className}`}>
        <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
          <Instagram className={`${iconSizes[size]} text-pink-500`} />
        </div>
      </div>
    );
  }

  // Use unavatar.io - a public avatar aggregation service
  // It supports Instagram and caches results
  const avatarUrl = `https://unavatar.io/instagram/${username}?fallback=false`;

  return (
    <div className={`${sizeClasses[size]} rounded-full shrink-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 ${className}`}>
      <div className="w-full h-full rounded-full overflow-hidden bg-card">
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center">
            <Instagram className={`${iconSizes[size]} text-pink-500 animate-pulse`} />
          </div>
        )}
        <img
          src={avatarUrl}
          alt={`${username} Instagram profile`}
          className={`w-full h-full object-cover ${isLoading ? 'hidden' : 'block'}`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setImageError(true);
          }}
        />
      </div>
    </div>
  );
};
