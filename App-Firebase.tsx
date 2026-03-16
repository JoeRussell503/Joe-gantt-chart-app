import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './config/firebase';
import SignInScreen from './components/SignInScreen';
import InviteAccept from './components/InviteAccept';
import GanttApp from './GanttApp';

const PENDING_INVITE_KEY = 'pendingInviteCode';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const path = window.location.pathname;
  const inviteMatch = path.match(/^\/invite\/([a-z0-9]+)$/i);
  const inviteCode = inviteMatch ? inviteMatch[1] : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (inviteCode) {
    if (!user) {
      sessionStorage.setItem(PENDING_INVITE_KEY, inviteCode);
      return <SignInScreen />;
    }
    return (
      <InviteAccept
        inviteCode={inviteCode}
        onAccepted={() => {
          sessionStorage.removeItem(PENDING_INVITE_KEY);
          window.location.href = '/';
        }}
      />
    );
  }

  if (!user) {
    const pendingCode = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (pendingCode) {
      window.location.href = '/invite/' + pendingCode;
      return null;
    }
    return <SignInScreen />;
  }

  return <GanttApp />;
};

export default App;
