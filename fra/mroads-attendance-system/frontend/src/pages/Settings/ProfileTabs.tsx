import React, { useState } from 'react';
import ProfileForm from './ProfileForm';
import PasswordForm from './PasswordForm';
import CommunicationForm from './CommunicationForm';
import LoginSessionsComponent from './LoginSessions';

type TabKey = 'profile' | 'password' | 'comm' | 'security';

const ProfileTabs: React.FC = () => {
  const [active, setActive] = useState<TabKey>('profile');

  const TabButton: React.FC<{ value: TabKey; children: React.ReactNode }> = ({
    value,
    children,
  }) => {
    const isActive = active === value;
    return (
      <button
        role="tab"
        aria-selected={isActive}
        onClick={() => setActive(value)}
        className={`rounded-none border-b-2 px-3 py-3 text-sm transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-meta-4 whitespace-nowrap ${
          isActive
            ? 'border-primary font-medium text-primary'
            : 'border-transparent text-bodydark2 hover:text-black dark:hover:text-white'
        }`}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="w-full">
      {/* Tabs header */}
      <div role="tablist" aria-orientation="horizontal" className="w-full">
        <div className="flex w-full items-end gap-1 sm:gap-2 border-b border-stroke dark:border-strokedark overflow-x-auto">
          <TabButton value="profile">Profile</TabButton>
          <TabButton value="password">
            <span className="hidden sm:inline">Change Password</span>
            <span className="sm:hidden">Password</span>
          </TabButton>
          <TabButton value="comm">
            <span className="hidden sm:inline">Communication Preferences</span>
            <span className="sm:hidden">Communication</span>
          </TabButton>
          <TabButton value="security">
            <span className="hidden sm:inline">Security & Login Activity</span>
            <span className="sm:hidden">Security</span>
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4 sm:pt-6">
        {active === 'profile' && <ProfileForm />}
        {active === 'password' && <PasswordForm />}
        {active === 'comm' && <CommunicationForm />}
        {active === 'security' && <LoginSessionsComponent />}
      </div>
    </div>
  );
};

export default ProfileTabs;

