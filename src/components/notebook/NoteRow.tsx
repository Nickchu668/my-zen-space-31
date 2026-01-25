import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Pin, 
  MoreVertical,
  Trash2,
  Edit3
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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
  onDelete: (id: string) => void;
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

  const handleSave = () => {
    onUpdate(note.id, { title: editTitle, content: editContent });
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setEditingId(null);
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
        {/* Pin indicator */}
        {note.is_pinned && (
          <Pin className="w-4 h-4 text-primary flex-shrink-0" />
        )}
        
        {/* Title */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">
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
            <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              刪除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
