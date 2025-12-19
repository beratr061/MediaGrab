import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, X, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { validateUrls } from '@/lib/validation';
import { cn } from '@/lib/utils';

interface BatchUrlImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (urls: string[]) => void;
}

export function BatchUrlImport({ isOpen, onClose, onImport }: BatchUrlImportProps) {
  const { t } = useTranslation();
  const [urls, setUrls] = useState('');
  const [validationResult, setValidationResult] = useState<{ valid: string[]; invalid: { url: string; error: string }[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = useCallback((text: string) => {
    setUrls(text);
    // Validate as user types
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      setValidationResult(validateUrls(lines));
    } else {
      setValidationResult(null);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      handleTextChange(text);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, [handleTextChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(() => {
    if (validationResult && validationResult.valid.length > 0) {
      onImport(validationResult.valid);
      setUrls('');
      setValidationResult(null);
      onClose();
    }
  }, [validationResult, onImport, onClose]);

  const handleClose = useCallback(() => {
    setUrls('');
    setValidationResult(null);
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('batch.title', 'Batch URL Import')}
              </h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* File drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 mb-4 transition-colors cursor-pointer",
                isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="text-sm">{t('batch.dropFile', 'Drop a .txt file here or click to browse')}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            {/* URL textarea */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {t('batch.pasteUrls', 'Or paste URLs (one per line)')}
              </label>
              <textarea
                value={urls}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/...&#10;https://twitter.com/..."
                className="w-full h-40 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Validation results */}
            {validationResult && (
              <div className="mb-4 space-y-2">
                {validationResult.valid.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    {t('batch.validUrls', '{{count}} valid URLs', { count: validationResult.valid.length })}
                  </div>
                )}
                {validationResult.invalid.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {t('batch.invalidUrls', '{{count}} invalid URLs', { count: validationResult.invalid.length })}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                {t('buttons.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!validationResult || validationResult.valid.length === 0}
              >
                {t('batch.import', 'Import {{count}} URLs', { count: validationResult?.valid.length || 0 })}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
