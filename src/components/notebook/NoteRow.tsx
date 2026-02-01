import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Pin, 
  MoreVertical,
  Trash2,
  Edit3,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

interface NoteRowProps {
  note: Note;
  onTogglePin: (note: Note) => void;
  onDelete: (id: string, title: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  isEditing: boolean;
  setEditingId: (id: string | null) => void;
}

export function NoteRow({ 
  note, 
  onTogglePin, 
  onDelete, 
  onUpdate, 
  isEditing, 
  setEditingId 
}: NoteRowProps) {
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate(note.id, { title: editTitle, content: editContent });
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setEditingId(null);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // First update Google Sheet to mark as deleted (use content for matching since title column may be empty)
      const { data, error } = await supabase.functions.invoke('update-google-sheet', {
        body: {
          action: 'markDeleted',
          title: note.title,
          content: note.content, // Send content for matching
          value: '刪除',
        },
      });

      if (error) {
        console.error('Failed to update Google Sheet:', error);
        // Don't show error toast - just log it, note will still be deleted
      } else if (data?.message?.includes('找不到')) {
        // Note wasn't from Google Sheet, no need to update
        console.log('Note not found in Google Sheet (may be local only)');
      } else {
        toast({
          title: '已同步至 Google Sheet',
          description: `「${note.title}」已標記為刪除`,
        });
      }

      // Delete from database regardless
      onDelete(note.id, note.title);
    } catch (err) {
      console.error('Delete error:', err);
      // Still delete from database
      onDelete(note.id, note.title);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-scale-in">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="input-fun font-semibold"
          placeholder="標題"
        />
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="input-fun min-h-[100px] resize-none"
          placeholder="內容"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} className="btn-fun gradient-primary text-primary-foreground">
            保存
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-xl transition-all hover:shadow-md group",
        note.is_pinned && "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Expand toggle */}
        {note.content && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        )}
        
        {/* Pin indicator */}
        {note.is_pinned && (
          <Pin className="w-4 h-4 text-primary flex-shrink-0" />
        )}
        
        {/* Title - clickable to expand */}
        <div 
          className={cn(
            "flex-1 min-w-0",
            note.content && "cursor-pointer"
          )}
          onClick={() => note.content && setIsExpanded(!isExpanded)}
        >
          <h3 className="font-medium text-foreground truncate hover:text-primary transition-colors">
            {note.title}
          </h3>
        </div>

        {/* Date */}
        <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
          {new Date(note.updated_at).toLocaleDateString('zh-TW')}
        </span>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex-shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingId(note.id)}>
              <Edit3 className="w-4 h-4 mr-2" />
              編輯
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTogglePin(note)}>
              <Pin className="w-4 h-4 mr-2" />
              {note.is_pinned ? '取消釘選' : '釘選'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive" disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {isDeleting ? '刪除中...' : '刪除'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Expanded content */}
      {isExpanded && note.content && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-3">
            {note.content}
          </p>
        </div>
      )}
    </div>
  );
}
