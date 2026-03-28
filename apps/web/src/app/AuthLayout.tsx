import { Outlet } from 'react-router';
import { AuthProvider } from '../contexts/AuthContext';
import { CompanyProvider } from '../contexts/CompanyContext';
import { ChatProvider } from '../contexts/ChatContext';

/**
 * Top-level layout that provides AuthContext to all routes.
 * This is needed because RouterProvider in react-router v7 does not
 * propagate external React context to route components.
 */
export function AuthLayout() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <ChatProvider>
          <Outlet />
        </ChatProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
