import { useState, useRef } from 'react';
import { FaceVerification, FaceVerificationRef } from '../../components/FaceEnroll';
import { User, Upload, Camera, Fingerprint } from 'lucide-react';

type VerificationMethod = 'upload' | 'camera' | 'faceid';

const Verify: React.FC = () => {
  const verificationRef = useRef<FaceVerificationRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod>('faceid');
  const [showFaceID, setShowFaceID] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    matched: boolean;
    confidence?: number;
    identity?: string;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleStartFaceID = () => {
    setShowFaceID(true);
    setMatchResult(null);
    setShowResult(false);
    setTimeout(() => {
      verificationRef.current?.startVerification();
    }, 100);
  };

  const handleComplete = (result: { matched: boolean; confidence?: number; identity?: string; person?: any }) => {
    setMatchResult(result);
    setShowResult(true);
    setShowFaceID(false);
    
    // Auto-reset after 5 seconds
    setTimeout(() => {
      setShowResult(false);
      setMatchResult(null);
      verificationRef.current?.reset();
    }, 5000);
  };

  const handleCloseFaceID = () => {
    setShowFaceID(false);
    verificationRef.current?.stopVerification();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setMatchResult(null);
    setShowResult(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/verify', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.identity && result.identity !== 'Unknown') {
        setMatchResult({
          matched: true,
          confidence: result.average_score,
          identity: result.identity,
        });
      } else {
        setMatchResult({ matched: false });
      }
      setShowResult(true);

      // Auto-reset after 5 seconds
      setTimeout(() => {
        setShowResult(false);
        setMatchResult(null);
      }, 5000);
    } catch (error) {
      console.error('Verification error:', error);
      setMatchResult({ matched: false });
      setShowResult(true);
      setTimeout(() => {
        setShowResult(false);
        setMatchResult(null);
      }, 5000);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Process the captured image same as file upload
    await handleFileUpload(event);
  };

  return (
    <div className="space-y-6">
    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-4 py-6 dark:border-strokedark sm:px-6">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-black dark:text-white">
          Verify User
        </h2>
          </div>
          <p className="mt-2 text-sm text-bodydark">
            Position your face in front of the camera. The system will automatically verify your identity.
          </p>
            </div>

        <div className="p-6">
          {/* Method Selection */}
          {!showFaceID && !showResult && !isProcessing && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Upload Image Option */}
                <button
                  onClick={() => {
                    setSelectedMethod('upload');
                    fileInputRef.current?.click();
                  }}
                  className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 transition-all ${
                    selectedMethod === 'upload'
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-stroke bg-gray dark:border-strokedark dark:bg-meta-4 hover:border-primary/50'
                  }`}
                >
                  <Upload className={`h-8 w-8 ${selectedMethod === 'upload' ? 'text-primary' : 'text-bodydark'}`} />
                  <span className={`font-semibold ${selectedMethod === 'upload' ? 'text-primary' : 'text-black dark:text-white'}`}>
                    Upload Image
                  </span>
                  <span className="text-xs text-bodydark text-center">
                    Upload an image file to verify
                  </span>
                </button>

                {/* Manual Camera Option */}
                <button
                  onClick={() => {
                    setSelectedMethod('camera');
                    cameraInputRef.current?.click();
                  }}
                  className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 transition-all ${
                    selectedMethod === 'camera'
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-stroke bg-gray dark:border-strokedark dark:bg-meta-4 hover:border-primary/50'
                  }`}
                >
                  <Camera className={`h-8 w-8 ${selectedMethod === 'camera' ? 'text-primary' : 'text-bodydark'}`} />
                  <span className={`font-semibold ${selectedMethod === 'camera' ? 'text-primary' : 'text-black dark:text-white'}`}>
                    Manual Camera
                  </span>
                  <span className="text-xs text-bodydark text-center">
                    Capture photo using camera
                  </span>
                </button>

                {/* Face ID Option */}
                <button
                  onClick={() => {
                    setSelectedMethod('faceid');
                    handleStartFaceID();
                  }}
                  className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 transition-all ${
                    selectedMethod === 'faceid'
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-stroke bg-gray dark:border-strokedark dark:bg-meta-4 hover:border-primary/50'
                  }`}
                >
                  <Fingerprint className={`h-8 w-8 ${selectedMethod === 'faceid' ? 'text-primary' : 'text-bodydark'}`} />
                  <span className={`font-semibold ${selectedMethod === 'faceid' ? 'text-primary' : 'text-black dark:text-white'}`}>
                    Face ID
                  </span>
                  <span className="text-xs text-bodydark text-center">
                    Use Face ID to verify (optional)
                  </span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
              />
            </div>
          )}

          {/* Processing State */}
          {isProcessing && !showResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-lg font-medium text-black dark:text-white">Processing...</p>
            </div>
          )}

          {/* Face ID Verification Modal */}
          {showFaceID && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-85 backdrop-blur-md p-4">
              <div className="relative w-full max-w-[550px] rounded-3xl bg-[#0F0F19] p-8 shadow-2xl" style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  onClick={handleCloseFaceID}
                  className="absolute right-4 top-4 rounded-full p-2 text-white opacity-70 transition hover:opacity-100"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <FaceVerification
                  ref={verificationRef}
                  mode="verify"
                  onComplete={handleComplete}
                  onClose={handleCloseFaceID}
                />
              </div>
            </div>
          )}

          {/* Result Display (shown after verification completes) */}
          {showResult && matchResult && (
            <div className={`mt-6 rounded-lg border p-6 ${
              matchResult.matched
                ? 'border-meta-3 bg-meta-3/10 dark:bg-meta-3/20'
                : 'border-meta-1 bg-meta-1/10 dark:bg-meta-1/20'
            }`}>
              <div className="flex items-start gap-4">
                {matchResult.matched ? (
                  <>
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-meta-3 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-meta-3 mb-2">
                        Identity Verified
            </h3>
                      {matchResult.identity && (
                        <p className="text-sm text-black dark:text-white mb-1">
                          <strong>Identity:</strong> {matchResult.identity}
                </p>
                      )}
                      {matchResult.confidence !== undefined && (
                        <p className="text-sm text-bodydark">
                          <strong>Confidence:</strong> {(matchResult.confidence * 100).toFixed(2)}%
                  </p>
                )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-meta-1 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-meta-1 mb-2">
                        Verification Failed
                      </h3>
                      <p className="text-sm text-bodydark">
                        The face detected does not match any enrolled user in the system.
                      </p>
                  </div>
                  </>
                )}
              </div>
            </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default Verify;

