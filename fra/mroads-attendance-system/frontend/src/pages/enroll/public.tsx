import { useState, useRef } from 'react';
import Camera, { CameraRef } from '../../components/Camera';
import { FaceEnrollmentController, FaceEnrollmentControllerRef } from '../../components/FaceEnroll';
import { Upload, Camera as CameraIcon, Fingerprint, UserPlus } from 'lucide-react';

const PublicEnroll: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [inputMode, setInputMode] = useState<'file' | 'camera' | 'faceid'>('file');
    const cameraRef = useRef<CameraRef>(null);
    const faceEnrollRef = useRef<FaceEnrollmentControllerRef>(null);
    const [isEnrollmentComplete, setIsEnrollmentComplete] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length < 3 || selectedFiles.length > 5) {
                setError('Please select 3-5 images');
                return;
            }
            setFiles(selectedFiles);
            setError('');

            // Stop camera when files are uploaded
            if (cameraRef.current) {
                cameraRef.current.stopCamera();
            }
            setShowCamera(false);
        }
    };

    const handleCameraCapture = (file: File) => {
        const newFiles = [...files, file];
        if (newFiles.length > 5) {
            setError('Maximum 5 images allowed');
            return;
        }
        setFiles(newFiles);
        setError('');
    };

    const handleFaceEnrollCapture = (capturedFiles: File[]) => {
        setFiles(capturedFiles);
        setError('');
    };

    const handleFaceEnrollComplete = (capturedFiles: File[]) => {
        setFiles(capturedFiles);
        setIsEnrollmentComplete(true);
        setError('');
        // Hide the Face ID modal and show file preview instead
        setTimeout(() => {
            setInputMode('file');
        }, 2000); // Wait 2 seconds to show the completion message
    };

    const removeFile = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        setIsEnrollmentComplete(false);
    };

    const handleModeChange = (mode: 'file' | 'camera' | 'faceid') => {
        // Stop any running cameras
        if (cameraRef.current) {
            cameraRef.current.stopCamera();
        }
        setInputMode(mode);
        setShowCamera(mode === 'camera');
        setIsEnrollmentComplete(false);
        if (mode !== 'file') {
            setFiles([]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!name.trim()) {
            setError('Please enter a name');
            return;
        }

        if (!email.trim()) {
            setError('Please enter an email');
            return;
        }

        // Stop camera if it's running
        if (cameraRef.current) {
            cameraRef.current.stopCamera();
        }
        setShowCamera(false);

        if (files.length < 3 || files.length > 5) {
            setError('Please select 3-5 images');
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            files.forEach((file) => {
                formData.append('files', file);
            });

            const API_BASE_URL = import.meta.env.VITE_LOCAL_BACKEND_URL || 'http://localhost:8000';
            const response = await fetch(`${API_BASE_URL}/api/enroll/public`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result.message) {
                setSuccess(result.message || 'Enrollment successful!');
                setName('');
                setEmail('');
                setFiles([]);
                setIsEnrollmentComplete(false);
                if (faceEnrollRef.current) {
                    faceEnrollRef.current.reset();
                }
            } else {
                setError(result.error || result.detail || 'Enrollment failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Enrollment error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-boxdark-2 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                    <div className="border-b border-stroke px-4 py-6 dark:border-strokedark sm:px-6">
                        <div className="flex items-center gap-3">
                            <UserPlus className="h-6 w-6 text-primary" />
                            <h2 className="text-2xl font-bold text-black dark:text-white">
                                Public Enrollment
                            </h2>
                        </div>
                        <p className="mt-2 text-sm text-bodydark">
                            Register yourself in the face recognition system by providing your details and 3-5 clear images.
                        </p>
                    </div>

                    <div className="p-6">
                        {error && (
                            <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block font-medium text-black dark:text-white">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-stroke bg-transparent py-3 px-4 text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block font-medium text-black dark:text-white">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-stroke bg-transparent py-3 px-4 text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="mb-4 block font-medium text-black dark:text-white">
                                    Images (3-5 required) *
                                </label>

                                {/* Input Method Selection */}
                                <div className="mb-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Upload Image Option */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleModeChange('file');
                                                const fileInput = document.getElementById('public-file-upload') as HTMLInputElement;
                                                if (fileInput) {
                                                    fileInput.click();
                                                }
                                            }}
                                            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 transition-all ${inputMode === 'file'
                                                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                                                    : 'border-stroke bg-gray dark:border-strokedark dark:bg-meta-4 hover:border-primary/50'
                                                }`}
                                        >
                                            <Upload className={`h-8 w-8 ${inputMode === 'file' ? 'text-primary' : 'text-bodydark'}`} />
                                            <span className={`font-semibold ${inputMode === 'file' ? 'text-primary' : 'text-black dark:text-white'}`}>
                                                Upload Images
                                            </span>
                                            <span className="text-xs text-bodydark text-center">
                                                Upload 3-5 image files
                                            </span>
                                        </button>

                                        {/* Manual Camera Option */}
                                        <button
                                            type="button"
                                            onClick={() => handleModeChange('camera')}
                                            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 transition-all ${inputMode === 'camera'
                                                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                                                    : 'border-stroke bg-gray dark:border-strokedark dark:bg-meta-4 hover:border-primary/50'
                                                }`}
                                        >
                                            <CameraIcon className={`h-8 w-8 ${inputMode === 'camera' ? 'text-primary' : 'text-bodydark'}`} />
                                            <span className={`font-semibold ${inputMode === 'camera' ? 'text-primary' : 'text-black dark:text-white'}`}>
                                                Use Camera
                                            </span>
                                            <span className="text-xs text-bodydark text-center">
                                                Capture photos using webcam
                                            </span>
                                        </button>

                                        {/* Face ID Option */}
                                        <button
                                            type="button"
                                            onClick={() => handleModeChange('faceid')}
                                            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 transition-all ${inputMode === 'faceid'
                                                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                                                    : 'border-stroke bg-gray dark:border-strokedark dark:bg-meta-4 hover:border-primary/50'
                                                }`}
                                        >
                                            <Fingerprint className={`h-8 w-8 ${inputMode === 'faceid' ? 'text-primary' : 'text-bodydark'}`} />
                                            <span className={`font-semibold ${inputMode === 'faceid' ? 'text-primary' : 'text-black dark:text-white'}`}>
                                                Face ID Scan
                                            </span>
                                            <span className="text-xs text-bodydark text-center">
                                                5-direction face capture
                                            </span>
                                        </button>
                                    </div>

                                    {/* Hidden file input */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="public-file-upload"
                                    />
                                </div>

                                {/* Manual Camera Component */}
                                {inputMode === 'camera' && showCamera && (
                                    <Camera
                                        ref={cameraRef}
                                        onCapture={handleCameraCapture}
                                        onClose={() => {
                                            setShowCamera(false);
                                            setInputMode('file');
                                        }}
                                        multiple={true}
                                        maxFiles={5}
                                    />
                                )}

                                {/* Face ID Enrollment Component */}
                                {inputMode === 'faceid' && (
                                    <div style={{
                                        position: 'fixed',
                                        inset: 0,
                                        zIndex: 9999,
                                        background: 'rgba(0, 0, 0, 0.85)',
                                        backdropFilter: 'blur(8px)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '1rem'
                                    }}>
                                        <div style={{
                                            width: '100%',
                                            maxWidth: '900px'
                                        }}>
                                            <FaceEnrollmentController
                                                ref={faceEnrollRef}
                                                onCaptureProgress={handleFaceEnrollCapture}
                                                onComplete={handleFaceEnrollComplete}
                                                onClose={() => setInputMode('file')}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* File Preview */}
                                {files.length > 0 && (
                                    <div className="mt-4">
                                        <p className="mb-2 text-sm text-bodydark2">
                                            Selected Images ({files.length}/5)
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {files.map((file, index) => (
                                                <div key={index} className="relative">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt={`Preview ${index + 1}`}
                                                        className="h-20 w-20 rounded-lg object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(index)}
                                                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                                                    >
                                                        <svg
                                                            className="h-4 w-4"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M6 18L18 6M6 6l12 12"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {files.length > 0 && files.length < 3 && (
                                    <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                                        Please add {3 - files.length} more image(s) (minimum 3 required)
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || files.length < 3 || files.length > 5 || !name.trim() || !email.trim()}
                                className="w-full rounded-lg border border-primary bg-primary py-3 text-white transition hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Enrolling...' : 'Enroll Now'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicEnroll;
