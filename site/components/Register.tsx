// site/components/Register.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from './ToastProvider';
import { ErrorHandlers } from '../utils/errorHandling';
import { ApiError } from '../utils/api';
import '../App.css'; // Ensure the CSS file is imported

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showSuccess, showError } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple simultaneous submissions
    if (isLoading) {
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Create an ApiError-like object with server response details
        const apiError = new Error(data.message || data.error || 'Registration failed') as ApiError;
        apiError.status = response.status;
        apiError.code = data.code;
        apiError.details = data.details;
        throw apiError;
      }
      
      // Auto-login the user with the returned token
      login(data.token);
      showSuccess('Account created successfully! Welcome to L2 Chat.');
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
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <div>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          {isLoading ? 'Creating Account...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default Register;