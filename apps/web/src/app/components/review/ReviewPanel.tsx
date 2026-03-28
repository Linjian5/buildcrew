import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { CheckCircle, Circle, Clock, Loader2, Send } from 'lucide-react';
import { getReviews, approveReview, rejectReview, type Review } from '../../../lib/api';

interface ReviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  companyId: string;
  onAction?: () => void;
}

const STAGE_KEYS = [
  { key: 'auto_check', labelKey: 'review.stages.autoCheck' },
  { key: 'peer_review', labelKey: 'review.stages.peerReview' },
  { key: 'human_gate', labelKey: 'review.stages.humanGate' },
] as const;

function stageStatus(review: Review | null, stageKey: string): 'passed' | 'active' | 'pending' {
  if (!review) return 'pending';
  const stageOrder = ['auto_check', 'peer_review', 'human_gate'];
  const currentIdx = stageOrder.indexOf(review.stage);
  const thisIdx = stageOrder.indexOf(stageKey);
  if (thisIdx < currentIdx) return 'passed';
  if (thisIdx === currentIdx) return review.status === 'passed' ? 'passed' : 'active';
  return 'pending';
}

export function ReviewPanel({ open, onOpenChange, taskId, companyId, onAction }: ReviewPanelProps) {
  const { t } = useTranslation();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    getReviews(companyId, {})
      .then((reviews) => {
        const match = reviews.find((r) => r.task_id === taskId);
        setReview(match ?? null);
      })
      .catch((err) => {
        console.error('Failed to fetch reviews:', err);
        setReview(null);
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [open, taskId, companyId]);

  const handleApprove = async () => {
    if (!review) return;
    setActing(true);
    try {
      await approveReview(companyId, review.id, comment || undefined);
      onAction?.();
      onOpenChange(false);
    } catch { /* toast error */ }
    finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!review || !comment.trim()) return;
    setActing(true);
    try {
      await rejectReview(companyId, review.id, comment);
      onAction?.();
      onOpenChange(false);
    } catch { /* toast error */ }
    finally { setActing(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] sm:max-w-[640px] bg-card border-border overflow-y-auto scrollbar-thin scrollbar-thin" data-testid="review-panel">
        <SheetHeader>
          <SheetTitle>{t('review.title')}</SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="py-20 text-center text-destructive">
            {t('review.fetchError', 'Failed to load review data.')}
          </div>
        )}

        {!loading && !fetchError && !review && (
          <div className="py-20 text-center text-muted-foreground">
            {t('review.notFound')}
          </div>
        )}

        {!loading && review && (
          <div className="mt-6 space-y-6">
            {/* Pipeline stages */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-4" data-testid="review-stages">
              {STAGE_KEYS.map((stage, i) => {
                const status = stageStatus(review, stage.key);
                return (
                  <div key={stage.key} className="flex items-center gap-2">
                    {i > 0 && <div className="h-px w-8 bg-border" />}
                    <div className="flex items-center gap-2">
                      {status === 'passed' && <CheckCircle className="h-5 w-5 text-secondary" />}
                      {status === 'active' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {status === 'pending' && <Circle className="h-5 w-5 text-muted-foreground" />}
                      <span className={`text-sm font-medium ${
                        status === 'passed' ? 'text-secondary' :
                        status === 'active' ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>
                        {t(stage.labelKey)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Review info */}
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm text-muted-foreground">
                {t('review.stage')}: <span className="font-medium text-foreground">{review.stage.replace('_', ' ')}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {t('review.status')}: <span className={`font-medium ${review.status === 'passed' ? 'text-secondary' : review.status === 'failed' ? 'text-destructive' : 'text-primary'}`}>
                  {review.status}
                </span>
              </div>
              {review.reviewer_agent_id && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {t('review.reviewer')}: <span className="font-medium text-foreground">{review.reviewer_agent_id}</span>
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t('review.comments')}</h3>
              <div className="space-y-3">
                {(review.comments ?? []).map((c, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{c.author}</span>
                      <Clock className="h-3 w-3" />
                      <span>{new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-foreground">{c.content}</p>
                  </div>
                ))}
                {(!review.comments || review.comments.length === 0) && (
                  <p className="text-sm text-muted-foreground">{t('review.noComments')}</p>
                )}
              </div>
            </div>

            {/* Add comment */}
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('review.addCommentPlaceholder')}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button className="rounded-lg bg-muted p-2 text-muted-foreground hover:text-foreground">
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-border pt-4">
              <button
                onClick={handleApprove}
                disabled={acting}
                className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary/90 disabled:opacity-50"
                data-testid="review-approve"
              >
                {acting ? t('review.processing') : t('common.approve')}
              </button>
              <button
                onClick={handleReject}
                disabled={acting || !comment.trim()}
                className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                data-testid="review-reject"
              >
                {t('common.reject')}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
