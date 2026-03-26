import React from 'react';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import ProfileHeader from './ProfileHeader';
import ProfileTabs from './ProfileTabs';

const Settings: React.FC = () => {
  const name = localStorage.getItem('name') || 'User';
  const email = localStorage.getItem('email') || 'user@example.com';

  return (
    <>
      <Breadcrumb pageName="Settings" />
      <div className="grid grid-cols-1 gap-8">
        {/* Profile Header with Image Upload */}
        <div className="col-span-1">
          <ProfileHeader name={name} email={email} />
        </div>

        {/* Profile Tabs */}
        <div className="col-span-1">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
              <h3 className="font-medium text-black dark:text-white">Account Settings</h3>
            </div>
            <div className="p-7">
              <ProfileTabs />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;

