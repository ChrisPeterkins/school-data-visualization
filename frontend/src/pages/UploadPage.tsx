import React, { useState, useRef } from 'react';

const API_URL = '/paschools';

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
      const results: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const singleFormData = new FormData();
        singleFormData.append('file', files[i]);

        const response = await fetch(
          `${API_URL}/api/upload/upload?type=${selectedType}&level=${selectedLevel}`,
          { method: 'POST', body: singleFormData }
        );

        if (!response.ok) throw new Error(`Failed to upload ${files[i].name}`);
        const result = await response.json();
        results.push(result.file);
      }

      setUploadedFiles(prev => [...prev, ...results]);
      setFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="card-surface p-6 mb-6">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight mb-1">File Upload</h1>
        <p className="text-sm text-stone-500 mb-6">Upload PVAAS, PSSA, or Keystone data files</p>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Data Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500">
              <option value="pvaas">PVAAS (Growth Data)</option>
              <option value="pssa">PSSA (Test Results)</option>
              <option value="keystone">Keystone (Test Results)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Level</label>
            <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500">
              <option value="school">School Level</option>
              <option value="district">District Level</option>
              <option value="county">County Level</option>
              <option value="state">State Level</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Select Files</label>
            <input ref={fileInputRef} type="file" multiple accept=".xlsx,.xls" onChange={handleFileChange}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30" />
            <p className="text-xs text-stone-500 mt-1">Only Excel files (.xlsx, .xls). Max 100MB per file.</p>
          </div>

          {files && files.length > 0 && (
            <div className="bg-stone-50 rounded-lg p-4">
              <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Selected Files ({files.length})</h3>
              <ul className="space-y-1">
                {Array.from(files).map((file, idx) => (
                  <li key={idx} className="text-sm text-stone-600">- {file.name} ({formatBytes(file.size)})</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="bg-brick-50 border border-brick-200 rounded-lg p-3">
              <p className="text-sm text-brick-700">{error}</p>
            </div>
          )}

          <button onClick={handleUpload} disabled={uploading || !files || files.length === 0}
            className="w-full bg-navy-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-navy-600 disabled:opacity-40 disabled:pointer-events-none transition-colors">
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>

          <div className="bg-navy-50 border border-navy-100 rounded-lg p-3">
            <p className="text-sm text-navy-800">
              <strong>Destination:</strong>{' '}
              <code className="text-xs bg-navy-100 px-2 py-0.5 rounded font-mono">/sources/{selectedType}/{selectedLevel}/</code>
            </p>
          </div>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="card-surface p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Recently Uploaded ({uploadedFiles.length})</h2>
          <div className="space-y-2">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-stone-900">{file.filename}</p>
                  <p className="text-xs text-stone-500">{file.path}</p>
                </div>
                <span className="text-xs text-stone-500">{formatBytes(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
