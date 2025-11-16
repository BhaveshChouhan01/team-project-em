/**
 * Document Upload Component for RAG System
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface UploadedFile {
  filename: string;
  size: number;
  chunks_created: number;
  upload_timestamp: number;
}

interface DocumentUploadProps {
  userId?: string;
  onUploadSuccess?: (file: UploadedFile) => void;
}

export default function DocumentUpload({ userId, onUploadSuccess }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const allowedTypes = ['.pdf', '.docx', '.txt'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      return `File type ${fileExtension} not supported. Allowed types: ${allowedTypes.join(', ')}`;
    }
    
    if (file.size > maxFileSize) {
      return `File size exceeds 10MB limit`;
    }
    
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const error = validateFile(droppedFile);
      
      if (error) {
        setUploadStatus({ type: 'error', message: error });
      } else {
        setFile(droppedFile);
        setUploadStatus({ type: null, message: '' });
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const error = validateFile(selectedFile);
      
      if (error) {
        setUploadStatus({ type: 'error', message: error });
        setFile(null);
      } else {
        setFile(selectedFile);
        setUploadStatus({ type: null, message: '' });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadStatus({ type: null, message: '' });

    const formData = new FormData();
    formData.append('file', file);
    if (userId) {
      formData.append('userId', userId);
    }

    try {
      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUploadStatus({
          type: 'success',
          message: `Successfully uploaded ${file.name}! Created ${result.data.chunks_created} text chunks.`,
        });
        
        const uploadedFile: UploadedFile = {
          filename: result.data.filename,
          size: result.data.size,
          chunks_created: result.data.chunks_created,
          upload_timestamp: Date.now(),
        };
        
        setUploadedFiles(prev => [...prev, uploadedFile]);
        
        if (onUploadSuccess) {
          onUploadSuccess(uploadedFile);
        }
        
        setFile(null);
      } else {
        setUploadStatus({
          type: 'error',
          message: result.error || 'Upload failed',
        });
      }
    } catch (error: any) {
      setUploadStatus({
        type: 'error',
        message: error.message || 'An error occurred during upload',
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Upload Documents for RAG</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Upload PDF, DOCX, or TXT files to enhance AI responses with your documents
        </p>
      </div>
      
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          
          <div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                Click to upload
              </span>
              <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
            </label>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept={allowedTypes.join(',')}
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            PDF, DOCX, or TXT (max 10MB)
          </p>
        </div>
      </div>

      {/* Selected File Info */}
      {file && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-500 dark:text-blue-400" />
              <div>
                <p className="font-medium text-gray-800 dark:text-white">{file.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              disabled={uploading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`w-full mt-4 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
          !file || uploading
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
        }`}
      >
        {uploading ? (
          <>
            <Loader className="animate-spin h-5 w-5 mr-3" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 mr-2" />
            Upload Document
          </>
        )}
      </button>

      {/* Status Messages */}
      {uploadStatus.type && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start ${
            uploadStatus.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          )}
          <p className="font-medium">{uploadStatus.message}</p>
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {uploadedFiles.map((uploadedFile, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">{uploadedFile.filename}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatFileSize(uploadedFile.size)} • {uploadedFile.chunks_created} chunks
                    </p>
                  </div>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
