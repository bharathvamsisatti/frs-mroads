import React from 'react';

interface LoginSession {
  location: string;
  device: string;
  ipAddress: string;
  lastActivity: string;
  isActive: boolean;
}

const loginSessions: LoginSession[] = [
  {
    location: 'Bangalore',
    device: 'Chrome Mac',
    ipAddress: '113.2.183.254',
    lastActivity: '6 hours ago',
    isActive: true,
  },
  {
    location: 'Chennai',
    device: 'Unknown device',
    ipAddress: '37.26.77.113',
    lastActivity: '1 month ago',
    isActive: false,
  },
  {
    location: 'Hyderabad',
    device: 'Chrome Mac',
    ipAddress: '118.100.254.148',
    lastActivity: '6 months ago',
    isActive: false,
  },
];

const Badge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-500'}`}
        aria-hidden="true"
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
};

const LoginSessionsComponent: React.FC = () => {
  return (
    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-black dark:text-white">Login Sessions</h3>
            <p className="text-sm text-bodydark2 mt-1">
              Places where you're logged into the system
            </p>
          </div>
          <button className="text-sm text-primary hover:underline">Logout from all devices</button>
        </div>
      </div>

      <div className="p-7">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-full">
            <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark text-sm font-medium text-black dark:text-white">
              <div>Location</div>
              <div>Device</div>
              <div>IP Address</div>
              <div>Last Activity</div>
              <div>Status</div>
            </div>
            {loginSessions.map((session, index) => (
              <div
                key={index}
                className="grid grid-cols-5 gap-4 p-4 border-b border-stroke dark:border-strokedark last:border-b-0"
              >
                <div className="text-sm text-black dark:text-white">{session.location}</div>
                <div className="text-sm text-bodydark2">{session.device}</div>
                <div className="text-sm text-bodydark2">{session.ipAddress}</div>
                <div className="text-sm text-bodydark2">{session.lastActivity}</div>
                <div>
                  <Badge isActive={session.isActive} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {loginSessions.map((session, index) => (
            <div
              key={index}
              className="bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-lg p-4 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-black dark:text-white">
                    {session.location}
                  </h3>
                  <p className="text-xs text-bodydark2">{session.device}</p>
                </div>
                <Badge isActive={session.isActive} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-bodydark2">IP Address:</span>
                  <span className="text-black dark:text-white">{session.ipAddress}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-bodydark2">Last Activity:</span>
                  <span className="text-black dark:text-white">{session.lastActivity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginSessionsComponent;

