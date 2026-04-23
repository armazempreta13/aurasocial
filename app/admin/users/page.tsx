'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  where, 
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  getCountFromServer
} from 'firebase/firestore';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  UserX, 
  CheckCircle2, 
  Clock,
  Eye,
  ShieldAlert,
  Mail,
  MapPin,
  Calendar,
  X,
  Edit2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Award
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userStats, setUserStats] = useState({ posts: 0, strikes: 0 });
  const { profile: adminProfile } = useAppStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (search = '') => {
    setLoading(true);
    try {
      let q;
      if (search) {
        // Search by email exact match or prefix for display name
        if (search.includes('@')) {
          q = query(collection(db, 'users'), where('email', '==', search.trim()), limit(50));
        } else {
          // Note: Firestore doesn't support case-insensitive prefix search easily without extra field
          // We assume names are mostly capitalized or lowercase for this demo
          // In real production, we'd have a searchKeywords array or Algolia
          q = query(
            collection(db, 'users'), 
            where('displayName', '>=', search),
            where('displayName', '<=', search + '\uf8ff'),
            limit(50)
          );
        }
      } else {
        q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
      }

      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(fetchedUsers);
      
      // If none found by name, try username as fallback
      if (fetchedUsers.length === 0 && search && !search.includes('@')) {
         const qAlt = query(
            collection(db, 'users'), 
            where('username', '>=', search),
            where('username', '<=', search + '\uf8ff'),
            limit(50)
          );
          const snapAlt = await getDocs(qAlt);
          setUsers(snapAlt.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(searchTerm);
  };

  const logAdminAction = async (action: string, targetId: string, details?: string) => {
    await addDoc(collection(db, 'admin_logs'), {
      adminId: adminProfile?.uid,
      adminName: adminProfile?.displayName,
      action,
      targetId,
      details: details || '',
      createdAt: serverTimestamp()
    });
  };

  const toggleUserStatus = async (user: any) => {
    const newStatus = !user.isBanned;
    if (!confirm(`Deseja ${newStatus ? 'BANIR' : 'REATIVAR'} o usuário ${user.displayName}?`)) return;
    
    try {
      await updateDoc(doc(db, 'users', user.id), {
        isBanned: newStatus,
        bannedAt: newStatus ? serverTimestamp() : null
      });
      await logAdminAction(newStatus ? 'Banimento' : 'Reativação', user.id, `Status alterado para ${user.email}`);
      
      // Update local state
      setUsers(users.map(u => u.id === user.id ? { ...u, isBanned: newStatus } : u));
      if (selectedUser?.id === user.id) setSelectedUser({ ...selectedUser, isBanned: newStatus });
      
    } catch (error) {
      alert('Erro ao atualizar status do usuário');
    }
  };

  const openUserDetails = async (user: any) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setUserStats({ posts: 0, strikes: 0 }); // Reset while loading
    
    try {
      const postsCount = await getCountFromServer(query(collection(db, 'posts'), where('authorId', '==', user.uid)));
      const strikesCount = await getCountFromServer(query(collection(db, 'posts'), where('authorId', '==', user.uid), where('moderation.status', '!=', 'allow')));
      
      setUserStats({
        posts: postsCount.data().count,
        strikes: strikesCount.data().count
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Usuários</h1>
          <p className="text-slate-500 font-medium font-mono text-xs mt-1 uppercase tracking-widest">Controle total da base de membros Aura</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-3 bg-white p-2 rounded-3xl border border-slate-100 shadow-sm grow max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar por nome, email ou @username..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
            />
          </div>
          <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-tighter hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            Filtrar
          </button>
        </form>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Membro</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Identificação</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 text-center">Engagement</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Status</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 text-right">Controles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user, i) => (
                <motion.tr 
                  key={user.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group hover:bg-slate-50/80 transition-all cursor-default"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                         <img 
                          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                          alt="" 
                          className="w-12 h-12 rounded-2xl border-2 border-white shadow-sm object-cover"
                        />
                        {user.isAdmin && <div className="absolute -top-1 -right-1 p-1 bg-indigo-500 rounded-lg border-2 border-white shadow-sm"><ShieldCheck className="w-2.5 h-2.5 text-white" /></div>}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-tight">{user.displayName}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5 group-hover:text-indigo-500 transition-colors">
                           {user.username ? `@${user.username}` : 'No Username'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                       <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {user.email}
                       </p>
                       <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">UID: {user.id.substring(0, 10)}...</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-6">
                       <div className="text-center">
                          <p className="text-xs font-black text-slate-900">{user.followersCount || 0}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Seguidores</p>
                       </div>
                       <div className="text-center">
                          <p className="text-xs font-black text-slate-900">{user.followingCount || 0}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Seguindo</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleUserStatus(user); }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                        user.isBanned 
                          ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                      }`}
                    >
                      {user.isBanned ? (
                        <><ShieldAlert className="w-3 h-3" /> Banido</>
                      ) : (
                        <><CheckCircle2 className="w-3 h-3" /> Ativo</>
                      )}
                    </button>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => openUserDetails(user)}
                        className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                        title="Dossiê do Usuário"
                       >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                         onClick={() => window.open(`/profile/${user.id}`, '_blank')}
                         className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                         title="Link Externo"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && !loading && (
          <div className="py-32 text-center bg-slate-50/50">
            <div className="w-24 h-24 bg-white rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-slate-900 font-black text-xl mb-1">Nenhum membro encontrado</h3>
            <p className="text-slate-400 font-medium text-sm">Tente ajustar seus filtros de busca ou verifique o email.</p>
          </div>
        )}

        {loading && (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Indexando Membros...</p>
          </div>
        )}
      </div>

      {/* User Details Dossier Modal */}
      <AnimatePresence>
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsModalOpen(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-4xl rounded-[50px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row h-[80vh]"
             >
                {/* Modal Sidebar */}
                <div className="w-full md:w-80 bg-slate-50 p-10 border-r border-slate-100 flex flex-col items-center shrink-0">
                   <div className="relative mb-6">
                      <img 
                        src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${selectedUser.displayName}`} 
                        alt="" 
                        className="w-32 h-32 rounded-[40px] border-4 border-white shadow-xl object-cover"
                      />
                      {selectedUser.isBanned && (
                         <div className="absolute -bottom-2 -right-2 p-3 bg-rose-500 rounded-2xl border-4 border-white shadow-lg text-white">
                            <ShieldAlert className="w-5 h-5" />
                         </div>
                      )}
                   </div>
                   <h2 className="text-2xl font-black text-slate-900 text-center leading-tight mb-2">{selectedUser.displayName}</h2>
                   <p className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-8">@{selectedUser.username || 'membro'}</p>
                   
                   <div className="w-full space-y-4">
                      <div className="p-4 bg-white rounded-3xl border border-slate-200/50 shadow-sm flex items-center justify-between">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex-1">Posts<br/><span className="text-slate-900 text-lg leading-none mt-1 inline-block">--</span></p>
                         <div className="w-px h-8 bg-slate-100"></div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex-1">Followers<br/><span className="text-slate-900 text-lg leading-none mt-1 inline-block">{selectedUser.followersCount || 0}</span></p>
                      </div>
                      
                      <button 
                         onClick={() => toggleUserStatus(selectedUser)}
                         className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-tighter transition-all shadow-lg ${
                            selectedUser.isBanned 
                            ? 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600' 
                            : 'bg-rose-500 text-white shadow-rose-200 hover:bg-rose-600'
                         }`}
                      >
                         {selectedUser.isBanned ? 'Reativar Membro' : 'Banir do Sistema'}
                      </button>
                      <button 
                         onClick={() => window.open(`/profile/${selectedUser.id}`, '_blank')}
                         className="w-full py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-sm uppercase tracking-tighter hover:bg-slate-50 transition-all"
                      >
                         Ver Perfil Público
                      </button>
                   </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-12">
                   <div className="flex justify-between items-start mb-10">
                      <div>
                         <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">Dossiê Completo</h3>
                         <h4 className="text-3xl font-black text-slate-900">Informações Técnicas</h4>
                      </div>
                      <button 
                        onClick={() => setIsModalOpen(false)}
                        className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-all"
                      >
                        <X className="w-6 h-6" />
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div className="space-y-6">
                         <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Email cadastrado</label>
                            <div className="flex items-center gap-3 text-slate-700 font-bold bg-slate-50 p-4 rounded-2xl border border-transparent group-hover:border-indigo-100 transition-all">
                               <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                               {selectedUser.email}
                            </div>
                         </div>
                         <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Identificador Único (UID)</label>
                            <div className="flex items-center gap-3 text-slate-400 font-mono text-xs bg-slate-50 p-4 rounded-2xl border border-transparent group-hover:border-indigo-100 transition-all">
                               <Award className="w-4 h-4 text-indigo-400 shrink-0" />
                               {selectedUser.id}
                            </div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Data de Ingresso</label>
                            <div className="flex items-center gap-3 text-slate-700 font-bold bg-slate-50 p-4 rounded-2xl border border-transparent group-hover:border-indigo-100 transition-all text-sm">
                               <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                               {selectedUser.createdAt?.toDate ? format(selectedUser.createdAt.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '---'}
                            </div>
                         </div>
                         <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Localização / Bio</label>
                            <div className="flex items-center gap-3 text-slate-700 font-bold bg-slate-50 p-4 rounded-2xl border border-transparent group-hover:border-indigo-100 transition-all text-sm">
                               <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                               {selectedUser.location || 'Não informado'} • {selectedUser.bio?.substring(0, 30) || 'Sem biografía'}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div>
                      <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-4 mb-6">Atividade de Segurança</h5>
                      <div className="space-y-4">
                         {selectedUser.isBanned ? (
                           <div className="flex items-center gap-4 p-6 bg-rose-50 rounded-3xl border border-rose-100 text-rose-600">
                              <ShieldAlert className="w-8 h-8 shrink-0" />
                              <div>
                                 <p className="font-black uppercase tracking-tight text-sm leading-tight">Membro sob restrição total</p>
                                 <p className="text-xs font-medium mt-0.5">O acesso deste usuário à rede social Aura foi revogado administrativamente.</p>
                              </div>
                           </div>
                         ) : (
                           <div className="flex items-center gap-4 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-emerald-600">
                              <CheckCircle2 className="w-8 h-8 shrink-0" />
                              <div>
                                 <p className="font-black uppercase tracking-tight text-sm leading-tight">Conta Limpa e Ativa</p>
                                 <p className="text-xs font-medium mt-0.5">Nenhuma anomalia de segurança detectada neste perfil.</p>
                              </div>
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
