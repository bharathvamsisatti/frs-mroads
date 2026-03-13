import { useEffect, useState } from 'react';
import { X, User, Mail, Image as ImageIcon, Database, Loader2, TrendingUp } from 'lucide-react';
import { getUserDetails, UserDetailsResponse } from '../../services/api';

const API_BASE_URL = 'http://localhost:8000';

interface UserDetailsModalProps {
  personId: string;
  isOpen: boolean;
  onClose: () => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ personId, isOpen, onClose }) => {
  const [userDetails, setUserDetails] = useState<UserDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && personId) {
      loadUserDetails();
    }
  }, [isOpen, personId]);

  const loadUserDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const details = await getUserDetails(personId);
      setUserDetails(details);
    } catch (err: any) {
      console.error('Failed to load user details:', err);
      setError(err?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-boxdark rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stroke dark:border-strokedark">
          <h2 className="text-2xl font-bold text-black dark:text-white">User Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-meta-4 rounded-lg transition"
          >
            <X className="h-5 w-5 text-bodydark" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-bodydark">Loading user details...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4 mb-4">
                <X className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error loading user details</p>
              <p className="text-bodydark2 text-sm">{error}</p>
              <button
                onClick={loadUserDetails}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90"
              >
                Retry
              </button>
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* User Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-bodydark2">Name</p>
                      <p className="text-lg font-semibold text-black dark:text-white">{userDetails.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-bodydark2">Email</p>
                      <p className="text-lg font-semibold text-black dark:text-white">
                        {userDetails.email || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-bodydark2">Person ID</p>
                      <p className="text-lg font-semibold text-black dark:text-white">{userDetails.person_id}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Attendance Percentage Card */}
                  <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <p className="text-sm font-medium text-bodydark2">Attendance Rate</p>
                        </div>
                        <p className="text-4xl font-bold text-primary">
                          {userDetails.attendance_percentage !== undefined ? `${userDetails.attendance_percentage}%` : 'N/A'}
                        </p>
                        <p className="text-xs text-bodydark2 mt-1">Last 30 days</p>
                      </div>
                      <div className="relative w-20 h-20">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="35"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="none"
                            className="text-gray-200 dark:text-gray-700"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="35"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${(userDetails.attendance_percentage || 0) * 2.199} ${100 * 2.199}`}
                            className="text-primary"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {userDetails.attendance_percentage !== undefined ? `${userDetails.attendance_percentage}%` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enrollment Statistics */}
                  <div className="p-4 bg-gray-50 dark:bg-meta-4 rounded-lg">
                    <p className="text-sm text-bodydark2 mb-2">Enrollment Statistics</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-bodydark">Embeddings:</span>
                        <span className="font-semibold text-black dark:text-white">{userDetails.embedding_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-bodydark">Models:</span>
                        <span className="font-semibold text-black dark:text-white">{userDetails.models?.join(', ') || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-bodydark">Images:</span>
                        <span className="font-semibold text-black dark:text-white">{userDetails.image_count !== undefined ? userDetails.image_count : (userDetails.enrolled_images?.length || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enrolled Images Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold text-black dark:text-white">
                    Enrolled Images ({userDetails.image_count !== undefined ? userDetails.image_count : (userDetails.enrolled_images?.length || 0)})
                  </h3>
                </div>
                {userDetails.enrolled_images && userDetails.enrolled_images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {userDetails.enrolled_images.map((image, index) => (
                      <div
                        key={index}
                        className="relative group rounded-lg overflow-hidden border border-stroke dark:border-strokedark bg-gray-50 dark:bg-meta-4 hover:shadow-lg transition-shadow"
                      >
                        <img
                          src={`${API_BASE_URL}${image.url}`}
                          alt={`${userDetails.name} - ${image.filename}`}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage not found%3C/text%3E%3C/svg%3E';
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          <p className="text-white text-xs font-medium truncate mb-1">{image.filename}</p>
                          {userDetails.email && (
                            <p className="text-white/80 text-xs truncate">{userDetails.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-bodydark2">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No enrolled images found</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-stroke dark:border-strokedark">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-stroke dark:border-strokedark rounded-lg text-black dark:text-white hover:bg-gray-50 dark:hover:bg-meta-4 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;

