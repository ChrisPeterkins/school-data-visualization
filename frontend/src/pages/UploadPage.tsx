import React, { useState, useRef } from 'react';

const API_URL = 'http://localhost:3000';

export default function UploadPage() {
  const [selectedType, setSelectedType] = useState<string>('pvaas');
  const [selectedLevel, setSelectedLevel] = useState<string>('school');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
    setError('');
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload files one by one
      const results: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const singleFormData = new FormData();
        singleFormData.append('file', files[i]);

        const response = await fetch(
          `${API_URL}/api/upload/upload?type=${selectedType}&level=${selectedLevel}`,
          {
            method: 'POST',
            body: singleFormData,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to upload ${files[i].name}`);
        }

        const result = await response.json();
        results.push(result.file);
      }

      setUploadedFiles(prev => [...prev, ...results]);
      setFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      alert(`Successfully uploaded ${results.length} file(s)!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">File Upload</h1>
          <p className="text-gray-600 mb-6">Upload PVAAS, PSSA, or Keystone data files</p>

          <div className="space-y-6">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pvaas">PVAAS (Growth Data)</option>
                <option value="pssa">PSSA (Test Results)</option>
                <option value="keystone">Keystone (Test Results)</option>
              </select>
            </div>

            {/* Level Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Level
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="school">School Level</option>
                <option value="district">District Level</option>
                <option value="county">County Level</option>
                <option value="state">State Level</option>
              </select>
            </div>

            {/* File Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Files
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Only Excel files (.xlsx, .xls) are allowed. Maximum 100MB per file.
              </p>
            </div>

            {/* Selected Files Preview */}
            {files && files.length > 0 && (
              <div className="bg-gray-50 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Selected Files ({files.length})
                </h3>
                <ul className="space-y-1">
                  {Array.from(files).map((file, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      • {file.name} ({formatBytes(file.size)})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={uploading || !files || files.length === 0}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Files'}
            </button>

            {/* Upload Path Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>Upload destination:</strong> <br />
                <code className="text-xs bg-blue-100 px-2 py-1 rounded">
                  /sources/{selectedType}/{selectedLevel}/
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Recently Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Recently Uploaded ({uploadedFiles.length})
            </h2>
            <div className="space-y-2">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                >
                  <div>
                    <p className="font-medium text-gray-900">{file.filename}</p>
                    <p className="text-sm text-gray-500">{file.path}</p>
                  </div>
                  <span className="text-sm text-gray-600">
                    {formatBytes(file.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
