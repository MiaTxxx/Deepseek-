import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Float from './pages/Float';
import Settings from './pages/Settings';
import TitleBar from './components/TitleBar';
import ErrorBoundary from './components/ErrorBoundary';

function getRoute(): string {
  const hash = window.location.hash.replace('#', '');
  return hash || '/';
}

export default function App() {
  const [route, setRoute] = useState<string>(getRoute());

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route === '/float') {
    return <ErrorBoundary><Float /></ErrorBoundary>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-cream-50 text-warm-800">
      <TitleBar
        active={route}
        onNavigate={(r) => {
          window.location.hash = r;
        }}
      />
      <main className="flex-1 overflow-auto">
        <ErrorBoundary>
          {route === '/settings' ? <Settings /> : route === '/' || route === '' ? <Dashboard /> : (
            <div className="p-6 text-center text-xs text-warm-600">页面不存在</div>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
