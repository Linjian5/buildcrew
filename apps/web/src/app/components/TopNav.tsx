import { Link, useLocation, useNavigate } from 'react-router';
import {
  Search,
  Bell,
  User,
  Wrench,
  Menu,
  X,
  ChevronDown,
  // Key,       // hidden: api-keys menu item temporarily disabled
  BarChart3,
  // CreditCard, // hidden: subscription menu item temporarily disabled
  ArrowLeftRight,
  PlusCircle,
  Moon,
  Globe,
  BookOpen,
  MessageCircle,
  Bug,
  LogOut,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '../../i18n';
import { NotificationPanel } from './common/NotificationPanel';
import { CompanySwitcher } from './common/CompanySwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useChat } from '@/contexts/ChatContext';
import { getUserProfile, type UserProfile } from '@/lib/api';
import { Switch } from './ui/switch';
import { Lock } from 'lucide-react';

// Toggle to 'free' to show plan restrictions in the nav
const userPlan = 'pro' as 'free' | 'pro';
const isPro = userPlan === 'pro';

interface TopNavProps {
  onSearchClick?: () => void;
}

const tabKeys = [
  { path: '/overview', key: 'nav.overview', proOnly: false },
  { path: '/agents', key: 'nav.agents', proOnly: false },
  { path: '/chat', key: 'nav.chat', proOnly: false },
  { path: '/tasks', key: 'nav.tasks', proOnly: false },
  { path: '/budget', key: 'nav.budget', proOnly: false },
  { path: '/knowledge', key: 'nav.knowledge', proOnly: false },
  { path: '/guardian', key: 'nav.guardian', proOnly: false },
  { path: '/plugins', key: 'nav.plugins', proOnly: false },
  { path: '/smart-router', key: 'nav.smartRouter', proOnly: true },
  { path: '/evolution', key: 'nav.evolution', proOnly: true },
] as const;

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
] as const;

function UserAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const { t } = useTranslation();
  const isPro = plan === 'pro' || plan === 'team';
  const label =
    plan === 'pro'
      ? t('userMenu.planPro')
      : plan === 'team'
        ? t('userMenu.planTeam')
        : t('userMenu.planFree');

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isPro
          ? 'bg-green-500/20 text-green-500'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
    </span>
  );
}

