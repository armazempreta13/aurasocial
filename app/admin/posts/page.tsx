'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { 
  Trash2, 
  Eye, 
  User, 
  MessageSquare, 
  Clock,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Share2,
  MoreVertical,
  Flag,
  Filter,
  ArrowRightCircle,
  Hash,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminPosts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const { profile: adminProfile } = useAppStore();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async (status?: string) => {
    setLoading(true);
    try {
      let q;
      if (status) {
        q = query(
          collection(db, 'posts'), 
          where('moderation.status', '==', status),
          orderBy('createdAt', 'desc'), 
          limit(50)
        );
      } else {
        q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
      }
      
      const snapshot = await getDocs(q);
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const logAdminAction = async (action: string, targetId: string, details: string) => {
    await addDoc(collection(db, 'admin_logs'), {
      adminId: adminProfile?.uid,
      adminName: adminProfile?.displayName,
      action,
      targetId,
      details,
      createdAt: serverTimestamp()
    });
  };

  const handleDeletePost = async (post: any) => {
    if (!confirm('Esta ação removerá permanentemente este conteúdo da rede Aura. Confirmar?')) return;
    
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      await logAdminAction(`Remoção de post`, post.id, `Conteúdo removido: "${post.content.substring(0, 30)}..."`);
      setPosts(posts.filter(p => p.id !== post.id));
      setSelectedPost(null);
    } catch (error) {
      alert('Erro ao excluir postagem');
    }
  };

  const handleUpdatePost = async () => {
    if (!selectedPost || !editedContent) return;
    try {
      await updateDoc(doc(db, 'posts', selectedPost.id), {
        content: editedContent,
        lastEdittedByAdmin: true,
        updatedAt: serverTimestamp()
      });
      await logAdminAction(`Edição Admin`, selectedPost.id, `Conteúdo alterado por moderação.`);
      setPosts(posts.map(p => p.id === selectedPost.id ? { ...p, content: editedContent } : p));
      setIsEditMode(false);
      setSelectedPost({ ...selectedPost, content: editedContent });
    } catch (error) {
      alert('Erro ao editar conteúdo');
    }
  };

  const getModerationStatus = (post: any) => {
    return post.moderation?.status || 'allow';
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Conteúdo</h1>
          <p className="text-slate-500 font-medium font-mono text-xs mt-1 uppercase tracking-widest">Controle editorial e moderação de postagens</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => fetchPosts()}
             className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-all text-xs font-black uppercase flex items-center gap-2"
           >
              <Clock className="w-4 h-4" />
              Recentes
           </button>
           <button 
             onClick={() => fetchPosts('flag')}
             className="px-6 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 hover:bg-rose-100 transition-all text-xs font-black uppercase flex items-center gap-2"
           >
              <Flag className="w-4 h-4" />
              Suspeitos
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {posts.map((post, i) => (
            <motion.div 
              key={post.id} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              layout
              className="bg-white rounded-[40px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col group hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all cursor-pointer h-full"
              onClick={() => { setSelectedPost(post); setEditedContent(post.content); setIsEditMode(false); }}
            >
               <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img 
                          src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} 
                          alt="" 
                          className="w-10 h-10 rounded-[14px] border border-slate-50 shadow-sm"
                        />
                         {post.moderation?.score && post.moderation.score > 0.5 && (
                           <div className="absolute -top-1 -right-1 p-1 bg-amber-500 rounded-lg border-2 border-white shadow-sm">
                              <AlertTriangle className="w-2.5 h-2.5 text-white" />
                           </div>
                         )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                           <p className="text-sm font-black text-slate-900 truncate">{post.authorName}</p>
                           {post.moderation?.score > 0 && (
                             <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border ${post.moderation.score >= 0.7 ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
                               {post.moderation.score.toFixed(2)}
                             </span>
                           )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                           {post.createdAt?.toDate ? format(post.createdAt.toDate(), "d MMM, HH:mm", { locale: ptBR }) : 'Recent'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                     <p className="text-slate-600 font-medium text-[13px] leading-relaxed mb-6 line-clamp-4 group-hover:text-slate-900 transition-colors">
                      {post.content}
                     </p>
                     {post.imageUrl && (
                       <div className="rounded-3xl overflow-hidden mb-6 aspect-[4/3] bg-slate-50 relative group/img shadow-sm">
                          <img src={post.imageUrl} alt="" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/10 transition-colors"></div>
                       </div>
                     )}
                  </div>

                  <div className="pt-6 mt-auto border-t border-slate-50 flex items-center justify-between">
                     <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Heart className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider">{post.likesCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider">{post.commentsCount || 0}</span>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        <ArrowRightCircle className="w-5 h-5 text-indigo-500" />
                     </div>
                  </div>
               </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {posts.length === 0 && !loading && (
          <div className="col-span-full py-40 text-center bg-white rounded-[50px] border border-slate-100 shadow-sm">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-slate-900 font-black text-xl mb-1">Nenhuma postagem ativa</h3>
            <p className="text-slate-400 font-medium">O feed social da Aura está vazio no momento.</p>
          </div>
        )}

        {loading && (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest animate-pulse">Monitorando Feed...</p>
          </div>
        )}
      </div>

      {/* Post Detailed Modal */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => { setSelectedPost(null); setIsEditMode(false); }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-5xl rounded-[50px] shadow-[0_50px_100px_rgba(0,0,0,0.2)] border border-slate-100 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
             >
                {/* Visual Area */}
                <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden border-r border-slate-100 relative group">
                   {selectedPost.imageUrl ? (
                     <img src={selectedPost.imageUrl} alt="" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-300 p-20 text-center">
                        <MessageSquare className="w-32 h-32 opacity-10 mb-6 mx-auto" />
                        <p className="text-xl font-black italic opacity-20">Este conteúdo é puramente textual.</p>
                     </div>
                   )}
                   <div className="absolute top-8 left-8 flex gap-2">
                       <div className="px-5 py-2.5 bg-white/90 backdrop-blur rounded-2xl shadow-xl flex items-center gap-2">
                          <Hash className="w-4 h-4 text-indigo-500" />
                          <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">ID: {selectedPost.id.substring(0, 8)}</span>
                       </div>
                   </div>
                </div>

                {/* Info & Admin Area */}
                <div className="w-full md:w-[480px] p-12 overflow-y-auto flex flex-col">
                   <div className="flex justify-between items-start mb-10">
                      <div className="flex items-center gap-4">
                         <img 
                          src={selectedPost.authorPhoto || `https://ui-avatars.com/api/?name=${selectedPost.authorName}`} 
                          alt="" 
                          className="w-14 h-14 rounded-2xl border-4 border-slate-50 shadow-sm"
                        />
                        <div>
                           <p className="text-lg font-black text-slate-900">{selectedPost.authorName}</p>
                           <button onClick={() => window.open(`/profile/${selectedPost.authorId}`, '_blank')} className="text-xs font-bold text-indigo-500 hover:underline">Ver Perfil Completo</button>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedPost(null); setIsEditMode(false); }}
                        className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all border border-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                   </div>

                   <div className="flex-1 space-y-8">
                      <div>
                         <div className="flex items-center justify-between mb-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conteúdo do Post</label>
                            {!isEditMode && (
                              <button 
                                onClick={() => setIsEditMode(true)}
                                className="flex items-center gap-1.5 text-[11px] font-black text-indigo-500 uppercase tracking-tighter hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all"
                              >
                                <Edit2 className="w-3 h-3" /> Editar
                              </button>
                            )}
                         </div>
                         
                         {isEditMode ? (
                           <div className="space-y-3">
                              <textarea 
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="w-full h-40 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                              />
                              <div className="flex gap-2">
                                 <button 
                                   onClick={handleUpdatePost}
                                   className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-tighter hover:bg-slate-800 transition-all shadow-xl"
                                 >
                                    Salvar Alterações
                                 </button>
                                 <button 
                                   onClick={() => { setIsEditMode(false); setEditedContent(selectedPost.content); }}
                                   className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm uppercase tracking-tighter hover:bg-slate-200 transition-all"
                                 >
                                    Cancelar
                                 </button>
                              </div>
                           </div>
                         ) : (
                           <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-6 rounded-3xl border border-transparent shadow-inner">
                              {selectedPost.content}
                           </p>
                         )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Curtidas</p>
                            <div className="flex items-center gap-2">
                               <Heart className="w-4 h-4 text-rose-500" />
                               <span className="text-xl font-black text-slate-900">{selectedPost.likesCount || 0}</span>
                            </div>
                         </div>
                         <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comentários</p>
                            <div className="flex items-center gap-2">
                               <MessageSquare className="w-4 h-4 text-indigo-500" />
                               <span className="text-xl font-black text-slate-900">{selectedPost.commentsCount || 0}</span>
                            </div>
                         </div>
                      </div>

                      <div className="pt-8 mt-auto border-t border-slate-100">
                         <button 
                           onClick={() => handleDeletePost(selectedPost)}
                           className="w-full py-5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-3xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all"
                         >
                            <Trash2 className="w-5 h-5" />
                            Excluir Conteúdo Permanentemente
                         </button>
                         <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-4">ESTA AÇÃO É IRREVERSÍVEL</p>
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
