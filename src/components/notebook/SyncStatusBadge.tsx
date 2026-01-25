import { RefreshCw, CheckCircle, AlertCircle, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SyncStatusBadgeProps {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  onSync: () => void;
}

export function SyncStatusBadge({ 
  isSyncing, 
  lastSyncTime, 
  error, 
  onSync 
}: SyncStatusBadgeProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className={cn(
              "gap-2 transition-all",
              error && "border-destructive/50 text-destructive",
              !error && lastSyncTime && "border-primary/50 text-primary"
            )}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">同步中...</span>
              </>
            ) : error ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span className="hidden sm:inline">同步失敗</span>
              </>
            ) : lastSyncTime ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{formatTime(lastSyncTime)}</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                <span className="hidden sm:inline">Google Sheet</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isSyncing ? (
            <p>正在與 Google Sheet 同步...</p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : lastSyncTime ? (
            <p>上次同步: {formatTime(lastSyncTime)}<br/>點擊手動同步</p>
          ) : (
            <p>點擊從 Google Sheet 同步</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