export function TopNav({ onSearchClick }: TopNavProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount: chatUnread, ceoAgentId } = useChat();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const { currentCompanyId, currentCompanyName, switchCompany, validating } = useCompany();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('bc-theme') !== 'light';
  });

  useEffect(() => {
    getUserProfile()
      .then(setProfile)
      .catch((err) => {
        console.error('Failed to fetch user profile:', err);
      });
  }, []);

  const isTabActive = (tabPath: string) => location.pathname.startsWith(tabPath);

  const closeMenu = useCallback(() => setUserMenuOpen(false), []);

  const handleNavClick = useCallback(
    (path: string) => {
      closeMenu();
      navigate(path);
    },
    [closeMenu, navigate],
  );

  const handleSignOut = useCallback(() => {
    closeMenu();
    logout();
    navigate('/login');
  }, [closeMenu, logout, navigate]);

  const displayName = profile?.name ?? user?.name ?? 'User';
  const displayEmail = profile?.email ?? user?.email ?? '';
  const plan = profile?.plan ?? 'free';

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      {/* Main bar -- fixed 56px height */}
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: Logo & Company */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/overview" className="flex items-center gap-2" data-testid="logo-link">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold">
              <span className="text-foreground">Build</span>
              <span className="text-primary">Crew</span>
            </span>
          </Link>
          <div className="hidden h-6 w-px bg-border md:block" />
          <div className="relative hidden md:block">
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={() => setCompanySwitcherOpen(!companySwitcherOpen)}
              data-testid="company-switcher-btn"
            >
              {validating ? '...' : (currentCompanyName || 'BuildCrew')}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <CompanySwitcher
              open={companySwitcherOpen}
              onClose={() => setCompanySwitcherOpen(false)}
              currentCompanyId={currentCompanyId}
              onSwitch={(id) => {
                // Fetch company name then switch context
                void import('@/lib/api').then(({ getCompany }) => {
                  getCompany(id).then((c) => switchCompany(c.id, c.name)).catch((err) => { console.error('Failed to fetch company details:', err); switchCompany(id, id); });
                });
              }}
            />
          </div>
        </div>

        {/* Center: Desktop Tabs */}
        <nav className="hidden items-center gap-1 xl:flex">
          {tabKeys.map((tab) => {
            const active = isTabActive(tab.path);
            const showLock = tab.proOnly && !isPro;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                data-testid={`nav-${tab.path.slice(1)}`}
                className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(tab.key)}
                {showLock && <Lock className="ml-1 inline h-3 w-3 text-amber-500" />}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="relative flex items-center gap-2 md:gap-3">
          {/* Search Button with Cmd+K hint */}
          <button
            className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
            onClick={() => onSearchClick?.()}
            data-testid="search-btn"
          >
            <Search className="h-4 w-4" />
            <span>{t('common.searchPlaceholder')}</span>
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Chat */}
          <div className="relative">
            <button
              className={`rounded-lg p-2 transition-colors hover:bg-muted hover:text-foreground ${
                isTabActive('/chat') ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate(ceoAgentId ? `/chat?agent=${ceoAgentId}&name=Aria` : '/chat')}
              data-testid="chat-btn"
            >
              <MessageCircle className="h-5 w-5" />
              {chatUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {chatUnread}
                </span>
              )}
            </button>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              className={`rounded-lg p-2 transition-colors hover:bg-muted hover:text-foreground ${
                notificationsOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              data-testid="notifications-btn"
            >
              <Bell className="h-5 w-5" />
            </button>

            <NotificationPanel
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              companyId="c1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6"
            />
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              className={`hidden rounded-lg p-2 transition-colors hover:bg-muted hover:text-foreground md:block ${
                isTabActive('/settings') || isTabActive('/companies') || userMenuOpen
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              data-testid="user-menu-btn"
            >
              <User className="h-5 w-5" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={closeMenu}
                />
                <div
                  className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border bg-card shadow-lg"
                  data-testid="user-menu-dropdown"
                >
                  {/* User header */}
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <UserAvatar name={displayName} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{displayName}</p>
                        <PlanBadge plan={plan} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                    </div>
                  </div>

                  {/* Account section */}
                  <div className="py-1">
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('userMenu.account')}
                    </p>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => handleNavClick('/settings/profile')}
                    >
                      <User size={16} className="text-muted-foreground" />
                      {t('userMenu.profile')}
                    </button>
                    {/* hidden: api-keys and subscription temporarily disabled
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => handleNavClick('/settings/api-keys')}
                    >
                      <Key size={16} className="text-muted-foreground" />
                      {t('userMenu.modelApiKeys')}
                    </button>
                    */}
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => handleNavClick('/settings/usage')}
                    >
                      <BarChart3 size={16} className="text-muted-foreground" />
                      {t('userMenu.usage')}
                    </button>
                    {/* hidden: subscription temporarily disabled
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => handleNavClick('/settings/subscription')}
                    >
                      <CreditCard size={16} className="text-muted-foreground" />
                      {t('userMenu.subscription')}
                    </button>
                    */}
                  </div>

                  <div className="mx-4 border-t border-border" />

                  {/* Company section */}
                  <div className="py-1">
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('userMenu.company')}
                    </p>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => {
                        closeMenu();
                        setCompanySwitcherOpen(true);
                      }}
                    >
                      <ArrowLeftRight size={16} className="text-muted-foreground" />
                      {t('userMenu.switchCompany')}
                    </button>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => handleNavClick('/onboarding')}
                    >
                      <PlusCircle size={16} className="text-muted-foreground" />
                      {t('userMenu.createNewCompany')}
                    </button>
                  </div>

                  <div className="mx-4 border-t border-border" />

                  {/* Preferences section */}
                  <div className="py-1">
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('userMenu.preferences')}
                    </p>
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-3">
                        <Moon size={16} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">{t('userMenu.darkMode')}</span>
                      </div>
                      <Switch checked={darkMode} onCheckedChange={(checked) => {
                        setDarkMode(checked);
                        localStorage.setItem('bc-theme', checked ? 'dark' : 'light');
                        if (checked) {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                      }} />
                    </div>
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-3">
                        <Globe size={16} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">{t('userMenu.language')}</span>
                      </div>
                      <div className="flex gap-1">
                        {LANGUAGES.map((lang) => {
                          const currentLang = normalizeLocale(i18n.language);
                          const isActive = currentLang === lang.code;
                          return (
                            <button
                              key={lang.code}
                              onClick={() => void i18n.changeLanguage(lang.code)}
                              className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              {lang.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mx-4 border-t border-border" />

                  {/* Support section */}
                  <div className="py-1">
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('userMenu.support')}
                    </p>
                    <a
                      href="https://docs.buildcrew.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={closeMenu}
                    >
                      <BookOpen size={16} className="text-muted-foreground" />
                      {t('userMenu.documentation')}
                    </a>
                    <a
                      href="https://community.buildcrew.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={closeMenu}
                    >
                      <MessageCircle size={16} className="text-muted-foreground" />
                      {t('userMenu.community')}
                    </a>
                    <a
                      href="https://github.com/buildcrew/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={closeMenu}
                    >
                      <Bug size={16} className="text-muted-foreground" />
                      {t('userMenu.reportBug')}
                    </a>
                  </div>

                  <div className="mx-4 border-t border-border" />

                  {/* Sign Out */}
                  <div className="py-1">
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted"
                      onClick={handleSignOut}
                    >
                      <LogOut size={16} />
                      {t('userMenu.signOut')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="border-t border-border bg-card xl:hidden">
          <div className="max-h-[70vh] space-y-1 overflow-y-auto px-4 py-2 scrollbar-thin">
            {tabKeys.map((tab) => {
              const active = isTabActive(tab.path);
              const showLock = tab.proOnly && !isPro;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {t(tab.key)}
                  {showLock && <Lock className="ml-1 inline h-3 w-3 text-amber-500" />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
