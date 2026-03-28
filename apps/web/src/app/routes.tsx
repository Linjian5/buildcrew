import { createBrowserRouter, Navigate } from 'react-router';
import { AuthLayout } from './AuthLayout';
import Root from './Root';
import { Overview } from './pages/Overview';
import { Agents } from './pages/Agents';
import { Tasks } from './pages/Tasks';
import { Budget } from './pages/Budget';
import { Guardian } from './pages/Guardian';
import { Knowledge } from './pages/Knowledge';
import { Plugins } from './pages/Plugins';
import { SmartRouter } from './pages/SmartRouter';
import { Evolution } from './pages/Evolution';
import { GroupDashboard } from './pages/GroupDashboard';
import { OrgChartPage } from './pages/OrgChartPage';
import { Settings } from './pages/Settings';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { PricingPage } from './pages/PricingPage';
import { ChatPage } from './pages/ChatPage';
import { LegalPage } from './pages/LegalPage';
export const router = createBrowserRouter([
  {
    // Top-level layout that provides AuthContext to all routes
    Component: AuthLayout,
    children: [
      // Public routes — no auth required, no Root layout
      { path: '/legal/:type', Component: LegalPage },

      // Auth routes — no Root layout (no TopNav)
      { path: '/login', Component: LoginPage },
      { path: '/register', Component: RegisterPage },
      { path: '/onboarding', Component: OnboardingPage },
      { path: '/pricing', Component: PricingPage },

      // App routes — wrapped in Root layout (with route guard)
      {
        path: '/',
        Component: Root,
        children: [
          { index: true, element: <Navigate to="/overview" replace /> },
          { path: 'overview', Component: Overview },
          { path: 'agents', Component: Agents },
          { path: 'tasks', Component: Tasks },
          { path: 'budget', Component: Budget },
          { path: 'guardian', Component: Guardian },
          { path: 'knowledge', Component: Knowledge },
          { path: 'plugins', Component: Plugins },
          { path: 'smart-router', Component: SmartRouter },
          { path: 'evolution', Component: Evolution },
          { path: 'group', Component: GroupDashboard },
          { path: 'org-chart', Component: OrgChartPage },
          { path: 'chat', Component: ChatPage },
          { path: 'companies', Component: CompaniesPage },
          { path: 'settings', Component: Settings },
          { path: 'settings/:tab', Component: Settings },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
]);
