'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useTranslation } from 'react-i18next';
import { auth } from '@/firebase';
import { 
  Play, 
  Pause, 
  Trash2, 
  Plus, 
  Settings,
  BarChart3,
  Zap,
  MessageCircle,
  Heart,
  Share2,
} from 'lucide-react';
import { BotConfig } from '@/lib/bot-system/models/bot.types';

export function BotSystemControl() {
  const { t } = useTranslation();
  const profile = useAppStore((state) => state.profile);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotConfig | null>(null);
  const [newBotName, setNewBotName] = useState('');

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch('/api/admin/bots/list', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setBots(data);
      }
    } catch (error) {
      console.error('Error loading bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBot = async () => {
    if (!newBotName.trim()) return;

    try {
      setCreating(true);
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch('/api/admin/bots/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newBotName,
          enabled: true,
          postsPerDay: 2,
          commentsPerPost: 1,
          likePercentage: 30,
        }),
      });

      if (res.ok) {
        setNewBotName('');
        loadBots();
      }
    } catch (error) {
      console.error('Error creating bot:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleBotAction = async (botId: string, action: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`/api/admin/bots/${botId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        loadBots();
      }
    } catch (error) {
      console.error('Error updating bot:', error);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Delete this bot?')) return;

    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`/api/admin/bots/${botId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        loadBots();
      }
    } catch (error) {
      console.error('Error deleting bot:', error);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Bot System Control
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage automated post generation and engagement
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {bots.length} Bots Created
          </p>
          <p className="text-xs text-muted-foreground">
            {bots.filter(b => b.status === 'running').length} Running
          </p>
        </div>
      </div>

      {/* Create Bot Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Bot name (e.g., Tech Enthusiast Bot)"
            value={newBotName}
            onChange={(e) => setNewBotName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateBot()}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleCreateBot}
            disabled={creating || !newBotName.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      {/* Bots Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading bots...</p>
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-muted-foreground">No bots created yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5 hover:border-primary/30 transition-all"
            >
              {/* Bot Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">{bot.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      bot.status === 'running' ? 'bg-green-500' :
                      bot.status === 'paused' ? 'bg-yellow-500' :
                      'bg-slate-400'
                    }`} />
                    <p className="text-xs text-muted-foreground capitalize">
                      {bot.status}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {bot.status !== 'running' && (
                    <button
                      onClick={() => handleBotAction(bot.id, 'start')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Start bot"
                    >
                      <Play className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  {bot.status === 'running' && (
                    <button
                      onClick={() => handleBotAction(bot.id, 'pause')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Pause bot"
                    >
                      <Pause className="w-4 h-4 text-yellow-500" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteBot(bot.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete bot"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Bot Stats */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg mb-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-bold text-foreground">
                    <Zap className="w-3 h-3" />
                    {bot.postsPerDay}
                  </div>
                  <p className="text-xs text-muted-foreground">Posts/day</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-bold text-foreground">
                    <MessageCircle className="w-3 h-3" />
                    {bot.commentsPerPost}
                  </div>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-bold text-foreground">
                    <Heart className="w-3 h-3" />
                    {bot.likePercentage}%
                  </div>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
              </div>

              {/* Bot Configuration */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Image Rate:</span>
                  <span className="font-medium text-foreground">{bot.imagePercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delay:</span>
                  <span className="font-medium text-foreground">{(bot.delayBetweenActions / 1000).toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium text-foreground">
                    {new Date(bot.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
