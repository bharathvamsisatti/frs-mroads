import React, { useState } from 'react';
import Switch from '../../components/Switch';

const CommunicationForm: React.FC = () => {
  const [alertFrequency, setAlertFrequency] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
          <h3 className="font-medium text-black dark:text-white">Notification Preferences</h3>
        </div>
        <div className="p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 py-3 sm:py-4">
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-medium text-black dark:text-white">
                Frequency of alerts (instant / daily digest)
              </span>
              <span className="text-xs sm:text-sm text-bodydark2 mt-1">
                Choose how often you receive notifications
              </span>
            </div>
            <div className="flex justify-start sm:justify-end">
              <Switch
                checked={alertFrequency}
                onCheckedChange={setAlertFrequency}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 py-3 sm:py-4 border-t border-stroke dark:border-strokedark">
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-medium text-black dark:text-white">
                Email Notifications
              </span>
              <span className="text-xs sm:text-sm text-bodydark2 mt-1">
                Receive notifications via email
              </span>
            </div>
            <div className="flex justify-start sm:justify-end">
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 py-3 sm:py-4 border-t border-stroke dark:border-strokedark">
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-medium text-black dark:text-white">
                Push Notifications
              </span>
              <span className="text-xs sm:text-sm text-bodydark2 mt-1">
                Receive push notifications in your browser
              </span>
            </div>
            <div className="flex justify-start sm:justify-end">
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationForm;

