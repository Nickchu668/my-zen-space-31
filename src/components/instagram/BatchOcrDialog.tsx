import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, X, CheckCircle2, XCircle, ImageIcon, ChevronRight, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageItem {
  id: string;
  title: string;
  url: string | null;
  followers_count: string | null;
}

interface ImageMapping {
  file: File;
  previewUrl: string;
  itemId: string | null;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: string;
  error?: string;
}

interface BatchOcrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  igItems: PageItem[];
  onUpdate: (itemId: string, followersCount: string) => void;
}

const getInstagramUsername = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/instagram\.com\/([^/?]+)/);
  return match ? match[1] : null;
};

export function BatchOcrDialog({ open, onOpenChange, igItems, onUpdate }: BatchOcrDialogProps) {
  const [mappings, setMappings] = useState<ImageMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const newMappings: ImageMapping[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      newMappings.push({
        file,
        previewUrl: URL.createObjectURL(file),
        itemId: null,
        status: 'pending',
      });
    }
    setMappings(prev => [...prev, ...newMappings]);
  }, []);

  const removeMapping = useCallback((index: number) => {
    setMappings(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  }, []);

  const setItemForMapping = useCallback((index: number, itemId: string | null) => {
    setMappings(prev => prev.map((m, i) => (i === index ? { ...m, itemId } : m)));
  }, []);

  const canProcess = useMemo(
    () => mappings.length > 0 && mappings.some(m => m.itemId && m.status === 'pending'),
    [mappings]
  );

  const processAll = async () => {
    setIsProcessing(true);

    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      if (!mapping.itemId || mapping.status !== 'pending') continue;

      // Mark as processing
      setMappings(prev => prev.map((m, idx) => (idx === i ? { ...m, status: 'processing' } : m)));

      try {
        const dataUrl = await readFileAsDataUrl(mapping.file);

        const { data, error } = await supabase.functions.invoke('extract-followers-from-image', {
          body: { imageBase64: dataUrl },
        });

        if (error || !data?.success || !data?.followersCount) {
          setMappings(prev =>
            prev.map((m, idx) =>
              idx === i ? { ...m, status: 'error', error: data?.error || error?.message || '辨識失敗' } : m
            )
          );
          continue;
        }

        const raw = String(data.followersCount).trim();
        if (!/^\d+$/.test(raw)) {
          setMappings(prev => prev.map((m, idx) => (idx === i ? { ...m, status: 'error', error: '格式不正確' } : m)));
          continue;
        }

        // Update DB
        const { error: updateError } = await supabase
          .from('page_items')
          .update({ followers_count: raw })
          .eq('id', mapping.itemId);

        if (updateError) {
          setMappings(prev =>
            prev.map((m, idx) => (idx === i ? { ...m, status: 'error', error: updateError.message } : m))
          );
          continue;
        }

        setMappings(prev =>
          prev.map((m, idx) => (idx === i ? { ...m, status: 'success', result: raw } : m))
        );
        onUpdate(mapping.itemId, raw);
      } catch (e: any) {
        setMappings(prev =>
          prev.map((m, idx) => (idx === i ? { ...m, status: 'error', error: e?.message || '未知錯誤' } : m))
        );
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    setIsProcessing(false);
    const successCount = mappings.filter(m => m.status === 'success' || (m.itemId && m.status === 'pending')).length;
    toast.success(`批量辨識完成`);
  };

  const reset = () => {
    mappings.forEach(m => URL.revokeObjectURL(m.previewUrl));
    setMappings([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            批量截圖辨識追蹤者數量
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* File upload area */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="batch-ocr-input"
              onChange={e => {
                handleFilesSelected(e.target.files);
                e.currentTarget.value = '';
              }}
            />
            <label htmlFor="batch-ocr-input" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">點擊選擇多張截圖，或拖放到此處</p>
              <p className="text-xs text-muted-foreground mt-1">每張截圖應包含一個 IG 帳號的追蹤者數量</p>
            </label>
          </div>

          {/* Mappings list */}
          {mappings.length > 0 && (
            <ScrollArea className="flex-1 max-h-[40vh]">
              <div className="space-y-3 pr-3">
                {mappings.map((mapping, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      mapping.status === 'success' && 'border-green-500/50 bg-green-500/5',
                      mapping.status === 'error' && 'border-destructive/50 bg-destructive/5',
                      mapping.status === 'processing' && 'border-primary/50 bg-primary/5',
                      mapping.status === 'pending' && 'border-border bg-card'
                    )}
                  >
                    {/* Image preview */}
                    <img
                      src={mapping.previewUrl}
                      alt={`截圖 ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-md shrink-0"
                    />

                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />

                    {/* Item selector */}
                    <div className="flex-1 min-w-0">
                      {mapping.status === 'pending' ? (
                        <select
                          value={mapping.itemId || ''}
                          onChange={e => setItemForMapping(index, e.target.value || null)}
                          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">選擇對應的 IG 帳號...</option>
                          {igItems.map(item => (
                            <option key={item.id} value={item.id}>
                              @{getInstagramUsername(item.url) || item.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                          <span className="text-sm font-medium truncate">
                            @{getInstagramUsername(igItems.find(i => i.id === mapping.itemId)?.url || null) || '—'}
                          </span>
                        </div>
                      )}

                      {mapping.status === 'success' && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ 追蹤者: {parseInt(mapping.result!, 10).toLocaleString('en-US')}
                        </p>
                      )}
                      {mapping.status === 'error' && (
                        <p className="text-xs text-destructive mt-1">✗ {mapping.error}</p>
                      )}
                    </div>

                    {/* Status / remove */}
                    <div className="shrink-0">
                      {mapping.status === 'pending' && (
                        <Button variant="ghost" size="icon" onClick={() => removeMapping(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {mapping.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                      {mapping.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {mapping.status === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {mappings.length} 張截圖，{mappings.filter(m => m.itemId).length} 張已對應
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>
              取消
            </Button>
            <Button onClick={processAll} disabled={!canProcess || isProcessing} className="gap-2">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>開始辨識</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
