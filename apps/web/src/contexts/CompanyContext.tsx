import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api-client';
import { useAuth } from './AuthContext';

interface CompanyContextValue {
  currentCompanyId: string;
  currentCompanyName: string;
  switchCompany: (id: string, name: string) => void;
  validating: boolean;
}

const COMPANY_ID_KEY = 'bc-company-id';
const COMPANY_NAME_KEY = 'bc-company-name';

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [currentCompanyId, setCurrentCompanyId] = useState(
    () => localStorage.getItem(COMPANY_ID_KEY) || ''
  );
  const [currentCompanyName, setCurrentCompanyName] = useState(
    () => localStorage.getItem(COMPANY_NAME_KEY) || ''
  );
  const [validating, setValidating] = useState(true);

  const switchCompany = useCallback((id: string, name: string) => {
    if (id) {
      localStorage.setItem(COMPANY_ID_KEY, id);
      localStorage.setItem(COMPANY_NAME_KEY, name);
    } else {
      localStorage.removeItem(COMPANY_ID_KEY);
      localStorage.removeItem(COMPANY_NAME_KEY);
    }
    setCurrentCompanyId(id);
    setCurrentCompanyName(name);
  }, []);

  // Wait for AuthContext to finish loading before making any API requests.
  // This prevents 401 on page refresh caused by the race between
  // AuthContext setting the token and CompanyContext calling /companies.
  useEffect(() => {
    if (authLoading) return; // AuthContext still restoring session — wait

    if (!isAuthenticated) {
      // Not logged in — nothing to validate
      setValidating(false);
      return;
    }

    const storedId = localStorage.getItem(COMPANY_ID_KEY);
    if (!storedId) {
      setValidating(false);
      return;
    }

    api.get<{ data: { id: string; name: string }[] }>('/companies')
      .then((res) => {
        const companies = res.data;
        const found = companies.find((c) => c.id === storedId);
        if (found) {
          switchCompany(found.id, found.name);
        } else if (companies.length > 0) {
          switchCompany(companies[0]!.id, companies[0]!.name);
        } else {
          switchCompany('', '');
        }
      })
      .catch(() => {
        // Validation failed — keep cached values
      })
      .finally(() => {
        setValidating(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  return (
    <CompanyContext.Provider value={{ currentCompanyId, currentCompanyName, switchCompany, validating }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
