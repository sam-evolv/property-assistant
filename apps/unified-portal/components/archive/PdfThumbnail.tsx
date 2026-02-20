'use client';

import { useEffect, useRef, useState } from 'react';

interface PdfThumbnailProps {
  fileUrl: string;
  className?: string;
}

export function PdfThumbnail({ fileUrl, className = '' }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // Dynamic import to avoid SSR issues + reduce bundle
        const pdfjsLib = await import('pdfjs-dist');
        // Use CDN worker to avoid bundling the worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Scale to fit a 240x160 preview area
        const desiredWidth = 240;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = desiredWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.warn('[PdfThumbnail] Failed to render:', err);
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (status === 'error') return null;

  return (
    <div className={`relative w-full h-full ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}
