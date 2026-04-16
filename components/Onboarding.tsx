'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Sparkles, Check } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';

const INTEREST_CATEGORIES = [
  { id: 'tech', label: 'Technology', tags: ['AI', 'Web3', 'Startups', 'Programming', 'Gadgets'] },
  { id: 'design', label: 'Design', tags: ['UI/UX', 'Typography', 'Illustration', '3D', 'Architecture'] },
  { id: 'lifestyle', label: 'Lifestyle', tags: ['Travel', 'Fitness', 'Food', 'Fashion', 'Mindfulness'] },
  { id: 'entertainment', label: 'Entertainment', tags: ['Movies', 'Gaming', 'Music', 'Anime', 'Books'] },
];

export function Onboarding() {
  const { profile, setProfile } = useAppStore();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleComplete = async () => {
    if (!profile || selectedInterests.length < 3) return;
    
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        interests: selectedInterests,
        onboardingCompleted: true
      });
      
      // Update local state
      setProfile({ ...profile, interests: selectedInterests, onboardingCompleted: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-3xl bg-secondary/40 backdrop-blur-xl border border-border rounded-3xl p-8 relative z-10 shadow-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">What are you into?</h1>
          <p className="text-lg text-muted-foreground">
            Aura&apos;s AI will dynamically adapt your feed based on your selections.
            <br />Select at least 3 interests to get started.
          </p>
        </div>

        <div className="space-y-8 mb-10">
          {INTEREST_CATEGORIES.map((category) => (
            <div key={category.id}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {category.label}
              </h3>
              <div className="flex flex-wrap gap-3">
                {category.tags.map((tag) => {
                  const isSelected = selectedInterests.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2
                        ${isSelected 
                          ? 'bg-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] border border-primary' 
                          : 'bg-background text-foreground border border-border hover:border-primary/50'
                        }`}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-border">
          <span className="text-muted-foreground font-medium">
            {selectedInterests.length} selected
          </span>
          <button
            onClick={handleComplete}
            disabled={selectedInterests.length < 3 || isSubmitting}
            className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {isSubmitting ? 'Personalizing...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}
