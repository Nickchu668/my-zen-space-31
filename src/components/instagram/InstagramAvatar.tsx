import { useState, useEffect } from 'react';
import { Instagram } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface InstagramAvatarProps {
  username: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Simple in-memory cache to avoid repeated API calls
const avatarCache: Record<string, string | null> = {};

/**
 * Instagram Avatar component that fetches the profile picture
 * via an edge function (server-side) to bypass CORS issues.
 * Falls back to Instagram icon with user initial on error.
 */
export const InstagramAvatar = ({ username, size = 'md', className = '' }: InstagramAvatarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);

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

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  useEffect(() => {
    if (!username) {
      setIsLoading(false);
      setHasFailed(true);
      return;
    }

    // Check cache first
    if (avatarCache[username] !== undefined) {
      if (avatarCache[username]) {
        setAvatarUrl(avatarCache[username]);
        setIsLoading(false);
      } else {
        setHasFailed(true);
        setIsLoading(false);
      }
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const fetchAvatar = async () => {
      // Set a 8 second timeout for the entire fetch operation
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), 8000);
      });

      // Try client-side sources first (faster)
      const clientSources = [
        `https://unavatar.io/instagram/${username}?fallback=false`,
      ];

      for (const src of clientSources) {
        if (cancelled) return;
        
        try {
          const img = new Image();
          const loaded = await Promise.race([
            new Promise<boolean>((resolve) => {
              img.onload = () => resolve(true);
              img.onerror = () => resolve(false);
              img.src = src;
            }),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
          ]);
          
          if (loaded && !cancelled) {
            clearTimeout(timeoutId);
            avatarCache[username] = src;
            setAvatarUrl(src);
            setIsLoading(false);
            return;
          }
        } catch {
          // Continue to next source
        }
      }

      // All client sources failed, try edge function with timeout
      if (!cancelled) {
        try {
          const result = await Promise.race([
            supabase.functions.invoke('fetch-instagram-avatar', {
              body: { username },
            }),
            timeoutPromise.then(() => ({ data: null, error: new Error('Timeout') })),
          ]);

          clearTimeout(timeoutId);

          if (!cancelled) {
            const { data, error } = result as { data: { success: boolean; avatarUrl?: string } | null; error: Error | null };
            if (data?.success && data?.avatarUrl) {
              avatarCache[username] = data.avatarUrl;
              setAvatarUrl(data.avatarUrl);
              setIsLoading(false);
            } else {
              avatarCache[username] = null;
              setHasFailed(true);
              setIsLoading(false);
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
          if (!cancelled) {
            console.error('Failed to fetch Instagram avatar:', err);
            avatarCache[username] = null;
            setHasFailed(true);
            setIsLoading(false);
          }
        }
      }
    };

    fetchAvatar();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [username]);

  // Get first letter of username for fallback
  const initial = username ? username[0].toUpperCase() : '?';

  // Render fallback with initial
  const renderFallback = () => (
    <div className={`${sizeClasses[size]} rounded-full shrink-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 ${className}`}>
      <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
        {username ? (
          <span className={`${textSizes[size]} font-bold text-pink-500`}>{initial}</span>
        ) : (
          <Instagram className={`${iconSizes[size]} text-pink-500`} />
        )}
      </div>
    </div>
  );

  // Show fallback if no username or all methods failed
  if (!username || hasFailed) {
    return renderFallback();
  }

  // Loading or has URL
  return (
    <div className={`${sizeClasses[size]} rounded-full shrink-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 ${className}`}>
      <div className="w-full h-full rounded-full overflow-hidden bg-card relative">
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center">
            <Instagram className={`${iconSizes[size]} text-pink-500 animate-pulse`} />
          </div>
        )}
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={`${username} Instagram profile`}
            className={`w-full h-full object-cover absolute inset-0 ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              avatarCache[username] = null;
              setHasFailed(true);
            }}
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
};
