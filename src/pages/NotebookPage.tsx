import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheetSync } from '@/hooks/useGoogleSheetSync';
import { SyncStatusBadge } from '@/components/notebook/SyncStatusBadge';
import { NoteRow } from '@/components/notebook/NoteRow';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Pin, 
  X,
  Check
} from 'lucide-react';
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

export function NotebookPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { isSyncing, lastSyncTime, error: syncError, sync } = useGoogleSheetSync(isAdmin);

  useEffect(() => {
    if (user && isAdmin) fetchNotes();
  }, [user, isAdmin]);

  // Refetch notes after sync
  useEffect(() => {
    if (lastSyncTime && isAdmin) {
      fetchNotes();
    }
  }, [lastSyncTime, isAdmin]);

  // Only admin can access this page
  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="max-w-4xl mx-auto">
          <Card className="card-fun">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">無權限訪問</h3>
              <p className="text-muted-foreground">此頁面僅限管理員使用</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (data) setNotes(data);
    if (error) console.error('Error fetching notes:', error);
  };

  const createNote = async () => {
    if (!newTitle.trim()) {
      toast({ title: '請輸入標題', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('notes').insert({
      user_id: user?.id,
      title: newTitle,
      content: newContent,
    });

    if (error) {
      toast({ title: '創建失敗', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '筆記已創建' });
      setNewTitle('');
      setNewContent('');
      setIsCreating(false);
      fetchNotes();
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const { error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: '更新失敗', variant: 'destructive' });
    } else {
      fetchNotes();
    }
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);

    if (error) {
      toast({ title: '刪除失敗', variant: 'destructive' });
    } else {
      toast({ title: '筆記已刪除' });
      fetchNotes();
    }
  };

  const togglePin = async (note: Note) => {
    await updateNote(note.id, { is_pinned: !note.is_pinned });
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(n => n.is_pinned);
  const otherNotes = filteredNotes.filter(n => !n.is_pinned);

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="section-title mb-1">記事簿</h1>
              <p className="text-muted-foreground">記錄你的想法和筆記</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusBadge
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              error={syncError}
              onSync={sync}
            />
            <Button 
              onClick={() => setIsCreating(true)}
              className="btn-fun gradient-primary text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新增筆記</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋筆記..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 input-fun"
          />
        </div>

        {/* Create note form */}
        {isCreating && (
          <Card className="card-fun mb-6 animate-scale-in">
            <CardContent className="p-6 space-y-4">
              <Input
                placeholder="筆記標題"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="input-fun text-lg font-semibold"
                autoFocus
              />
              <Textarea
                placeholder="寫下你的想法..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="input-fun min-h-[120px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle('');
                    setNewContent('');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  取消
                </Button>
                <Button onClick={createNote} className="btn-fun gradient-primary text-primary-foreground">
                  <Check className="w-4 h-4 mr-1" />
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pinned notes */}
        {pinnedNotes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Pin className="w-4 h-4" />
              已釘選 ({pinnedNotes.length})
            </h2>
            <div className="space-y-2">
              {pinnedNotes.map((note) => (
                <NoteRow 
                  key={note.id} 
                  note={note} 
                  onTogglePin={togglePin}
                  onDelete={deleteNote}
                  onUpdate={updateNote}
                  isEditing={editingId === note.id}
                  setEditingId={setEditingId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other notes */}
        {otherNotes.length > 0 && (
          <div>
            {pinnedNotes.length > 0 && (
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                其他筆記 ({otherNotes.length})
              </h2>
            )}
            <div className="space-y-2">
              {otherNotes.map((note) => (
                <NoteRow 
                  key={note.id} 
                  note={note} 
                  onTogglePin={togglePin}
                  onDelete={deleteNote}
                  onUpdate={updateNote}
                  isEditing={editingId === note.id}
                  setEditingId={setEditingId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredNotes.length === 0 && !isCreating && (
          <Card className="card-fun">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">尚無筆記</h3>
              <p className="text-muted-foreground mb-4">開始創建你的第一個筆記吧！</p>
              <Button 
                onClick={() => setIsCreating(true)}
                className="btn-fun gradient-primary text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                新增筆記
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notes count */}
        {filteredNotes.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            共 {filteredNotes.length} 筆記錄
          </div>
        )}
      </div>
    </div>
  );
}
