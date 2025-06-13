import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from './ToastProvider';
import { ErrorHandlers } from '../utils/errorHandling';
import { ApiError } from '../utils/api';
import '../App.css';

const SignIn: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showSuccess, showError } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous submissions
    if (isLoading) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    // Clear any existing token to prevent conflicts
    localStorage.removeItem('token');

    try {
      const response = await fetch('/api/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Create an ApiError-like object with server response details
        const apiError = new Error(data.message || data.error || 'Sign in failed') as ApiError;
        apiError.status = response.status;
        apiError.code = data.code;
        apiError.details = data.details;
        throw apiError;
      }
      
      await login(data.token);
      showSuccess('Welcome back!');
      navigate('/');
    } catch (err) {
      const formattedError = ErrorHandlers.auth(err);
      setError(formattedError.message);
      
      // Show toast only for severe errors, inline message is sufficient for validation issues
      if (formattedError.severity === 'error') {
        showError(formattedError.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Sign In</h2>
      <form onSubmit={handleSignIn}>
        <div>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default SignIn;