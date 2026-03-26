import React, { useState, useEffect } from 'react';
import { updateProfile } from '../../services/api';

const ProfileForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Load user data from localStorage
    const storedName = localStorage.getItem('name') || '';
    const storedEmail = localStorage.getItem('email') || '';
    setName(storedName);
    setEmail(storedEmail);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await updateProfile({ name, email });
      if (response.success) {
        setSuccess('Profile updated successfully');
        localStorage.setItem('name', name);
        localStorage.setItem('email', email);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="name" className="block text-sm font-medium text-black dark:text-white">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-stroke bg-transparent py-3 px-5 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
          required
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="email" className="block text-sm font-medium text-black dark:text-white">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-stroke bg-transparent py-3 px-5 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
          required
        />
      </div>

      {error && (
        <div className="sm:col-span-2 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="sm:col-span-2 rounded border border-green-500 bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      <div className="sm:col-span-2 flex justify-end gap-4.5">
        <button
          type="button"
          className="flex justify-center rounded border border-stroke py-2 px-6 font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
          onClick={() => {
            setName(localStorage.getItem('name') || '');
            setEmail(localStorage.getItem('email') || '');
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex justify-center rounded bg-primary py-2 px-6 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default ProfileForm;

