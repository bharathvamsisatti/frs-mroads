import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../services/api';
import AnimatedInput from '../../components/Forms/AnimatedInput';
import AnimatedButton from '../../components/Forms/AnimatedButton';

interface SignInProps {
  onSwitchToSignUp?: () => void;
}

const SignIn: React.FC<SignInProps> = () => {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ email, password });

      if (response.success) {
        // Store token and user info
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
        if (response.user_id) {
          localStorage.setItem('user_id', response.user_id);
        }
        if (response.name) {
          localStorage.setItem('name', response.name);
        }
        if (response.email) {
          localStorage.setItem('email', response.email);
        }
        navigate('/dashboard');
      } else {
        setError(response.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="mb-2 text-lg font-semibold text-black dark:text-white transition-all duration-300">
        Sign in
      </h2>
      <p className="mb-6 text-sm text-bodydark2">
        Enter your email and password to sign in to your account.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm animate-fade-in border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-1">
        <AnimatedInput
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          error={error && !email ? 'Email is required' : ''}
        />

        <AnimatedInput
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          error={error && !password ? 'Password is required' : ''}
        />

        <div className="mt-6">
          <AnimatedButton
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </AnimatedButton>
        </div>

        <p className="mt-4 text-center text-xs text-bodydark">
          Hint: use <span className="font-mono text-primary">admin@gmail.com / admin</span> for the demo login.
        </p>

      </form>
    </div>
  );
};

export default SignIn;
