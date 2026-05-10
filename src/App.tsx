import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Float from './pages/Float';
import Settings from './pages/Settings';
import TitleBar from './components/TitleBar';

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
    return <Float />;
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
        {route === '/settings' ? <Settings /> : <Dashboard />}
      </main>
    </div>
  );
}
