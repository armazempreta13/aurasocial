'use client';

import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/lib/store';
import { Settings, User, Lock, Bell, Shield, Eye, Globe, Moon, Check, ChevronRight, Sparkles } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getDefaultRelationshipSettings, updateRelationshipSettings } from '@/lib/friendships';
import { useTranslation } from 'react-i18next';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center animate-pulse">Carregando configurações...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { t, i18n } = useTranslation('common');
  const { user, isAuthReady } = useRequireAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') || 'account';
  
  const { profile, focusMode, toggleFocusMode } = useAppStore();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [displayName, setDisplayName] = useState('');
  const [privacySettings, setPrivacySettings] = useState({
    publicProfile: true,
    directMessages: false,
    activityStatus: true
  });
  const [language, setLanguage] = useState<'pt-BR' | 'en'>('pt-BR');
  const [relationshipSettings, setRelationshipSettings] = useState(getDefaultRelationshipSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      if (profile.privacySettings) {
        setPrivacySettings(profile.privacySettings);
      }
      if (profile.relationshipSettings) {
        setRelationshipSettings({
          ...getDefaultRelationshipSettings(),
          ...profile.relationshipSettings,
        });
      }
    }
    setLanguage(i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'pt-BR');
  }, [profile, i18n.resolvedLanguage]);

  const handleSaveChanges = async () => {
    if (!profile || isSaving) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        displayName,
        privacySettings
      });
      await updateRelationshipSettings(profile.uid, relationshipSettings);
      await i18n.changeLanguage(language);
      useAppStore.setState({
        profile: {
          ...profile,
          displayName,
          privacySettings,
          relationshipSettings,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(t('settings_page.save_error', 'Não foi possível salvar suas configurações agora.'));
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    {
      id: 'account',
      label: t('settings_page.tab_account', 'Account'),
      description: t('settings_page.tab_account_desc', 'Profile, email and sign-in details'),
      icon: User,
    },
    {
      id: 'privacy',
      label: t('settings_page.tab_privacy', 'Privacy'),
      description: t('settings_page.tab_privacy_desc', 'Visibility, requests and social permissions'),
      icon: Shield,
    },
    {
      id: 'notifications',
      label: t('settings_page.tab_notifications', 'Notifications'),
      description: t('settings_page.tab_notifications_desc', 'Control what deserves your attention'),
      icon: Bell,
    },
    {
      id: 'display',
      label: t('settings_page.tab_display', 'Display'),
      description: t('settings_page.tab_display_desc', 'Appearance, focus and accessibility'),
      icon: Eye,
    },
  ];

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('settings_page.title', 'Settings')}</h1>
            <p className="text-muted-foreground">{t('settings_page.subtitle', 'Manage your account and preferences')}</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
          {/* Sidebar Tabs */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/50 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{t('settings_page.quick_title', 'Your control center')}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t('settings_page.quick_desc', 'Organize account, privacy and display preferences in one place.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/50 bg-white p-2.5 shadow-sm">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all ${
                  activeTab === section.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    activeTab === section.id ? 'bg-white/15' : 'bg-muted'
                  }`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[15px]">{section.label}</div>
                    <div className={`text-xs leading-5 ${
                      activeTab === section.id ? 'text-white/80' : 'text-muted-foreground'
                    }`}>
                      {section.description}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${activeTab === section.id ? 'text-white/80' : 'text-muted-foreground'}`} />
              </button>
            ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-3xl border border-border/50 shadow-sm p-5 sm:p-6 lg:p-7">
            {activeTab === 'account' && (
              <div className="space-y-8">
                <section>
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-foreground">{t('settings_page.account_info', 'Account Information')}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t('settings_page.account_info_desc', 'Keep your profile details clear and up to date for people who connect with you.')}
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
                      <label className="text-sm font-bold text-muted-foreground">{t('settings_page.display_name', 'Display Name')}</label>
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-muted/50 border border-border/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-muted/20 p-3.5">
                      <label className="text-sm font-bold text-muted-foreground">{t('settings_page.email', 'Email Address')}</label>
                      <input 
                        type="email" 
                        defaultValue={profile?.email}
                        disabled
                        className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-foreground">{t('settings_page.security', 'Security')}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t('settings_page.security_desc', 'Protect access to your account and review the essentials that matter most.')}
                    </p>
                  </div>
                  <button className="flex items-center gap-4 w-full p-4 rounded-3xl border border-border/50 hover:bg-muted/30 transition-all text-left group">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-foreground">{t('settings_page.change_pwd', 'Change Password')}</div>
                      <div className="text-sm text-muted-foreground">{t('settings_page.change_pwd_desc', 'Update your account password regularly')}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </section>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-5">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-foreground">{t('settings_page.privacy_title', 'Privacy Settings')}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t('settings_page.privacy_title_desc', 'Decide who can see, reach and interact with you across the network.')}
                  </p>
                </div>
                <div className="space-y-4">
                  <PrivacyToggle 
                    title={t('settings_page.public_profile', 'Public Profile')}
                    description={t('settings_page.public_profile_desc', 'Allow anyone to see your profile and posts')}
                    checked={privacySettings.publicProfile}
                    onChange={(val) => setPrivacySettings({...privacySettings, publicProfile: val})}
                  />
                  <PrivacyToggle 
                    title={t('settings_page.direct_messages', 'Direct Messages')}
                    description={t('settings_page.direct_messages_desc', 'Allow people you don\'t follow to message you')}
                    checked={privacySettings.directMessages}
                    onChange={(val) => setPrivacySettings({...privacySettings, directMessages: val})}
                  />
                  <PrivacyToggle 
                    title={t('settings_page.activity_status', 'Activity Status')}
                    description={t('settings_page.activity_status_desc', 'Show when you\'re active on Aura')}
                    checked={privacySettings.activityStatus}
                    onChange={(val) => setPrivacySettings({...privacySettings, activityStatus: val})}
                  />
                  <PrivacySelect
                    title={t('settings_page.who_can_request', 'Who can send friend requests')}
                    description={t('settings_page.who_can_request_desc', 'Control who is allowed to initiate friendship with you.')}
                    value={relationshipSettings.whoCanSendFriendRequest}
                    options={[
                      { value: 'everyone', label: t('settings_page.everyone', 'Everyone') },
                      { value: 'same_communities', label: t('settings_page.same_communities', 'People in shared communities') },
                      { value: 'friends_of_friends', label: t('settings_page.friends_of_friends', 'Friends of friends') },
                      { value: 'nobody', label: t('settings_page.nobody', 'Nobody') },
                    ]}
                    onChange={(value) => setRelationshipSettings({ ...relationshipSettings, whoCanSendFriendRequest: value as any })}
                  />
                  <PrivacySelect
                    title={t('settings_page.who_can_message', 'Who can message me')}
                    description={t('settings_page.who_can_message_desc', 'Route unexpected conversations away from your main inbox.')}
                    value={relationshipSettings.whoCanMessageMe}
                    options={[
                      { value: 'friends', label: t('settings_page.friends_only', 'Friends only') },
                      { value: 'friends_and_interest_contacts', label: t('settings_page.friends_and_interests', 'Friends and interest contacts') },
                      { value: 'everyone', label: t('settings_page.everyone', 'Everyone') },
                      { value: 'nobody', label: t('settings_page.nobody', 'Nobody') },
                    ]}
                    onChange={(value) => setRelationshipSettings({ ...relationshipSettings, whoCanMessageMe: value as any })}
                  />
                  <PrivacySelect
                    title={t('settings_page.who_can_invite', 'Who can invite me to communities')}
                    description={t('settings_page.who_can_invite_desc', 'Keep community invites useful instead of noisy.')}
                    value={relationshipSettings.whoCanInviteMeToCommunities}
                    options={[
                      { value: 'friends', label: t('settings_page.friends', 'Friends') },
                      { value: 'close_friends', label: t('settings_page.close_friends', 'Close friends only') },
                      { value: 'everyone', label: t('settings_page.everyone', 'Everyone') },
                      { value: 'nobody', label: t('settings_page.nobody', 'Nobody') },
                    ]}
                    onChange={(value) => setRelationshipSettings({ ...relationshipSettings, whoCanInviteMeToCommunities: value as any })}
                  />
                  <PrivacySelect
                    title={t('settings_page.who_can_see_friends_posts', 'Who can see my friends-only posts')}
                    description={t('settings_page.who_can_see_friends_posts_desc', 'Use a tighter audience for personal content.')}
                    value={relationshipSettings.whoCanSeeFriendsOnlyPosts}
                    options={[
                      { value: 'friends', label: t('settings_page.all_friends', 'All friends') },
                      { value: 'close_friends', label: t('settings_page.close_friends', 'Close friends only') },
                    ]}
                    onChange={(value) => setRelationshipSettings({ ...relationshipSettings, whoCanSeeFriendsOnlyPosts: value as any })}
                  />
                  <PrivacySelect
                    title={t('settings_page.who_can_see_friend_list', 'Who can see my friend list')}
                    description={t('settings_page.who_can_see_friend_list_desc', 'Hide your social graph if you want a quieter profile.')}
                    value={relationshipSettings.whoCanSeeFriendList}
                    options={[
                      { value: 'friends', label: t('settings_page.friends', 'Friends') },
                      { value: 'everyone', label: t('settings_page.everyone', 'Everyone') },
                      { value: 'only_me', label: t('settings_page.only_me', 'Only me') },
                    ]}
                    onChange={(value) => setRelationshipSettings({ ...relationshipSettings, whoCanSeeFriendList: value as any })}
                  />
                  <PrivacyToggle
                    title={t('settings_page.allow_msg_in_requests', 'Allow a message in friend requests')}
                    description={t('settings_page.allow_msg_in_requests_desc', 'People can add short context when requesting friendship.')}
                    checked={relationshipSettings.allowFriendRequestMessage}
                    onChange={(val) => setRelationshipSettings({ ...relationshipSettings, allowFriendRequestMessage: val })}
                  />
                  <PrivacyToggle
                    title={t('settings_page.show_mutual', 'Show mutual friends and communities')}
                    description={t('settings_page.show_mutual_desc', 'Use shared context to improve suggestions and trust.')}
                    checked={relationshipSettings.showMutualFriends}
                    onChange={(val) => setRelationshipSettings({ ...relationshipSettings, showMutualFriends: val })}
                  />
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="space-y-6">
                <div>
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-foreground">{t('settings_page.appearance', 'Appearance')}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t('settings_page.appearance_desc', 'Shape how Aura feels while keeping the interface clear and focused.')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="p-3.5 rounded-2xl border-2 border-primary bg-white flex flex-col items-center gap-3 shadow-md">
                      <div className="w-full h-20 bg-muted/50 rounded-lg flex items-center justify-center">
                        <Globe className="w-8 h-8 text-primary" />
                      </div>
                      <span className="font-bold">{t('settings_page.light_mode', 'Light Mode')}</span>
                    </button>
                    <button 
                      onClick={() => alert(t('settings_page.dark_mode_soon', 'O modo escuro chega em breve. Enquanto isso, você já pode usar o Modo Foco abaixo.'))}
                      className="p-3.5 rounded-2xl border-2 border-transparent bg-slate-900 flex flex-col items-center gap-3 group opacity-80 hover:opacity-100 transition-all"
                    >
                      <div className="w-full h-20 bg-slate-800 rounded-lg flex items-center justify-center">
                        <Moon className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                      <span className="font-bold text-white">{t('settings_page.dark_mode', 'Dark Mode')}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-foreground">{t('settings.language', 'Idioma')}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t('settings_page.language_desc', 'Escolha o idioma da interface e altere a experiência do app inteiro.')}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setLanguage('pt-BR')}
                      className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                        language === 'pt-BR'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/60 bg-white hover:border-primary/30'
                      }`}
                    >
                      <div className="text-sm font-black uppercase tracking-[0.18em] text-primary/80">PT-BR</div>
                      <div className="mt-2 text-base font-bold text-foreground">Português (Brasil)</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {t('settings_page.language_pt_desc', 'Deixe toda a interface em português como idioma principal.')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                        language === 'en'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/60 bg-white hover:border-primary/30'
                      }`}
                    >
                      <div className="text-sm font-black uppercase tracking-[0.18em] text-primary/80">EN</div>
                      <div className="mt-2 text-base font-bold text-foreground">English</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {t('settings_page.language_en_desc', 'Ative a interface em inglês para quem preferir usar o app assim.')}
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-foreground mb-4">{t('settings_page.focus_mode', 'Focus Mode')}</h2>
                  <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-foreground">{t('settings_page.focus_mode_enable', 'Enable Focus Mode')}</div>
                      <div className="text-sm text-muted-foreground">{t('settings_page.focus_mode_desc', 'Hide sidebars and distractions for a cleaner experience')}</div>
                    </div>
                    <button 
                      onClick={toggleFocusMode}
                      className={`w-14 h-8 rounded-full transition-all relative ${focusMode ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${focusMode ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-end gap-3">
              {saveSuccess && (
                <span className="text-green-600 font-medium flex items-center gap-1.5 mr-auto animate-in fade-in slide-in-from-left-2">
                  <Check className="w-4 h-4" /> {t('settings_page.saved', 'Changes saved successfully')}
                </span>
              )}
              <button className="px-6 py-2.5 rounded-full font-bold text-muted-foreground hover:bg-muted transition-all">
                {t('settings_page.cancel', 'Cancel')}
              </button>
              <button 
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-8 py-2.5 rounded-full font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? t('settings_page.saving', 'Saving...') : t('settings_page.save', 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function PrivacyToggle({ title, description, checked, onChange }: { title: string, description: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/50 hover:bg-muted/10 transition-all">
      <div className="flex-1 pr-4">
        <div className="font-bold text-foreground">{title}</div>
        <div className="text-[13px] leading-5 text-muted-foreground">{description}</div>
      </div>
      <button 
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[26px]' : 'left-0.5'}`}></div>
      </button>
    </div>
  );
}

function PrivacySelect({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-border/50 hover:bg-muted/10 transition-all">
      <div className="flex-1 pr-4">
        <div className="font-bold text-foreground">{title}</div>
        <div className="text-[13px] leading-5 text-muted-foreground">{description}</div>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="shrink-0 rounded-xl border border-border/50 bg-white px-3.5 py-2 text-[13px] font-semibold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
