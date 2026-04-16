'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc, arrayRemove, collection, getDocs } from 'firebase/firestore';
import { Loader2, UserMinus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function CommunityAdminMembersPage() {
  const { id } = useParams();
  const { profile } = useAppStore();
  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      const docSnap = await getDoc(doc(db, 'communities', id as string));
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setCommunity(data);

      const memberIds = data.members || [];
      if (memberIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const matchedUsers = usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => memberIds.includes(u.id));
        setMembers(matchedUsers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [id]);

  const handleKick = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the community?')) return;
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'communities', id as string), {
        members: arrayRemove(userId),
        memberCount: Math.max(0, (community.memberCount || 1) - 1)
      });
      setMembers(members.filter(m => m.id !== userId));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    try {
      const currentRoles = community.roles || {};
      const newRoles = { ...currentRoles, [userId]: newRole };
      if (newRole === 'member') {
        delete newRoles[userId]; // clean up
      }
      await updateDoc(doc(db, 'communities', id as string), {
        roles: newRoles
      });
      setCommunity({ ...community, roles: newRoles });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading members...</div>;

  const currentUserId = profile?.uid;
  const isOwner = community?.creatorId === currentUserId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1">Manage who is in your community and their permissions.</p>
      </div>

      <div className="bg-white rounded-3xl border border-border/50 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b border-border/50 text-sm text-muted-foreground">
              <th className="px-6 py-4 font-semibold">User</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {members.map(member => {
              const role = member.id === community.creatorId ? 'owner' : (community.roles?.[member.id] || 'member');
              const isSelf = member.id === currentUserId;
              
              return (
                <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                        {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div>
                        <div className="font-bold text-foreground">{member.displayName} {isSelf && '(You)'}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {role === 'owner' && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg uppercase tracking-wider border border-yellow-200"><ShieldAlert className="w-3 h-3" /> Owner</span>}
                    {role === 'admin' && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded-lg uppercase tracking-wider border border-primary/20"><ShieldCheck className="w-3 h-3" /> Admin</span>}
                    {role === 'moderator' && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-lg uppercase tracking-wider border border-blue-200"><ShieldCheck className="w-3 h-3" /> Mod</span>}
                    {role === 'member' && <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Member</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {actionLoading === member.id ? (
                      <Loader2 className="w-5 h-5 animate-spin ml-auto text-muted-foreground" />
                    ) : (
                      !isSelf && role !== 'owner' && (
                        <div className="flex items-center justify-end gap-2">
                          {isOwner && role !== 'admin' && (
                            <button onClick={() => handleRoleChange(member.id, 'admin')} className="text-xs font-bold bg-muted/50 hover:bg-muted text-foreground px-3 py-1.5 rounded-lg transition-colors">
                              Make Admin
                            </button>
                          )}
                          {(isOwner || role !== 'admin') && role !== 'moderator' && (
                            <button onClick={() => handleRoleChange(member.id, 'moderator')} className="text-xs font-bold bg-muted/50 hover:bg-muted text-foreground px-3 py-1.5 rounded-lg transition-colors">
                              Make Mod
                            </button>
                          )}
                          {role !== 'member' && (
                            <button onClick={() => handleRoleChange(member.id, 'member')} className="text-xs font-bold bg-muted/50 hover:bg-muted text-foreground px-3 py-1.5 rounded-lg transition-colors">
                              Demote
                            </button>
                          )}
                          <button onClick={() => handleKick(member.id)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors ml-2" title="Remove User">
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
