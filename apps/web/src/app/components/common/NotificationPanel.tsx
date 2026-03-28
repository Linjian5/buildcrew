import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { getPendingApprovals, approveItem, rejectItem, type Approval } from '../../../lib/api';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

type TabId = 'all' | 'unread' | 'approvals' | 'alerts' | 'system';

interface Notification {
  id: string;
  type: 'approval' | 'alert' | 'completion' | 'system';
  title: string;
  description: string;
  time: string;
  unread: boolean;
  approval?: Approval;
}

// No hardcoded notifications — all from API

export function NotificationPanel({ open, onClose, companyId }: NotificationPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [, setApprovals] = useState<Approval[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const TABS: { id: TabId; label: string }[] = [
    { id: 'all', label: t('notifications.tabs.all', 'All') },
    { id: 'unread', label: t('notifications.tabs.unread', 'Unread') },
    { id: 'approvals', label: t('notifications.tabs.approvals', 'Approvals') },
    { id: 'alerts', label: t('notifications.tabs.alerts', 'Alerts') },
    { id: 'system', label: t('notifications.tabs.system', 'System') },
  ];

  useEffect(() => {
    if (!open) return;
    getPendingApprovals(companyId)
      .then((data) => {
        setApprovals(data);
        const approvalNotifs: Notification[] = data.map((a) => ({
          id: `approval-${a.id}`,
          type: 'approval' as const,
          title: t('notifications.approvalRequired', 'Approval Required'),
          description: a.description || a.title,
          time: a.created_at ? new Date(a.created_at).toLocaleString() : 'Just now',
          unread: true,
          approval: a,
        }));
        setNotifications(approvalNotifs);
      })
      .catch((err) => {
        console.error('Failed to fetch pending approvals:', err);
        setFetchError(true);
      });
  }, [open, companyId, t]);

  const markAllRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  const filtered = notifications.filter((n) => {
    const isUnread = n.unread && !readIds.has(n.id);
    switch (activeTab) {
      case 'unread': return isUnread;
      case 'approvals': return n.type === 'approval';
      case 'alerts': return n.type === 'alert';
      case 'system': return n.type === 'system';
      default: return true;
    }
  });

  const unreadCount = notifications.filter((n) => n.unread && !readIds.has(n.id)).length;

  const handleApprove = async (approval: Approval) => {
    await approveItem(approval.id);
    setNotifications((prev) => prev.filter((n) => n.id !== `approval-${approval.id}`));
    setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
  };

  const handleReject = async (approval: Approval) => {
    await rejectItem(approval.id);
    setNotifications((prev) => prev.filter((n) => n.id !== `approval-${approval.id}`));
    setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-12 z-50 w-[400px] rounded-xl border border-border bg-card shadow-lg"
        data-testid="notification-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={markAllRead} className="text-xs text-primary hover:underline">
            {t('common.markAllRead')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`notification-tab-${tab.id}`}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {fetchError && (
            <div className="px-4 py-3 text-sm text-destructive">{t('notifications.fetchError', 'Failed to load notifications.')}</div>
          )}
          {!fetchError && filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('notifications.noNotifications', 'No notifications')}</div>
          )}
          {filtered.map((n) => {
            const isUnread = n.unread && !readIds.has(n.id);
            return (
              <div
                key={n.id}
                className={`border-b border-border p-4 transition-colors hover:bg-muted/50 ${
                  isUnread ? 'border-l-[3px] border-l-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {n.type === 'approval' && <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                  {n.type === 'alert' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                  {n.type === 'completion' && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />}
                  {n.type === 'system' && <Settings className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>

                    {n.type === 'approval' && n.approval && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleApprove(n.approval!)}
                          className="rounded-md border border-secondary px-2.5 py-1 text-xs font-medium text-secondary hover:bg-secondary/10"
                          data-testid={`notif-approve-${n.approval.id}`}
                        >
                          {t('common.approve')} ✓
                        </button>
                        <button
                          onClick={() => handleReject(n.approval!)}
                          className="rounded-md border border-destructive px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                          data-testid={`notif-reject-${n.approval.id}`}
                        >
                          {t('common.reject')} ✗
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 text-center">
          <button className="text-sm text-primary hover:underline">{t('notifications.viewAll', 'View All Notifications')} →</button>
        </div>
      </div>
    </>
  );
}
