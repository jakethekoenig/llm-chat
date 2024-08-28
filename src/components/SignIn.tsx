import React, { useState } from 'react';
import axios from 'axios';

const SignIn: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/signin', { username, password });
      localStorage.setItem('token', response.data.token);
      setError('');
      // Redirect or update UI as needed
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div>
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
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Sign In</button>
      </form>
    </div>
  );
};

export default SignIn;