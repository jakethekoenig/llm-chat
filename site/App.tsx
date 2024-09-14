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
  return (
    <MathJaxContext config={mathjaxConfig as any}>
      <div>
        <Header /> {/* Add this line */}
        <h1>LLM Chat Component Showcase</h1>
        <Routes>
          <Route path="/" element={<ConversationListPage />} /> {/* Change this line */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} /> {/* Add this line */}
          <Route path="/showcase" element={<MessageDemo />} /> {/* Add this line */}
          <Route path="/conversation/:id" element={<ConversationPage />} /> {/* Add this line */}
          <Route path="*" element={<div>Page Not Found</div>} /> {/* Add this line */}
        </Routes>
      </div>
    </MathJaxContext>
  );
};
export default App;
