'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';
import { useRequireAuth } from '@/hooks/useRequireAuth';

function MessagesPageContent() {
  const { user, isAuthReady } = useRequireAuth();

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return <ChatWorkspace />;
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
