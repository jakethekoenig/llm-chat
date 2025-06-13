// site/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';
import { FaBars } from 'react-icons/fa';

interface HeaderProps {
  onToggleSidePane: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidePane }) => {
  return (
    <header className="site-header">
      <div className="header-content">
        <div className="header-left">
          <button className="toggle-button" onClick={onToggleSidePane} aria-label="Toggle Conversation List">
            <FaBars />
          </button>
        </div>
        <div className="header-right">
          <nav>
            <ul>
              <li><Link to="/signin">Sign In</Link></li>
              <li><Link to="/register">Register</Link></li>
            </ul>
          </nav>
          <div className="logo-container">
            <img src="/site/assets/l2-chat-logo.svg" alt="L2 Chat" className="header-logo" />
            <span className="logo-text">L2 Chat</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;