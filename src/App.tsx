import * as React from 'react';
import MessageDemo from './components/MessageDemo';
import './App.css';
import { MathJaxContext } from 'better-react-mathjax';

const App = () => {
  return (
    <MathJaxContext>
      <div>
        <h1>LLM Chat Component Showcase</h1>
        <MessageDemo />
      </div>
    </MathJaxContext>
  );
};

export default App;
