import * as React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import MessageDemo from './components/MessageDemo';
import SignIn from './components/SignIn';
import Register from './components/Register';
import Header from './components/Header';
import ConversationPage from './components/ConversationPage';
import ConversationListPage from './components/ConversationListPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
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
  const auth = useAuth();

  React.useEffect(() => {
    const initAuth = async () => {
      // Only set up auth instance after auth check is complete
      if (auth.isAuthChecked) {
        const { setAuthInstance } = await import('./utils/api');
        setAuthInstance(auth);
        setIsAuthInitialized(true);
      }
    };
    initAuth();
  }, [auth, auth.isAuthChecked, auth.token, auth.isAuthenticated]);

  if (!isAuthInitialized || !auth.isAuthChecked) {
    return <div>Initializing...</div>;
  }

  return (
    <MathJaxContext config={mathjaxConfig as any}>
      <div className="app-container">
        <Header onToggleSidePane={toggleSidePane} />
        <div className="main-content">
          <aside className={`side-pane ${isSidePaneOpen ? 'open' : 'closed'}`}>
            {auth.isAuthenticated && (
              <ConversationListPage />
            )}
          </aside>
          <main className="page-content">
            <h1>Welcome to L2 Chat</h1>
            <Routes>
              <Route path="/" element={
                auth.isAuthenticated ? (
                  <div>
                    <p>Welcome to L2 Chat! Select a conversation from the sidebar to get started, or create a new one.</p>
                  </div>
                ) : (
                  <Navigate to="/signin" replace />
                )
              } />
              <Route path="/signin" element={
                auth.isAuthenticated ? (
                  <Navigate to="/" replace />
                ) : (
                  <SignIn />
                )
              } />
              <Route path="/register" element={
                auth.isAuthenticated ? (
                  <Navigate to="/" replace />
                ) : (
                  <Register />
                )
              } />
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
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};
export default App;
