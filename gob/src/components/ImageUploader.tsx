"use client";

import { useState, useCallback } from "react";

interface ImageUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxFileSizeMB?: number;
}

export function ImageUploader({
  files,
  onChange,
  maxFiles = 5,
  maxFileSizeMB = 5,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndAdd = useCallback(
    (newFiles: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(newFiles);
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (files.length + incoming.length > maxFiles) { setError(`Maximum ${maxFiles} images allowed`); return; }
      for (const file of incoming) {
        if (!allowedTypes.includes(file.type)) { setError(`"${file.name}" is not a supported image type.`); return; }
        if (file.size > maxFileSizeMB * 1024 * 1024) { setError(`"${file.name}" exceeds ${maxFileSizeMB}MB limit`); return; }
      }
      onChange([...files, ...incoming]);
    },
    [files, onChange, maxFiles, maxFileSizeMB]
  );

  const removeFile = (index: number) => { onChange(files.filter((_, i) => i !== index)); setError(null); };

  const handleDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) validateAndAdd(e.dataTransfer.files); },
    [validateAndAdd]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { validateAndAdd(e.target.files); e.target.value = ""; }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text-secondary">Screenshots ({files.length}/{maxFiles})</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("image-upload-input")?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary-subtle/20" : "border-dark-border-light hover:border-dark-border bg-dark-surface-2"
        }`}
      >
        <input id="image-upload-input" type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFileInput} />
        <div className="text-text-muted">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Click or drag images here</p>
          <p className="text-xs mt-1">JPEG, PNG, or WebP. Max {maxFileSizeMB}MB each.</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-300 bg-red-950/30 rounded-lg p-2">{error}</p>}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative group aspect-square rounded-lg overflow-hidden border border-dark-border bg-dark-surface">
              <img src={URL.createObjectURL(file)} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                aria-label={`Remove screenshot ${index + 1}`}>✕</button>
              <span className="absolute bottom-1 left-1 bg-black/70 text-text-secondary text-[10px] px-1.5 py-0.5 rounded">{Math.round(file.size / 1024)}KB</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}