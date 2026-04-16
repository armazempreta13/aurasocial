'use client';

import { useEffect } from 'react';
import { RefreshCcw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App Router Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600">
        <AlertCircle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground mb-2">Something went wrong!</h1>
      <p className="text-muted-foreground text-lg mb-8 max-w-md">
        We encountered an unexpected error. Our team has been notified.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <RefreshCcw className="w-4 h-4" />
          Try again
        </button>
        <Link
          href="/"
          className="flex items-center justify-center bg-muted text-foreground px-8 py-3 rounded-full font-bold hover:bg-muted/80 transition-all"
        >
          Go to Home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
