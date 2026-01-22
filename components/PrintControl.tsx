
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  RPC_CE_CNA,
  RPC_CE_QUANTITATIVO,
  RPC_FILTRO_RAZAO_CI,
  RPC_FILTRO_MATRICULA_CI
} from '../constants';
import { 
  Filter, Play, RotateCcw, Loader2, Database, 
  TrendingUp, Layout, ListFilter, 
  ChevronLeft, ChevronRight,
  ShieldAlert, ScanLine, FileBarChart
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer
} from 'recharts';

const ITEMS_PER_PAGE = 25;

enum PrintSubMenu {
  IMPEDIMENTOS = 'IMPEDIMENTOS',
  SIMULACAO_NOSB = 'SIMULACAO_NOSB',
  APRESENTACAO_CNA = 'APRESENTACAO_CNA',
  RELACAO_QUANTITATIVA = 'RELACAO_QUANTITATIVA'
}

const MONTH_MAP: Record<string, number> = {
  "JANEIRO": 1, "FEVEREIRO": 2, "MARÇO": 3, "ABRIL": 4, "MAIO": 5, "JUNHO": 6,
  "JULHO": 7, "AGOSTO": 8, "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12
};

interface OptionItem {
  label: string;
  value: string;
}

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.IMPEDIMENTOS);
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as OptionItem[],
    razoes: [] as OptionItem[],
    matriculas: [] as OptionItem[]
  });

  const [dataset, setDataset] = useState<any[] | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartDimension, setChartDimension] = useState<'mes' | 'matr' | 'razao'>('matr');

  const subMenus = [
    { id: PrintSubMenu.IMPEDIMENTOS, label: 'Impedimentos', icon: <ShieldAlert size={14}/> },
    { id: PrintSubMenu.SIMULACAO_NOSB, label: 'Simulação NOSB', icon: <ScanLine size={14}/> },
    { id: PrintSubMenu.APRESENTACAO_CNA, label: 'Apresentação (CNA)', icon: <FileBarChart size={14}/> },
    { id: PrintSubMenu.RELACAO_QUANTITATIVA, label: 'Rel. Quantitativa', icon: <ListFilter size={14}/> }
  ];

  const activeLabel = subMenus.find(s => s.id === activeSubMenu)?.label || '';

  // 1. Carregar Anos e Meses Globais
  useEffect(() => {
    const fetchBaseMetadata = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        
        const anos = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));
        const meses = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_MAP[m])
          .sort((a: string, b: string) => (MONTH_MAP[a] || 0) - (MONTH_MAP[b] || 0))
          .map(m => ({ label: m, value: m }));

        setOptions(prev => ({ ...prev, anos, meses }));
      } catch (err) {
        console.error("Erro base metadata:", err);
      }
    };
    fetchBaseMetadata();
  }, []);

  // 2. AJUSTE OBRIGATÓRIO: Popular Razão Social via rpc_filtro_razao_social_ci
  useEffect(() => {
    const fetchRazoes = async () => {
      try {
        const { data } = await supabase.rpc(RPC_FILTRO_RAZAO_CI, {
          p_ano: filterAno ? Number(filterAno) : null,
          p_mes: filterMes || "Todos"
        });
        if (data) {
          const rz = (data as any[]).map(r => ({
            label: String(r.label || ''),
            value: String(r.value || '')
          })).filter(o => o.label !== '').sort((a, b) => a.label.localeCompare(b.label));
          setOptions(prev => ({ ...prev, razoes: rz }));
        }
      } catch (err) {
        console.error("Erro fetch razoes:", err);
      }
    };
    fetchRazoes();
  }, [filterAno, filterMes, activeSubMenu]);

  // 3. AJUSTE OBRIGATÓRIO: Popular Matrícula via rpc_filtro_matricula_tecnico_ci
  useEffect(() => {
    const fetchMatriculas = async () => {
      try {
        const { data } = await supabase.rpc(RPC_FILTRO_MATRICULA_CI, {
          p_ano: filterAno ? Number(filterAno) : null,
          p_mes: filterMes || "Todos",
          p_rz: filterRazao || null
        });
        if (data) {
          const mt = (data as any[]).map(m => ({
            label: String(m.label || ''),
            value: String(m.value || '')
          })).filter(o => o.label !== '').sort((a, b) => a.label.localeCompare(b.label));
          setOptions(prev => ({ ...prev, matriculas: mt }));
        }
      } catch (err) {
        console.error("Erro fetch matriculas:", err);
      }
    };
    fetchMatriculas();
  }, [filterAno, filterMes, filterRazao, activeSubMenu]);

  const handleSubMenuChange = (id: PrintSubMenu) => {
    setActiveSubMenu(id);
    setReportReady(false);
    setDataset(null);
    setFilterAno('');
    setFilterMes('');
    setFilterMatr('');
    setFilterRazao('');
    setCurrentPage(1);
  };

  const handleProcess = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const p_ano = filterAno ? Number(filterAno) : null;
      const p_mes = filterMes || "Todos";

      let rpc = RPC_CE_IMPEDIMENTOS;
      if (activeSubMenu === PrintSubMenu.SIMULACAO_NOSB) rpc = RPC_CE_SIMULACAO_NOSB;
      else if (activeSubMenu === PrintSubMenu.APRESENTACAO_CNA) rpc = RPC_CE_CNA;
      else if (activeSubMenu === PrintSubMenu.RELACAO_QUANTITATIVA) rpc = RPC_CE_QUANTITATIVO;

      const { data, error } = await supabase.rpc(rpc, { p_ano, p_mes });
      if (error) throw error;
      setDataset(data || []);
      setReportReady(true);
    } catch (err) { 
      setDataset([]); 
    } finally { 
      setLoading(false); 
    }
  };

  const processedData = useMemo(() => {
    if (!dataset) return [];
    return dataset.filter(item => {
      const rzVal = String(item.RZ || item.rz || item.razao || '');
      const matrVal = String(item.MATR || item.matr || '');
      return (filterRazao ? rzVal === filterRazao : true) && (filterMatr ? matrVal === filterMatr : true);
    }).map(item => ({
      ...item,
      indicador: (Number(item.solicitadas) > 0) ? (Number(item.realizadas) / Number(item.solicitadas)) * 100 : 0,
      razao_display: item.RZ || item.rz || item.razao || 'N/A',
      matr_display: item.MATR || item.matr || 'N/A'
    }));
  }, [dataset, filterRazao, filterMatr]);

  const totals = useMemo(() => {
    const sol = processedData.reduce((acc, c) => acc + Number(c.solicitadas || 0), 0);
    const rea = processedData.reduce((acc, c) => acc + Number(c.realizadas || 0), 0);
    return { sol, rea, pnd: Math.max(0, sol - rea), ind: sol > 0 ? (rea / sol) * 100 : 0 };
  }, [processedData]);

  const paginated = useMemo(() => processedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [processedData, currentPage]);

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    processedData.forEach(item => {
      let key = chartDimension === 'mes' ? String(item.mes).toUpperCase() : chartDimension === 'matr' ? item.matr_display : item.razao_display;
      if (!grouped[key]) grouped[key] = { label: key, solicitadas: 0, realizadas: 0 };
      grouped[key].solicitadas += Number(item.solicitadas || 0);
      grouped[key].realizadas += Number(item.realizadas || 0);
    });
    return Object.values(grouped).map(i => ({ ...i, indicador: i.solicitadas > 0 ? (i.realizadas / i.solicitadas) * 100 : 0 })).sort((a, b) => b.solicitadas - a.solicitadas).slice(0, 15);
  }, [processedData, chartDimension]);

  return (
    <div className="space-y-6 -mt-10 pb-40">
      
      {/* 1. Barra de Submenus Fixa (Sticky) ao topo */}
      <nav className="bg-white/80 backdrop-blur-xl p-2 rounded-2xl flex flex-wrap gap-1 sticky top-0 z-[100] shadow-sm border border-slate-200/60 no-print mx-4 transition-all">
        {subMenus.map((sub) => (
          <button 
            key={sub.id} 
            onClick={() => handleSubMenuChange(sub.id)} 
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubMenu === sub.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {sub.icon}
            {sub.label}
          </button>
        ))}
      </nav>

      {/* 2. Cabeçalho de Título - Posicionado abaixo da barra fixa */}
      <div className="px-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
         <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
            {activeLabel}
         </h2>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">
           Sistema de Análise de Leitura
         </p>
         <div className="h-1 w-20 bg-blue-600/30 mt-4 rounded-full"></div>
      </div>

      {/* 3. Painel de Filtros */}
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 mt-2 no-print mx-4">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600/10 text-blue-600 rounded-xl">
            <Filter size={20} />
          </div>
          <h2 className="text-base font-black uppercase italic tracking-tight text-slate-800">Parâmetros de Pesquisa:</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <div className="space-y-3">
             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ano Base</label>
             <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
               <option value="">Todos</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mês Competência</label>
             <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
               <option value="">Todos</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Razão Social</label>
             <select value={filterRazao} onChange={e => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
               <option value="">Todas</option>
               {options.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Matrícula Técnico</label>
             <select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
               <option value="">Todas</option>
               {options.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button onClick={handleProcess} disabled={loading} className="px-16 py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-3">
              {loading ? <Loader2 className="animate-spin" size={18}/> : <Play size={16} fill="currentColor"/>} 
              PROCESSAR RELATÓRIO
           </button>
           <button onClick={() => { setFilterAno(''); setFilterMes(''); setFilterRazao(''); setFilterMatr(''); setReportReady(false); setDataset(null); }} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
              <RotateCcw size={14} /> LIMPAR
           </button>
        </div>
      </section>

      {reportReady && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 mx-4">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white p-8 rounded-3xl border-l-[6px] border-blue-600 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Solicitadas</p>
                <h3 className="text-4xl font-black text-slate-900">{totals.sol.toLocaleString('pt-BR')}</h3>
              </div>
              <div className="bg-white p-8 rounded-3xl border-l-[6px] border-green-600 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Realizadas</p>
                <h3 className="text-4xl font-black text-green-700">{totals.rea.toLocaleString('pt-BR')}</h3>
              </div>
              <div className="bg-white p-8 rounded-3xl border-l-[6px] border-red-600 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pendentes</p>
                <h3 className="text-4xl font-black text-red-700">{totals.pnd.toLocaleString('pt-BR')}</h3>
              </div>
              <div className="bg-white p-8 rounded-3xl border-l-[6px] border-amber-600 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Eficiência</p>
                <h3 className="text-4xl font-black text-amber-700">{totals.ind.toFixed(2).replace('.', ',')}%</h3>
              </div>
           </div>

           <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-black uppercase italic tracking-tight flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  Listagem Analítica
                </h3>
              </div>
              <div className="overflow-x-auto p-10">
                 <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-wider border border-slate-200">
                       <tr>
                         <th className="px-6 py-4 border border-slate-200">Competência</th>
                         <th className="px-6 py-4 border border-slate-200">Razão Social</th>
                         <th className="px-6 py-4 border border-slate-200">Matrícula</th>
                         <th className="px-6 py-4 border border-slate-200 text-center">Solicitadas</th>
                         <th className="px-6 py-4 border border-slate-200 text-center">Realizadas</th>
                         <th className="px-6 py-4 border border-slate-200 text-center font-black">Indicador (%)</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {paginated.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 border border-slate-100 uppercase font-medium">{r.mes}/{r.ano}</td>
                            <td className="px-6 py-4 border border-slate-100 font-bold">{r.razao_display}</td>
                            <td className="px-6 py-4 border border-slate-100 font-mono">{r.matr_display}</td>
                            <td className="px-6 py-4 border border-slate-100 text-center">{Number(r.solicitadas).toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 border border-slate-100 text-center">{Number(r.realizadas).toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 border border-slate-100 text-center font-black text-blue-600">{r.indicador.toFixed(2).replace('.', ',')}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              <div className="px-10 py-6 bg-slate-50 flex items-center justify-between border-t border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE))}</span>
                <div className="flex gap-2">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm transition-all"><ChevronLeft size={16} /></button>
                   <button onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE)), p + 1))} disabled={currentPage >= Math.ceil(processedData.length / ITEMS_PER_PAGE)} className="p-3 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm transition-all"><ChevronRight size={16} /></button>
                </div>
              </div>
           </section>

           <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
              <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
                <h3 className="text-base font-black uppercase italic tracking-tight flex items-center gap-3">
                  <TrendingUp size={22} className="text-blue-600" />
                  Rendimento Gráfico
                </h3>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                   {['mes', 'matr', 'razao'].map(d => (
                     <button key={d} onClick={() => setChartDimension(d as any)} className={`px-5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${chartDimension === d ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{d}</button>
                   ))}
                </div>
              </div>
              <div className="h-[450px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip cursor={{fill: '#f8fafc', radius: 10}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} />
                      <Bar dataKey="solicitadas" name="Solicitadas" fill="#2563eb" barSize={35} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="realizadas" name="Realizadas" fill="#16a34a" barSize={35} radius={[6, 6, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
              </div>
           </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
           <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-10 text-center animate-in zoom-in-95 duration-500">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-100 border-t-blue-600 animate-spin"></div>
                <Database size={30} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Sincronizando Dados</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Processando modelos para o relatório atual...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
