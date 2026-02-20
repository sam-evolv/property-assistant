'use client';

import { useEffect, useRef, useState } from 'react';

// Load PDF.js once from CDN, cache the promise globally
let _pdfjsPromise: Promise<any> | null = null;

function getPdfJs(): Promise<any> {
  if (_pdfjsPromise) return _pdfjsPromise;

  _pdfjsPromise = new Promise((resolve, reject) => {
    // Already loaded
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error('pdfjsLib not found after load')); return; }
      lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js';
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });

  return _pdfjsPromise;
}

interface PdfThumbnailProps {
  fileUrl: string;
}

export function PdfThumbnail({ fileUrl }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await getPdfJs();
        const pdf = await pdfjsLib.getDocument({ url: fileUrl, cMapPacked: true }).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Fit into the card preview width (~280px)
        const unscaled = page.getViewport({ scale: 1 });
        const scale = 280 / unscaled.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (status === 'error') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white">
      {status === 'loading' && (
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}
