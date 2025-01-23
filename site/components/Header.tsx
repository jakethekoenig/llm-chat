// site/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';
import { FaBars } from 'react-icons/fa'; // Add this line

interface HeaderProps { // Add this block
  onToggleSidePane: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidePane }) => { // Modify this line
  return (
    <header className="site-header">
      <nav>
        <ul>
          <li><button className="toggle-button" onClick={onToggleSidePane} aria-label="Toggle Conversation List"><FaBars /></button></li>
          <li><Link to="/signin">Sign In</Link></li>
          <li><Link to="/register">Register</Link></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;