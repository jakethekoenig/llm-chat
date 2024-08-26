import * as React from 'react';
import MessageDemo from './components/MessageDemo';
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
        <h1>LLM Chat Component Showcase</h1>
        <MessageDemo />
      </div>
    </MathJaxContext>
  );
};
  );
};

export default App;
