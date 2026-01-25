import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2, ExternalLink, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PageData {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
  content: string | null;
  link: string | null;
  category: string | null;
}

export function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchPage(slug);
    }
  }, [slug]);

  const fetchPage = async (pageSlug: string) => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', pageSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      setError('無法載入頁面');
    } else if (!data) {
      setError('頁面不存在');
    } else {
      setPage({
        ...data,
        content: typeof data.content === 'string' ? data.content : null,
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="page-container">
        <div className="max-w-6xl mx-auto text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{error || '頁面不存在'}</h2>
          <p className="text-muted-foreground">請確認頁面網址是否正確</p>
        </div>
      </div>
    );
  }

  // Get content as string - handle both string and JSON formats
  const getContentHtml = (): string | null => {
    if (!page.content) return null;
    if (typeof page.content === 'string') return page.content;
    return null;
  };

  const contentHtml = getContentHtml();

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <FileText className="w-7 h-7 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="section-title">{page.title}</h1>
              {page.category && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {page.category}
                </Badge>
              )}
            </div>
            {page.description && (
              <p className="text-muted-foreground">{page.description}</p>
            )}
          </div>
          {page.link && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(page.link!, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              開啟連結
            </Button>
          )}
        </div>

        {/* Content */}
        {contentHtml ? (
          <div 
            className="prose prose-gray dark:prose-invert max-w-none bg-card rounded-xl p-6 border border-border"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">此頁面尚無內容</p>
          </div>
        )}
      </div>
    </div>
  );
}
