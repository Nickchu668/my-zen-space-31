import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { 
  Settings, 
  Users, 
  FileText, 
  Plus,
  Trash2,
  Edit3,
  Save,
  Shield,
  Crown,
  User,
  CheckCircle,
  XCircle,
  Key,
  PenLine
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_approved: boolean;
  created_at: string;
}

interface Page {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
  content: string | null;
  is_active: boolean;
  min_role: string;
  sort_order: number;
}

interface UserPageAccess {
  id: string;
  user_id: string;
  page_id: string;
  can_view: boolean;
  can_edit: boolean;
}

export function AdminPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [userPageAccess, setUserPageAccess] = useState<UserPageAccess[]>([]);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newPage, setNewPage] = useState({ title: '', slug: '', icon: 'file-text', description: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchPages();
    fetchUserPageAccess();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, email, display_name, is_approved, created_at');

    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .maybeSingle();

          return {
            id: profile.user_id,
            email: profile.email,
            display_name: profile.display_name,
            role: roleData?.role || 'member',
            is_approved: profile.is_approved ?? false,
            created_at: profile.created_at,
          };
        })
      );
      setUsers(usersWithRoles);
    }
  };

  const fetchPages = async () => {
    const { data } = await supabase
      .from('pages')
      .select('*')
      .order('sort_order');
    
    if (data) {
      setPages(data.map(page => ({
        ...page,
        content: typeof page.content === 'string' ? page.content : null,
      })));
    }
  };

  const fetchUserPageAccess = async () => {
    const { data } = await supabase
      .from('user_page_access')
      .select('*');
    
    if (data) setUserPageAccess(data);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'premium' | 'member') => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    const { error } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: newRole,
    });

    if (error) {
      toast({ title: '更新失敗', variant: 'destructive' });
    } else {
      toast({ title: '角色已更新' });
      fetchUsers();
    }
  };

  const toggleUserApproval = async (userId: string, currentApproval: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: !currentApproval })
      .eq('user_id', userId);

    if (error) {
      toast({ title: '更新失敗', variant: 'destructive' });
    } else {
      toast({ title: currentApproval ? '已撤銷用戶權限' : '已批准用戶' });
      fetchUsers();
    }
  };

  const updatePageAccess = async (userId: string, pageId: string, field: 'can_view' | 'can_edit', value: boolean) => {
    const existing = userPageAccess.find(a => a.user_id === userId && a.page_id === pageId);
    
    if (existing) {
      const { error } = await supabase
        .from('user_page_access')
        .update({ [field]: value })
        .eq('id', existing.id);
      
      if (error) {
        toast({ title: '更新失敗', variant: 'destructive' });
      } else {
        toast({ title: '權限已更新' });
        fetchUserPageAccess();
      }
    } else {
      const { error } = await supabase
        .from('user_page_access')
        .insert({
          user_id: userId,
          page_id: pageId,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
        });
      
      if (error) {
        toast({ title: '更新失敗', variant: 'destructive' });
      } else {
        toast({ title: '權限已更新' });
        fetchUserPageAccess();
      }
    }
  };

  const getPageAccess = (userId: string, pageId: string): UserPageAccess | undefined => {
    return userPageAccess.find(a => a.user_id === userId && a.page_id === pageId);
  };

  const createPage = async () => {
    if (!newPage.title || !newPage.slug) {
      toast({ title: '請填寫標題和路徑', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('pages').insert({
      title: newPage.title,
      slug: newPage.slug,
      icon: newPage.icon,
      description: newPage.description,
      sort_order: pages.length,
    });

    if (error) {
      toast({ title: '創建失敗', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '頁面已創建' });
      setNewPage({ title: '', slug: '', icon: 'file-text', description: '' });
      setIsCreatingPage(false);
      fetchPages();
      window.dispatchEvent(new CustomEvent('pages-updated'));
    }
  };

  const updatePage = async (page: Page) => {
    const { error } = await supabase
      .from('pages')
      .update({
        title: page.title,
        slug: page.slug,
        icon: page.icon,
        description: page.description,
        content: page.content,
        is_active: page.is_active,
        min_role: page.min_role as 'admin' | 'premium' | 'member',
      })
      .eq('id', page.id);

    if (error) {
      toast({ title: '更新失敗', variant: 'destructive' });
    } else {
      toast({ title: '頁面已更新' });
      setEditingPage(null);
      fetchPages();
      window.dispatchEvent(new CustomEvent('pages-updated'));
    }
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase.from('pages').delete().eq('id', id);

    if (error) {
      toast({ title: '刪除失敗', variant: 'destructive' });
    } else {
      toast({ title: '頁面已刪除' });
      fetchPages();
      window.dispatchEvent(new CustomEvent('pages-updated'));
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'premium': return <Crown className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-admin';
      case 'premium': return 'badge-premium';
      default: return 'badge-member';
    }
  };

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <Settings className="w-7 h-7 text-accent-foreground" />
          </div>
          <div>
            <h1 className="section-title mb-1">管理設定</h1>
            <p className="text-muted-foreground">管理用戶權限和頁面設置</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              用戶管理
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <Key className="w-4 h-4" />
              權限授權
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-2">
              <FileText className="w-4 h-4" />
              頁面管理
            </TabsTrigger>
          </TabsList>

          {/* Users Management Tab */}
          <TabsContent value="users">
            <Card className="card-fun">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  用戶管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用戶</TableHead>
                      <TableHead>電郵</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>加入日期</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.display_name || user.email.split('@')[0]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeClass(user.role)}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1">
                              {user.role === 'admin' ? '管理員' : user.role === 'premium' ? '高級會員' : '會員'}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.is_approved ? 'default' : 'secondary'}
                            className={user.is_approved ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-amber-500/10 text-amber-600 border-amber-200'}
                          >
                            {user.is_approved ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                已批准
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                待審核
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('zh-TW')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(value) => updateUserRole(user.id, value as 'admin' | 'premium' | 'member')}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">管理員</SelectItem>
                                <SelectItem value="premium">高級會員</SelectItem>
                                <SelectItem value="member">會員</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant={user.is_approved ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => toggleUserApproval(user.id, user.is_approved)}
                              className={!user.is_approved ? 'gradient-primary text-primary-foreground' : ''}
                            >
                              {user.is_approved ? '撤銷' : '批准'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Management Tab */}
          <TabsContent value="access">
            <Card className="card-fun">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  權限授權
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label>選擇用戶</Label>
                  <Select
                    value={selectedUser?.id || ''}
                    onValueChange={(value) => setSelectedUser(users.find(u => u.id === value) || null)}
                  >
                    <SelectTrigger className="w-full max-w-sm mt-2">
                      <SelectValue placeholder="選擇要管理權限的用戶" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => u.role !== 'admin').map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{user.display_name || user.email.split('@')[0]}</span>
                            <Badge className={`${getRoleBadgeClass(user.role)} text-xs`}>
                              {user.role === 'premium' ? '高級會員' : '會員'}
                            </Badge>
                            {!user.is_approved && (
                              <Badge variant="secondary" className="text-xs">待審核</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedUser && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {getRoleIcon(selectedUser.role)}
                      </div>
                      <div>
                        <p className="font-medium">{selectedUser.display_name || selectedUser.email.split('@')[0]}</p>
                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                      <Badge className={getRoleBadgeClass(selectedUser.role)}>
                        {selectedUser.role === 'premium' ? '高級會員' : '會員'}
                      </Badge>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>頁面</TableHead>
                          <TableHead className="text-center">可瀏覽</TableHead>
                          <TableHead className="text-center">
                            可編輯
                            {selectedUser.role === 'member' && (
                              <span className="block text-xs text-muted-foreground font-normal">
                                (僅限高級會員)
                              </span>
                            )}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pages.map((page) => {
                          const access = getPageAccess(selectedUser.id, page.id);
                          return (
                            <TableRow key={page.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{page.title}</p>
                                  <p className="text-sm text-muted-foreground">/app/{page.slug}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={access?.can_view || false}
                                  onCheckedChange={(checked) => 
                                    updatePageAccess(selectedUser.id, page.id, 'can_view', !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={access?.can_edit || false}
                                  onCheckedChange={(checked) => 
                                    updatePageAccess(selectedUser.id, page.id, 'can_edit', !!checked)
                                  }
                                  disabled={selectedUser.role === 'member'}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {!selectedUser && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>請選擇用戶以管理其頁面權限</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pages Management Tab */}
          <TabsContent value="pages">
            <Card className="card-fun">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  頁面管理
                </CardTitle>
                <Dialog open={isCreatingPage} onOpenChange={setIsCreatingPage}>
                  <DialogTrigger asChild>
                    <Button className="btn-fun gradient-primary text-primary-foreground gap-2">
                      <Plus className="w-4 h-4" />
                      新增頁面
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新增頁面</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>頁面標題</Label>
                        <Input
                          value={newPage.title}
                          onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                          placeholder="例：我的資料"
                          className="input-fun"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>URL 路徑</Label>
                        <Input
                          value={newPage.slug}
                          onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                          placeholder="例：my-data"
                          className="input-fun"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>描述</Label>
                        <Input
                          value={newPage.description}
                          onChange={(e) => setNewPage({ ...newPage, description: e.target.value })}
                          placeholder="頁面描述"
                          className="input-fun"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsCreatingPage(false)}>
                          取消
                        </Button>
                        <Button onClick={createPage} className="gradient-primary text-primary-foreground">
                          創建
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>頁面</TableHead>
                      <TableHead>路徑</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((page) => (
                      <TableRow key={page.id}>
                        <TableCell className="font-medium">{page.title}</TableCell>
                        <TableCell className="text-muted-foreground">/app/{page.slug}</TableCell>
                        <TableCell>
                          <Badge variant={page.is_active ? 'default' : 'secondary'}>
                            {page.is_active ? '啟用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingPage(page)}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePage(page.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Page Dialog */}
        <Dialog open={!!editingPage} onOpenChange={() => setEditingPage(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="w-5 h-5" />
                編輯頁面
              </DialogTitle>
            </DialogHeader>
            {editingPage && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>頁面標題</Label>
                    <Input
                      value={editingPage.title}
                      onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                      className="input-fun"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL 路徑</Label>
                    <Input
                      value={editingPage.slug}
                      onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                      className="input-fun"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Input
                    value={editingPage.description || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, description: e.target.value })}
                    className="input-fun"
                  />
                </div>
                <div className="space-y-2">
                  <Label>頁面內容</Label>
                  <RichTextEditor
                    content={editingPage.content || ''}
                    onChange={(content) => setEditingPage({ ...editingPage, content })}
                    placeholder="在此編輯頁面內容..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setEditingPage(null)}>
                    取消
                  </Button>
                  <Button onClick={() => updatePage(editingPage)} className="gradient-primary text-primary-foreground">
                    <Save className="w-4 h-4 mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
