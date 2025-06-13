// site/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';
import { FaBars } from 'react-icons/fa';
import { useAuth } from './AuthContext';

interface HeaderProps {
  onToggleSidePane: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidePane }) => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="header-content">
        <div className="header-left">
          {isAuthenticated && (
            <button className="toggle-button" onClick={onToggleSidePane} aria-label="Toggle Conversation List">
              <FaBars />
            </button>
          )}
        </div>
        <div className="header-right">
          <nav>
            <ul>
              {isAuthenticated ? (
                <li><button onClick={logout}>Sign Out</button></li>
              ) : (
                <>
                  <li><Link to="/signin">Sign In</Link></li>
                  <li><Link to="/register">Register</Link></li>
                </>
              )}
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