import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2 } from 'lucide-react';

interface PageData {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description: string | null;
  content: any;
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
      setPage(data);
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

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <FileText className="w-7 h-7 text-accent-foreground" />
          </div>
          <div>
            <h1 className="section-title mb-1">{page.title}</h1>
            {page.description && (
              <p className="text-muted-foreground">{page.description}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-gray dark:prose-invert max-w-none">
          {Array.isArray(page.content) && page.content.length > 0 ? (
            page.content.map((block: any, index: number) => (
              <div key={index} className="mb-4">
                {block.type === 'text' && <p>{block.content}</p>}
                {block.type === 'heading' && <h2>{block.content}</h2>}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-xl">
              <p className="text-muted-foreground">此頁面尚無內容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
