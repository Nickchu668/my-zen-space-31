import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
}

interface SyncStats {
  total: number;
  inserted: number;
  skipped: number;
}

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useGoogleSheetSync(enabled: boolean = true) {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  });
  const { toast } = useToast();

  const sync = useCallback(async (): Promise<SyncStats | null> => {
    setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('sync-google-sheet');

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSyncState({
        isSyncing: false,
        lastSyncTime: new Date(),
        error: null,
      });

      return data.stats as SyncStats;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '同步失敗';
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: errorMessage,
      }));
      return null;
    }
  }, []);

  const manualSync = useCallback(async () => {
    const stats = await sync();
    if (stats) {
      toast({
        title: '同步完成',
        description: `新增 ${stats.inserted} 筆，跳過 ${stats.skipped} 筆重複`,
      });
    } else if (syncState.error) {
      toast({
        title: '同步失敗',
        description: syncState.error,
        variant: 'destructive',
      });
    }
    return stats;
  }, [sync, syncState.error, toast]);

  // Auto sync on interval
  useEffect(() => {
    if (!enabled) return;

    // Initial sync after a short delay
    const initialTimeout = setTimeout(() => {
      sync();
    }, 2000);

    // Set up interval
    const intervalId = setInterval(() => {
      sync();
    }, SYNC_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [enabled, sync]);

  return {
    ...syncState,
    sync: manualSync,
  };
}
