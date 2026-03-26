import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Camera, Clock, CheckCircle, XCircle, AlertCircle, X, ZoomIn, Download } from 'lucide-react';
import { Transaction, getUserDetails } from '../../services/api';

interface LocationState {
  transaction: Transaction;
}

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failure':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-blue-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'failure':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }
};

const ReportDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState<string>('');

  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.transaction) {
      setTransaction(state.transaction);
      // Fetch user details if user_id exists (from backend transaction response)
      if ((state.transaction as any).user_id) {
        fetchUserDetails((state.transaction as any).user_id);
      } else {
        setLoading(false);
      }
    } else {
      setError('Transaction data not found');
      setLoading(false);
    }
  }, [location]);

  const fetchUserDetails = async (userId: string) => {
    try {
      const details = await getUserDetails(userId);
      if (!details.error && details.user_id) {
        setUserDetails(details);
      } else {
        console.warn('User details not found or incomplete:', details);
        // Don't set error state, just continue without user details
      }
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      // Don't set error state, just continue without user details
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/reports');
  };

  const openImageModal = (imageSrc: string) => {
    setModalImageSrc(imageSrc);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setModalImageSrc('');
  };

  const downloadImage = (imageSrc: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImageFromModal = () => {
    if (modalImageSrc) {
      downloadImage(modalImageSrc, `transaction-image-${transaction?.id || 'unknown'}.jpg`);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-2xl h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-bodydark">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="mx-auto max-w-screen-2xl h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Transaction not found'}</p>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-2 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-screen-2xl h-full flex flex-col space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-2 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </button>
          </div>
        </div>

        {/* Combined Details Section */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
            <h2 className="text-lg font-semibold text-black dark:text-white">Transaction & User Details</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Transaction Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-black dark:text-white mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Transaction Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-bodydark2 block mb-1">Transaction ID</label>
                        <p className="font-mono text-sm text-black dark:text-white bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{transaction.id}</p>
                      </div>
                      <div>
                        <label className="text-xs text-bodydark2 block mb-1">Status</label>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-bodydark2 block mb-1">User Name</label>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-bodydark2" />
                          <p className="text-sm text-black dark:text-white">{transaction.userName || transaction.person_id || 'Unknown'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-bodydark2 block mb-1">Person ID</label>
                        <p className="font-mono text-sm text-black dark:text-white bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{transaction.person_id || '-'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-bodydark2 block mb-1">Camera</label>
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-bodydark2" />
                          <p className="text-sm text-black dark:text-white">
                            {transaction.cameraName || transaction.cameraId || 'Unknown Camera'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-bodydark2 block mb-1">Timestamp</label>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-bodydark2" />
                          <p className="text-sm text-black dark:text-white">{formatTimestamp(transaction.timestamp)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Captured Image Display - What the camera captured */}
                    {(transaction as any).captured_image_url && (
                      <div>
                        <label className="text-xs text-bodydark2 block mb-2 flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Captured Image (from camera)
                        </label>
                        <div className="mt-2 relative group">
                          <img
                            src={`http://localhost:8000${(transaction as any).captured_image_url}`}
                            alt="Captured camera image"
                            className="w-full max-w-sm rounded-lg border border-stroke dark:border-strokedark shadow-sm cursor-pointer transition-transform hover:scale-105"
                            onError={(e) => {
                              console.error('Failed to load captured image:', (transaction as any).captured_image_url);
                              e.currentTarget.style.display = 'none';
                            }}
                            onClick={() => openImageModal(`http://localhost:8000${(transaction as any).captured_image_url}`)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                              <ZoomIn className="h-4 w-4" />
                              <span className="text-sm">Click to zoom</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => downloadImage(`http://localhost:8000${(transaction as any).captured_image_url}`, `captured_${transaction.id}.jpg`)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs rounded hover:bg-opacity-90 transition-all"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                          <p className="text-xs text-bodydark2 mt-1">Click image to enlarge</p>
                        </div>
                      </div>
                    )}

                    {/* Processed Image Display */}
                    {(transaction as any).image_url && (
                      <div>
                        <label className="text-xs text-bodydark2 block mb-2 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Enrolled Reference Image
                        </label>
                        <div className="mt-2 relative group">
                          <img
                            src={`http://localhost:8000${(transaction as any).image_url}`}
                            alt="Enrolled reference image"
                            className="w-full max-w-sm rounded-lg border border-stroke dark:border-strokedark shadow-sm cursor-pointer transition-transform hover:scale-105"
                            onError={(e) => {
                              console.error('Failed to load image:', (transaction as any).image_url);
                              e.currentTarget.style.display = 'none';
                            }}
                            onClick={() => openImageModal(`http://localhost:8000${(transaction as any).image_url}`)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                              <ZoomIn className="h-4 w-4" />
                              <span className="text-sm">Click to zoom</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => downloadImage(`http://localhost:8000${(transaction as any).image_url}`, `enrolled_${transaction.id}.jpg`)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs rounded hover:bg-opacity-90 transition-all"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                          <p className="text-xs text-bodydark2 mt-1">Click image to enlarge</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - User Details */}
                <div className="space-y-6">
                  {userDetails ? (
                    <div>
                      <h3 className="text-base font-semibold text-black dark:text-white mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        User Information
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-bodydark2 block mb-1">Name</label>
                            <p className="text-sm text-black dark:text-white">{userDetails.name}</p>
                          </div>
                          <div>
                            <label className="text-xs text-bodydark2 block mb-1">Email</label>
                            <p className="text-sm text-black dark:text-white">{userDetails.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-bodydark2 block mb-1">User ID</label>
                            <p className="font-mono text-sm text-black dark:text-white bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{userDetails.user_id}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-base font-semibold text-black dark:text-white mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        User Information
                      </h3>
                      <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-center">
                          <p className="text-sm text-black dark:text-white">No user information available.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl max-h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-semibold">Image Viewer</h3>
              <div className="flex gap-2">
                <button
                  onClick={downloadImageFromModal}
                  className="bg-white bg-opacity-20 text-white p-2 rounded-full hover:bg-opacity-30 transition-colors"
                  title="Download image"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  onClick={closeImageModal}
                  className="bg-white bg-opacity-20 text-white p-2 rounded-full hover:bg-opacity-30 transition-colors"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-white rounded-lg overflow-hidden">
              <img
                src={modalImageSrc}
                alt="Full size processed image"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  console.error('Failed to load modal image:', modalImageSrc);
                  e.currentTarget.src = '';
                }}
              />
            </div>
            <div className="text-center mt-2">
              <p className="text-white text-sm">
                Transaction ID: {transaction?.id} | 
                Timestamp: {transaction ? formatTimestamp(transaction.timestamp) : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportDetailPage;
