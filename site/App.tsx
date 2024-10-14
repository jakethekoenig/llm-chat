import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import MessageDemo from './components/MessageDemo';
import SignIn from './components/SignIn';
import Register from './components/Register';
import Header from './components/Header';
import ConversationPage from './components/ConversationPage';
import ConversationListPage from './components/ConversationListPage';
import './App.css';
import { MathJaxContext } from 'better-react-mathjax';

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

const App = () => {
  // State to track the visibility of the side pane
  const [isSidePaneOpen, setIsSidePaneOpen] = React.useState(true);
  // Function to toggle the side pane's visibility
  const toggleSidePane = () => { setIsSidePaneOpen(!isSidePaneOpen); };

  return (
    <MathJaxContext config={mathjaxConfig as any}>
      <div className="app-container">
        <Header onToggleSidePane={toggleSidePane} />
        <div className="main-content">
          <aside className={`side-pane ${isSidePaneOpen ? 'open' : 'closed'}`}>
            <ConversationListPage />
          </aside>
          <main className="page-content">
            <h1>LLM Chat Component Showcase</h1>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/register" element={<Register />} />
              <Route path="/showcase" element={<MessageDemo />} />
              <Route path="/conversations/:conversationId" element={<ConversationPage />} />
              <Route path="*" element={<div>Page Not Found</div>} />
            </Routes>
          </main>
        </div>
      </div>
    </MathJaxContext>
  );
};
export default App;
