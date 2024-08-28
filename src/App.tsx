import * as React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MessageDemo from './components/MessageDemo';
import SignIn from './components/SignIn';
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
      <Router>
        <div>
          <h1>LLM Chat Component Showcase</h1>
          <Routes>
            <Route path="/" element={<MessageDemo />} />
            <Route path="/signin" element={<SignIn />} />
          </Routes>
        </div>
      </Router>
    </MathJaxContext>
  );
};

export default App;
