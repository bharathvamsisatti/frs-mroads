import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SignIn from './SignIn';
import SignUp from './SignUp';
import AccessAccountSvg from '../../components/svg/undraw_access-account_aydp.svg';
import Logo from '../../images/logo/logo2.png';

const Auth: React.FC = () => {
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(location.pathname === '/register');
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    setIsSignUp(location.pathname === '/register');
  }, [location.pathname]);

  const handleSwitch = (toSignUp: boolean) => {
    setSlideDirection(toSignUp ? 'right' : 'left');
    setIsAnimating(true);
    setTimeout(() => {
      setIsSignUp(toSignUp);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-boxdark-2 dark:via-boxdark dark:to-boxdark-2 px-4 py-4 sm:py-8 transition-all duration-500">
      <div className="w-full max-w-6xl rounded-3xl border border-stroke dark:border-strokedark bg-white dark:bg-boxdark shadow-2xl overflow-hidden flex flex-col lg:flex-row transition-all duration-500 max-h-[95vh]">
        {/* Left panel – biometric / brand area */}
        <div className="hidden lg:flex lg:w-1/2 flex-col bg-gradient-to-br from-primary via-primary/90 to-secondary text-white p-8 lg:p-10 relative overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          {/* Top brand / logo */}
          <div className="relative z-10 flex items-center justify-center mb-8 flex-shrink-0">
            <img 
              src={Logo} 
              alt="Logo" 
              width="180" 
              height="50" 
              style={{ objectFit: 'contain' }}
              className="max-w-full"
            />
          </div>

          {/* SVG Illustration */}
          <div className="relative z-10 flex-1 flex items-center justify-center my-4 min-h-0">
            <img 
              src={AccessAccountSvg} 
              alt="Access Account" 
              className="w-full max-w-[280px] h-auto opacity-95"
            />
          </div>

          {/* Bottom copy */}
          <div className="relative z-10 space-y-4 mt-auto flex-shrink-0">
            <h2 className="text-3xl font-bold leading-tight">
              {isSignUp ? (
                <>
                  Welcome to MROADS
                  <span className="block text-white/90">Face Recognition System</span>
                </>
              ) : (
                <>
                  Welcome Back
                  <span className="block text-white/90">to MROADS Face Recognition System</span>
                </>
              )}
            </h2>
            <p className="text-sm text-white/80 max-w-sm leading-relaxed">
              {isSignUp ? (
                <>
                  A secure and easy way to sign in using your face. No passwords needed - 
                  just look at the camera and you're in.
                </>
              ) : (
                <>
                  Sign in to access your dashboard and manage your account. 
                  Use your credentials to continue.
                </>
              )}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {isSignUp ? (
                <>
                  <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm hover:bg-white/15 transition-all duration-200">
                    <p className="font-semibold text-white text-sm">Fast &amp; Simple</p>
                    <p className="text-xs mt-1 text-white/70">
                      Sign in quickly with just your face. No typing required.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm hover:bg-white/15 transition-all duration-200">
                    <p className="font-semibold text-white text-sm">Secure &amp; Reliable</p>
                    <p className="text-xs mt-1 text-white/70">
                      Your face is unique and secure. We keep your data safe.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm hover:bg-white/15 transition-all duration-200">
                    <p className="font-semibold text-white text-sm">Quick Access</p>
                    <p className="text-xs mt-1 text-white/70">
                      Get back to your dashboard in seconds.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm hover:bg-white/15 transition-all duration-200">
                    <p className="font-semibold text-white text-sm">Your Account</p>
                    <p className="text-xs mt-1 text-white/70">
                      Manage enrollments and view transactions.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right panel – auth form */}
        <div className="w-full lg:w-1/2 px-6 py-6 sm:px-8 lg:px-10 flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-boxdark dark:to-boxdark-2 overflow-y-auto max-h-screen">
          {/* Toggle Switch */}
          <div className="mb-6 flex justify-center flex-shrink-0">
            <div className="inline-flex items-center bg-gray-100 dark:bg-boxdark-2 rounded-full p-1 border border-stroke dark:border-strokedark shadow-inner">
              <button
                type="button"
                onClick={() => handleSwitch(false)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  !isSignUp
                    ? 'bg-primary text-white shadow-lg transform scale-105'
                    : 'text-bodydark hover:text-black dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleSwitch(true)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  isSignUp
                    ? 'bg-primary text-white shadow-lg transform scale-105'
                    : 'text-bodydark hover:text-black dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="mb-4 text-center flex-shrink-0">
            <p className="text-xs uppercase tracking-wider text-bodydark2 mb-2 font-semibold">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-black dark:text-white mb-2">
              {isSignUp ? 'Sign up to MROADS' : 'Sign in to MROADS'}
            </h1>
            <p className="text-sm text-bodydark2">
              {isSignUp
                ? 'Create your account to get started'
                : 'Sign in to access your account and dashboard'}
            </p>
          </div>

          {/* Form container with slide animation */}
          <div className="relative overflow-hidden flex-1 min-h-0">
            <div
              className={`transition-all duration-500 ease-in-out w-full ${
                isAnimating
                  ? slideDirection === 'right'
                    ? 'opacity-0 transform translate-x-full'
                    : 'opacity-0 transform -translate-x-full'
                  : 'opacity-100 transform translate-x-0'
              }`}
            >
              <div className="rounded-2xl border border-white/30 dark:border-white/10 backdrop-blur-xl px-4 py-6 sm:px-6 sm:py-8 shadow-xl bg-white/50 dark:bg-black/30">
                {isSignUp ? (
                  <SignUp />
                ) : (
                  <SignIn onSwitchToSignUp={() => handleSwitch(true)} />
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex justify-center items-center flex-shrink-0">
            {isSignUp ? (
              <button
                type="button"
                onClick={() => handleSwitch(false)}
                className="group flex items-center gap-2 text-bodydark2 hover:text-primary transition-all duration-300"
              >
                <svg
                  className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-sm font-medium">Back to Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitch(true)}
                className="group flex items-center gap-2 text-bodydark2 hover:text-primary transition-all duration-300"
              >
                <span className="text-sm font-medium">Continue to Sign Up</span>
                <svg
                  className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

