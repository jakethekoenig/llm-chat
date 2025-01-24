import * as React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import MessageDemo from './components/MessageDemo';
import SignIn from './components/SignIn';
import Register from './components/Register';
import Header from './components/Header';
import ConversationPage from './components/ConversationPage';
import ConversationListPage from './components/ConversationListPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import './App.css';
import { MathJaxContext } from 'better-react-mathjax';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
};

const mathjaxConfig = {
  loader: { load: ["[tex]/html"] },
  tex: {
    packages: { "[+]": ["html"] },
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"]
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"]
    ]
  }
};

const AppContent = () => {
  const [isSidePaneOpen, setIsSidePaneOpen] = React.useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = React.useState(false);
  const toggleSidePane = () => { setIsSidePaneOpen(!isSidePaneOpen); };
  const location = window.location.pathname;
  const isNewConversation = location === '/conversations/new';
  const auth = useAuth();

  React.useEffect(() => {
    const initAuth = async () => {
      const { setAuthInstance } = await import('./utils/api');
      setAuthInstance(auth);
      setIsAuthInitialized(true);
    };
    initAuth();
  }, [auth]);

  if (!isAuthInitialized) {
    return <div>Initializing...</div>;
  }

  return (
    <MathJaxContext config={mathjaxConfig as any}>
      <div className="app-container">
        <Header onToggleSidePane={toggleSidePane} />
        <div className="main-content">
          {!isNewConversation && (
            <aside className={`side-pane ${isSidePaneOpen ? 'open' : 'closed'}`}>
              <ProtectedRoute>
                <ConversationListPage />
              </ProtectedRoute>
            </aside>
          )}
          <main className={`page-content ${isNewConversation ? 'full-width' : ''}`}>
            {!isNewConversation && <h1>LLM Chat Component Showcase</h1>}
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/register" element={<Register />} />
              <Route path="/showcase" element={<MessageDemo />} />
              <Route 
                path="/conversations/:conversationId" 
                element={
                  <ProtectedRoute>
                    <ConversationPage />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<div>Page Not Found</div>} />
            </Routes>
          </main>
        </div>
      </div>
    </MathJaxContext>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
export default App;
