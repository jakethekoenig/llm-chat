import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  isAuthChecked: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  token: null,
  isAuthChecked: false,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);
  const navigate = useNavigate();

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
    navigate('/signin');
  };

  const validateToken = async (tokenToValidate: string): Promise<boolean> => {
    try {
      // Use a simple fetch without the auto-logout logic to avoid recursive logout calls
      const response = await fetch('/api/conversations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      
      if (storedToken) {
        const isValid = await validateToken(storedToken);
        if (isValid) {
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          setToken(null);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      
      setIsAuthChecked(true);
    };
    
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, isAuthChecked, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;