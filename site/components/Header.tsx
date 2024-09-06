// site/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="site-header">
      <nav>
        <ul>
          <li><Link to="/signin">Sign In</Link></li>
          <li><Link to="/register">Register</Link></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;