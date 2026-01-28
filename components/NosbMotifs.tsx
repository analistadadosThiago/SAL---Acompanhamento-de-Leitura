
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { RPC_GET_MOTIVOS_NOSB } from '../constants';
import { 
  ListChecks, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Database,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Power
} from 'lucide-react';

interface Motivo {
  id: number;
  codigo: string;
  motivo_nome: string; // Descrição
  status: boolean;
  descricao?: string; // Detalhes adicionais se houver
}

const NosbMotifs: React.FC = () => {
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMotivos = async () => {
    setLoading(true);
    setErrorMsg(null);
    setDbStatus('checking');
    try {
      const { data, error } = await supabase.rpc(RPC_GET_MOTIVOS_NOSB);
      
      if (error) {
        throw error;
      }

      // Mapeamento para garantir que as colunas solicitadas existam
      // O RPC pode retornar nomes diferentes, ajustamos aqui para o padrão da UI
      const mappedData = (data || []).map((item: any) => ({
        id: item.id || item.ID || 0,
        codigo: item.codigo || item.CODIGO || 'N/A',
        motivo_nome: item.motivo_nome || item.descricao || item.MOTIVO || 'Sem Descrição',
        status: item.status !== undefined ? item.status : true
      }));

      setMotivos(mappedData);
      setDbStatus('online');
    } catch (err: any) {
      console.error("Erro fetch motivos:", err);
      setErrorMsg("Falha ao sincronizar com a base de dados.");
      setDbStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMotivos();
  }, []);

  const filteredMotivos = useMemo(() => {
    return motivos.filter(m => 
      m.motivo_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [motivos, searchTerm]);

  const toggleStatus = (id: number) => {
    setMotivos(prev => prev.map(m => m.id === id ? { ...m, status: !m.status } : m));
    // Aqui haveria uma chamada ao Supabase para persistir a alteração de status
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* HEADER SECTION */}
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-900 via-indigo-600 to-indigo-900"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-slate-950 text-white rounded-[2rem] shadow-2xl shadow-slate-900/20 group-hover:rotate-3 transition-transform duration-500">
              <ListChecks size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                Gestão de Motivos NOSB
              </h2>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                  <div className={`h-2 w-2 rounded-full ${dbStatus === 'online' ? 'bg-emerald-500 animate-pulse' : dbStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    DB: {dbStatus === 'online' ? 'Sincronizado' : dbStatus === 'offline' ? 'Desconectado' : 'Checando...'}
                  </span>
                </div>
                <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Módulo de Configuração SAL v9.0
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={fetchMotivos} 
               disabled={loading}
               className="p-4 bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-2xl border border-slate-100 transition-all hover:bg-white shadow-sm active:scale-90 flex items-center gap-2"
               title="Atualizar Dados"
             >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Atualizar</span>
             </button>
             <button className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95">
                <Plus size={16} /> Novo Motivo
             </button>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-center gap-4 text-rose-700 animate-in shake duration-500">
          <AlertCircle size={24} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Erro de Sincronização</p>
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <section className="bg-white rounded-[3.5rem] shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="px-10 py-8 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50/30">
           <div className="relative w-full max-w-md">
              <input 
                type="text" 
                placeholder="Pesquisar por Código ou Descrição..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all shadow-sm"
              />
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
           </div>
           
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Database size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{filteredMotivos.length} Registros</span>
              </div>
           </div>
        </div>

        <div className="overflow-x-auto p-2">
          {loading ? (
             <div className="py-40 flex flex-col items-center justify-center gap-6">
                <div className="relative">
                  <div className="h-16 w-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <Database size={24} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] animate-pulse">Acessando Core v9.0...</p>
             </div>
          ) : filteredMotivos.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-widest text-[10px] border-b">
                <tr>
                  <th className="px-10 py-6">ID</th>
                  <th className="px-10 py-6">Código</th>
                  <th className="px-10 py-6">Descrição do Motivo</th>
                  <th className="px-10 py-6 text-center">Status</th>
                  <th className="px-10 py-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMotivos.map((m) => (
                  <tr key={m.id} className="group hover:bg-slate-50 transition-all duration-300">
                    <td className="px-10 py-5 font-mono text-slate-400 text-xs">#{m.id}</td>
                    <td className="px-10 py-5">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-black text-xs border border-indigo-100">
                        {m.codigo}
                      </span>
                    </td>
                    <td className="px-10 py-5 font-bold text-slate-800 uppercase tracking-tight text-sm">
                      {m.motivo_nome}
                    </td>
                    <td className="px-10 py-5 text-center">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                          m.status 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {m.status ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                          {m.status ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-5 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => toggleStatus(m.id)}
                          className={`p-2 rounded-xl border transition-all ${m.status ? 'hover:bg-rose-50 hover:text-rose-600 border-slate-100' : 'hover:bg-emerald-50 hover:text-emerald-600 border-slate-100'}`}
                          title={m.status ? "Desativar" : "Ativar"}
                        >
                          <Power size={16} />
                        </button>
                        <button className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                          <Edit3 size={16} />
                        </button>
                        <button className="p-2 bg-white text-slate-400 hover:text-rose-600 rounded-xl border border-slate-100 shadow-sm hover:border-rose-200 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-40 flex flex-col items-center justify-center text-center px-10">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-slate-200 text-slate-200">
                  <Search size={40} />
               </div>
               <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Nenhum Motivo Localizado</h4>
               <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs">
                 Não encontramos registros para o termo "{searchTerm}" na base de dados SAL v9.0.
               </p>
               <button 
                 onClick={() => setSearchTerm('')}
                 className="mt-8 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline"
               >
                 Limpar Pesquisa
               </button>
            </div>
          )}
        </div>
        
        {/* FOOTER STATS */}
        <div className="px-10 py-6 bg-slate-50/50 border-t flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                   {motivos.filter(m => m.status).length} Ativos
                 </span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                   {motivos.filter(m => !m.status).length} Inativos
                 </span>
              </div>
           </div>
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
             SAL Enterprise • Core Analytics Engine
           </p>
        </div>
      </section>

      {/* DESIGN FOOTER */}
      <div className="flex justify-center pt-6">
        <div className="flex items-center gap-4 px-6 py-3 bg-white border border-slate-100 rounded-full shadow-sm">
           <ShieldCheck size={14} className="text-indigo-600" />
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Proteção de Dados v9.0.42 Ativa</span>
        </div>
      </div>
    </div>
  );
};

export default NosbMotifs;
