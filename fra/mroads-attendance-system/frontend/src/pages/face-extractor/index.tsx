import React, { useState } from 'react';
import { faceExtractor } from '../../services/api';
import Camera from '../../components/Camera';

const FaceExtractor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [inputMode, setInputMode] = useState<'file' | 'camera'>('file');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError('');
      setResult(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleCameraCapture = (capturedFile: File) => {
    setFile(capturedFile);
    setError('');
    setResult(null);
    setShowCamera(false);
    setInputMode('file');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(capturedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!file) {
      setError('Please select an image');
      return;
    }

    setLoading(true);

    try {
      const response = await faceExtractor(file);
      if (response.error) {
        setError(response.error);
      } else {
        setResult(response);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="p-6">
        <h2 className="mb-6 text-2xl font-bold text-black dark:text-white">
          Face Extractor
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="mb-2 block font-medium text-black dark:text-white">
              Image
            </label>
            
            {/* Input Mode Toggle */}
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputMode('file');
                  setShowCamera(false);
                }}
                className={`flex-1 rounded-lg border py-2 px-4 text-sm font-medium transition ${
                  inputMode === 'file'
                    ? 'border-primary bg-primary text-white'
                    : 'border-stroke bg-transparent text-black dark:border-strokedark dark:text-white'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('camera');
                  setShowCamera(true);
                }}
                className={`flex-1 rounded-lg border py-2 px-4 text-sm font-medium transition ${
                  inputMode === 'camera'
                    ? 'border-primary bg-primary text-white'
                    : 'border-stroke bg-transparent text-black dark:border-strokedark dark:text-white'
                }`}
              >
                Use Camera
              </button>
            </div>

            {/* File Upload */}
            {inputMode === 'file' && (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-stroke bg-transparent py-3 px-4 text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
              />
            )}

            {/* Camera Component */}
            {inputMode === 'camera' && showCamera && (
              <Camera
                onCapture={handleCameraCapture}
                onClose={() => {
                  setShowCamera(false);
                  setInputMode('file');
                }}
                multiple={false}
              />
            )}
          </div>

          {preview && (
            <div className="mb-6">
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 rounded-lg object-contain"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full rounded-lg border border-primary bg-primary py-3 text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? 'Extracting faces...' : 'Extract Faces'}
          </button>
        </form>

        {result && result.faces && (
          <div className="mt-6 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-strokedark dark:bg-meta-4">
            <h3 className="mb-3 text-lg font-semibold text-black dark:text-white">
              Extracted Faces ({result.faces.length})
            </h3>
            <div className="space-y-4">
              {result.faces.map((face: any, index: number) => (
                <div
                  key={index}
                  className="rounded-lg border border-stroke bg-white p-3 dark:border-strokedark dark:bg-boxdark"
                >
                  <p className="text-bodydark2">
                    <strong>Face ID:</strong> {face.face_id}
                  </p>
                  <p className="text-bodydark2">
                    <strong>Confidence:</strong> {face.confidence.toFixed(4)}
                  </p>
                  <p className="text-bodydark2">
                    <strong>BBox:</strong> [{face.bbox.join(', ')}]
                  </p>
                  <p className="text-bodydark2">
                    <strong>Crop URL:</strong> {face.crop_url}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceExtractor;

