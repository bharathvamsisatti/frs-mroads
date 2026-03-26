import { useEffect, useState, useCallback } from 'react';
import { getEnrolled } from '../../services/api';
import UserDetailsModal from './UserDetailsModal';

const TableOne = () => {
  const [enrolledUsers, setEnrolledUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadEnrolled = useCallback(async () => {
    try {
      const response = await getEnrolled();
      if (response && response.enrolled_names) {
        setEnrolledUsers(response.enrolled_names);
      } else {
        setEnrolledUsers([]);
      }
    } catch (err) {
      console.error('Failed to load enrolled users:', err);
      setEnrolledUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and auto-refresh every 5 seconds
  useEffect(() => {
    // Load immediately
    loadEnrolled();
    
    // Set up auto-refresh interval
    const intervalId = setInterval(() => {
      loadEnrolled();
    }, 5000); // Refresh every 5 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [loadEnrolled]);

  return (
    <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1 flex flex-col h-full">
      <div className="mb-6 flex items-center justify-between flex-shrink-0">
        <h4 className="text-xl font-semibold text-black dark:text-white">
          Enrolled Users
        </h4>
        <button
          onClick={loadEnrolled}
          className="rounded-lg border border-primary bg-primary px-4 py-2 text-white transition hover:bg-opacity-90"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col flex-1 min-h-0 max-h-96">
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
        <div className="grid grid-cols-1 rounded-sm bg-gray-2 dark:bg-meta-4 sm:grid-cols-3">
          <div className="p-2.5 xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              User Name
            </h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              Status
            </h5>
          </div>
          <div className="hidden p-2.5 text-center sm:block xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">
              Actions
            </h5>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-center text-bodydark2">Loading...</div>
        ) : enrolledUsers.length === 0 ? (
          <div className="p-4 text-center text-bodydark2">No enrolled users found.</div>
        ) : (
          enrolledUsers.map((user, key) => (
            <div
              className={`grid grid-cols-1 sm:grid-cols-3 ${
                key === enrolledUsers.length - 1
                  ? ''
                  : 'border-b border-stroke dark:border-strokedark'
              }`}
              key={key}
            >
              <div className="flex items-center gap-3 p-2.5 xl:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <svg
                    className="fill-primary"
                    width="20"
                    height="20"
                    viewBox="0 0 22 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11 9.62499C8.42188 9.62499 6.35938 7.59687 6.35938 5.12187C6.35938 2.64687 8.42188 0.618744 11 0.618744C13.5781 0.618744 15.6406 2.64687 15.6406 5.12187C15.6406 7.59687 13.5781 9.62499 11 9.62499ZM11 2.16562C9.28125 2.16562 7.90625 3.50624 7.90625 5.12187C7.90625 6.73749 9.28125 8.07812 11 8.07812C12.7188 8.07812 14.0938 6.73749 14.0938 5.12187C14.0938 3.50624 12.7188 2.16562 11 2.16562Z"
                      fill=""
                    />
                    <path
                      d="M17.7719 21.4156H4.2281C3.5406 21.4156 2.9906 20.8656 2.9906 20.1781V17.0844C2.9906 13.7156 5.7406 10.9656 9.10935 10.9656H12.925C16.2937 10.9656 19.0437 13.7156 19.0437 17.0844V20.1781C19.0094 20.8312 18.4594 21.4156 17.7719 21.4156ZM4.53748 19.8687H17.4969V17.0844C17.4969 14.575 15.4344 12.5125 12.925 12.5125H9.07498C6.5656 12.5125 4.5031 14.575 4.5031 17.0844V19.8687H4.53748Z"
                      fill=""
                    />
                  </svg>
                </div>
                <p className="font-medium text-black dark:text-white">{user}</p>
              </div>

              <div className="flex items-center justify-center p-2.5 xl:p-5">
                <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                  Enrolled
                </span>
              </div>

              <div className="hidden items-center justify-center gap-2 p-2.5 sm:flex xl:p-5">
                <button
                  onClick={() => {
                    setSelectedUserId(user);
                    setIsModalOpen(true);
                  }}
                  className="rounded-lg border border-primary px-3 py-1 text-sm text-primary hover:bg-primary hover:text-white transition"
                >
                  View
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUserId && (
        <UserDetailsModal
          personId={selectedUserId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
};

export default TableOne;
