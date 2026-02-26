import { useState, useEffect } from 'react';
import { WelcomeView } from './views/WelcomeView';
import { LoginView } from './views/LoginView';
import { AgeCheckView } from './views/AgeCheckView';
import { ExtractorView } from './views/ExtractorView';
import { PendingView } from './views/PendingView';
import { GameView } from './views/GameView';
import { AdminView } from './views/AdminView';
import { User } from './types';

export type ViewState = 'WELCOME' | 'LOGIN' | 'AGE_CHECK' | 'EXTRACTOR' | 'PENDING' | 'GAME' | 'ADMIN';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('WELCOME');
  const [userName, setUserName] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (userName && currentView === 'PENDING') {
      const interval = setInterval(async () => {
        const res = await fetch(`/api/users/${userName}`);
        const data = await res.json();
        if (data.success && data.user.status === 'approved') {
          setUser(data.user);
          setCurrentView('GAME');
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [userName, currentView]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {currentView === 'WELCOME' && <WelcomeView onNavigate={setCurrentView} />}
      {currentView === 'LOGIN' && <LoginView onNavigate={setCurrentView} setUserName={setUserName} setUser={setUser} />}
      {currentView === 'AGE_CHECK' && <AgeCheckView onNavigate={setCurrentView} />}
      {currentView === 'EXTRACTOR' && <ExtractorView onNavigate={setCurrentView} userName={userName} />}
      {currentView === 'PENDING' && <PendingView />}
      {currentView === 'GAME' && user && <GameView user={user} setUser={setUser} onNavigate={setCurrentView} />}
      {currentView === 'ADMIN' && <AdminView />}
    </div>
  );
}

