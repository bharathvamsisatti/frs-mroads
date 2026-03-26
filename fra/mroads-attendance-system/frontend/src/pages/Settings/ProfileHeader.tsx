import React, { useRef, useState } from 'react';
import userThree from '../../images/user/user-03.png';
import { updateProfileImage } from '../../services/api';

interface ProfileHeaderProps {
  name: string;
  email: string;
  onImageUpdate?: (imageUrl: string) => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, email, onImageUpdate }) => {
  const [avatarSrc, setAvatarSrc] = useState(() => {
    // Load from localStorage if available, otherwise use default
    return localStorage.getItem('profile_image') || userThree;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarSrc(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setLoading(true);
    setError(null);

    try {
      const response = await updateProfileImage(file);
      if (response.success && response.image_url) {
        setAvatarSrc(response.image_url);
        // Save to localStorage for consistency across the app
        localStorage.setItem('profile_image', response.image_url);
        // Dispatch custom event to update other components
        window.dispatchEvent(new Event('profileImageUpdated'));
        if (onImageUpdate) {
          onImageUpdate(response.image_url);
        }
      } else {
        setError(response.error || 'Failed to upload image');
        // Revert to original image on error
        setAvatarSrc(userThree);
      }
    } catch (err) {
      setError('An error occurred while uploading the image');
      setAvatarSrc(userThree);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative">
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
          <h3 className="font-medium text-black dark:text-white">Profile Photo</h3>
        </div>
        <div className="p-7">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative h-20 w-20 rounded-full">
              <img src={avatarSrc} alt="User" className="h-full w-full rounded-full object-cover" />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                </div>
              )}
              <button
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white hover:bg-opacity-90"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Edit photo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </button>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                {name}
              </span>
              <span className="block text-sm text-bodydark2">{email}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div
            id="FileUpload"
            className="relative mb-5.5 block w-full cursor-pointer appearance-none rounded border border-dashed border-primary bg-gray py-4 px-4 dark:bg-meta-4 sm:py-7.5"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 z-50 m-0 h-full w-full cursor-pointer p-0 opacity-0 outline-none"
              disabled={loading}
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M1.99967 9.33337C2.36786 9.33337 2.66634 9.63185 2.66634 10V12.6667C2.66634 12.8435 2.73658 13.0131 2.8616 13.1381C2.98663 13.2631 3.1562 13.3334 3.33301 13.3334H12.6663C12.8431 13.3334 13.0127 13.2631 13.1377 13.1381C13.2628 13.0131 13.333 12.8435 13.333 12.6667V10C13.333 9.63185 13.6315 9.33337 13.9997 9.33337C14.3679 9.33337 14.6663 9.63185 14.6663 10V12.6667C14.6663 13.1971 14.4556 13.7058 14.0806 14.0809C13.7055 14.456 13.1968 14.6667 12.6663 14.6667H3.33301C2.80257 14.6667 2.29387 14.456 1.91879 14.0809C1.54372 13.7058 1.33301 13.1971 1.33301 12.6667V10C1.33301 9.63185 1.63148 9.33337 1.99967 9.33337Z"
                    fill="#3C50E0"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.5286 1.52864C7.78894 1.26829 8.21106 1.26829 8.4714 1.52864L11.8047 4.86197C12.0651 5.12232 12.0651 5.54443 11.8047 5.80478C11.5444 6.06513 11.1223 6.06513 10.8619 5.80478L8 2.94285L5.13807 5.80478C4.87772 6.06513 4.45561 6.06513 4.19526 5.80478C3.93491 5.54443 3.93491 5.12232 4.19526 4.86197L7.5286 1.52864Z"
                    fill="#3C50E0"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.99967 1.33337C8.36786 1.33337 8.66634 1.63185 8.66634 2.00004V10C8.66634 10.3682 8.36786 10.6667 7.99967 10.6667C7.63148 10.6667 7.33301 10.3682 7.33301 10V2.00004C7.33301 1.63185 7.63148 1.33337 7.99967 1.33337Z"
                    fill="#3C50E0"
                  />
                </svg>
              </span>
              <p className="text-sm text-bodydark2">
                <span className="text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="mt-1.5 text-xs text-bodydark2">SVG, PNG, JPG or GIF (max, 5MB)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProfileHeader;

