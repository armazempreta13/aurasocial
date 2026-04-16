'use client';

import { AppLayout } from '@/components/AppLayout';
import Link from 'next/link';
import { MessageSquareWarning, Send, Star, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';

export default function FeedbackPage() {
  const { profile } = useAppStore();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !category || !feedback.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: profile?.uid || 'anonymous',
        userName: profile?.displayName || 'Anonymous',
        rating,
        category,
        content: feedback.trim(),
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
            <ThumbsUp className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Thank You!</h1>
          <p className="text-muted-foreground text-lg max-w-md mb-8">
            Your feedback helps us make Aura better for everyone. We appreciate your time and input.
          </p>
          <Link 
            href="/feed"
            className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6">
            <MessageSquareWarning className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight">Give Feedback</h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            How are we doing? Let us know what you love or what we can improve.
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-border/50 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Rating */}
            <div className="text-center">
              <label className="block text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Overall Experience</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      rating >= star ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <Star className={`w-6 h-6 ${rating >= star ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['Bug Report', 'Feature Request', 'Design', 'Performance', 'Other'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${
                    category === cat 
                      ? 'bg-primary/10 border-primary text-primary' 
                      : 'bg-white border-border/50 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-muted-foreground uppercase tracking-wider">Your Message</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="w-full bg-muted/30 border border-border/50 rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all min-h-[160px] resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!rating || !category || !feedback.trim() || isSubmitting}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
