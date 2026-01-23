
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  RPC_FILTRO_RAZAO_CI_UI,
  RPC_FILTRO_MATRICULA_CI_UI,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, RotateCcw, Database, 
  ShieldAlert, ScanLine, 
  CheckCircle2, Activity, Play, Search,
  Table as TableIcon, Layers, FileDown,
  FileText, BarChart3, PieChart, Sparkles, RefreshCw,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GoogleGenAI } from "@google/genai";

const ITEMS_PER_PAGE = 25;

enum PrintSubMenu {
  NOSB_IMPEDIMENTO = 'NOSB_IMPEDIMENTO',
  NOSB_SIMULACAO = 'NOSB_SIMULACAO'
}

interface SubMenuState {
  filterAno: string;
  filterMes: string;
  filterRz: string;
  filterMatr: string;
  searchRz: string;
  searchMatr: string;
  searchMotivo: string;
  datasetRelatorio: any[]; 
  displayResults: boolean;
  currentPage: number;
}

const initialSubState: SubMenuState = {
  filterAno: '',
  filterMes: '',
  filterRz: '',
  filterMatr: '',
  searchRz: '',
  searchMatr: '',
  searchMotivo: '',
  datasetRelatorio: [],
  displayResults: false,
  currentPage: 1
};

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const [dateOptions, setDateOptions] = useState({ anos: [] as string[], meses: [] as { label: string; value: string }[] });
  const [uiOptions, setUiOptions] = useState({ razoes: [] as string[], matriculas: [] as string[] });
  
  const [states, setStates] = useState<Record<PrintSubMenu, SubMenuState>>({
    [PrintSubMenu.NOSB_IMPEDIMENTO]: { ...initialSubState, datasetRelatorio: [] },
    [PrintSubMenu.NOSB_SIMULACAO]: { ...initialSubState, datasetRelatorio: [] }
  });

  const currentSubState = states[activeSubMenu];
  const menuConfig = {
    [PrintSubMenu.NOSB_IMPEDIMENTO]: { label: 'Impedimentos (NOSB)', icon: <ShieldAlert size={20}/>, rpc: RPC_CE_IMPEDIMENTOS, motivoKey: 'nosb_impedimento' },
    [PrintSubMenu.NOSB_SIMULACAO]: { label: 'Simulação (NOSB)', icon: <ScanLine size={20}/>, rpc: RPC_CE_SIMULACAO_NOSB, motivoKey: 'nosb_simulacao' }
  };
  const currentConfig = menuConfig[activeSubMenu];

  useEffect(() => {
    const fetchBaseFilters = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([supabase.rpc(RPC_CE_FILTRO_ANO), supabase.rpc(RPC_CE_FILTRO_MES)]);
        const anosList = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));
        const mesesList = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase()).filter((m: string) => !!MONTH_ORDER[m]).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)).map((m: string) => ({ label: m, value: m }));
        setDateOptions({ anos: anosList, meses: mesesList });
      } catch (err) { console.error("SAL - Erro filtros base:", err); }
    };
    fetchBaseFilters();
  }, []);

  useEffect(() => {
    const fetchUiOptions = async () => {
      if (!currentSubState.filterAno || !currentSubState.filterMes) return;
      setLoadingOptions(true);
      try {
        const params = { p_ano: parseInt(currentSubState.filterAno), p_mes: currentSubState.filterMes };
        const [resRz, resMatr] = await Promise.all([supabase.rpc(RPC_FILTRO_RAZAO_CI_UI, params), supabase.rpc(RPC_FILTRO_MATRICULA_CI_UI, params)]);
        setUiOptions({ razoes: (resRz.data || []).map((r: any) => String(r.rz || r.RAZAO || r)).sort(), matriculas: (resMatr.data || []).map((m: any) => String(m.matr || m.MATR || m)).sort() });
      } catch (err) { console.error("SAL - Erro UI Options:", err); } finally { setLoadingOptions(false); }
    };
    fetchUiOptions();
  }, [currentSubState.filterAno, currentSubState.filterMes]);

  const updateCurrentState = (updates: Partial<SubMenuState>) => {
    setStates(prev => ({ ...prev, [activeSubMenu]: { ...prev[activeSubMenu], ...updates } }));
  };

  const handleGerarRelatorio = async () => {
    if (!currentSubState.filterAno || !currentSubState.filterMes) { alert("Selecione Ano e Mês para processar o lote."); return; }
    setLoading(true); setAiInsights(null);
    try {
      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: parseInt(currentSubState.filterAno), 
        p_mes: currentSubState.filterMes,
        p_rz: currentSubState.filterRz || null, 
        p_matr: currentSubState.filterMatr || null,
        p_motivo: null, 
        p_limit: 100000, 
        p_offset: 0
      });
      if (error) throw error;
      updateCurrentState({ datasetRelatorio: data || [], displayResults: true, currentPage: 1 });
    } catch (err) { console.error("SAL - Falha crítica rpc:", err); } finally { setLoading(false); }
  };

  const handleGetAiInsights = async () => {
    if (filteredData.length === 0 || loadingAi) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analise este dataset de ${currentConfig.label}: Total de ${filteredData.length} registros. Principais motivos de não impressão: ${chartByMotivo.map(m => `${m.name}: ${m.value}`).join(', ')}. Gere um diagnóstico executivo em 3 parágrafos focando em melhoria de faturamento.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiInsights(response.text);
    } catch (err) { setAiInsights("Erro ao gerar insights via IA."); } finally { setLoadingAi(false); }
  };

  const filteredData = useMemo(() => {
    if (!currentSubState.datasetRelatorio) return [];
    return currentSubState.datasetRelatorio.filter(item => {
      const rz = String(item.rz || item.razao || item.RAZAO || '').toLowerCase();
      const matr = String(item.matr || item.MATR || '').toLowerCase();
      const mot = String(item[currentConfig.motivoKey] || item.motivo || '').toLowerCase();
      return rz.includes(currentSubState.searchRz.toLowerCase()) && 
             matr.includes(currentSubState.searchMatr.toLowerCase()) && 
             mot.includes(currentSubState.searchMotivo.toLowerCase());
    });
  }, [currentSubState.datasetRelatorio, currentSubState.searchRz, currentSubState.searchMatr, currentSubState.searchMotivo, currentConfig.motivoKey]);

  const quantitativeData = useMemo(() => {
    const grouped: Record<string, any> = {};
    filteredData.forEach(item => {
      const key = `${item.rz || item.razao || item.RAZAO}-${item[currentConfig.motivoKey] || item.motivo}`;
      if (!grouped[key]) grouped[key] = { rz: item.rz || item.razao || item.RAZAO, motivo: item[currentConfig.motivoKey] || item.motivo, count: 0 };
      grouped[key].count++;
    });
    return Object.values(grouped).sort((a:any, b:any) => b.count - a.count);
  }, [filteredData, currentConfig.motivoKey]);

  const chartByMotivo = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => { const val = item[currentConfig.motivoKey] || 'N/A'; counts[val] = (counts[val] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredData, currentConfig.motivoKey]);

  const paginatedData = useMemo(() => {
    const start = (currentSubState.currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentSubState.currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  return (
    <div className="space-y-12 pb-32 animate-in fade-in duration-700">
      {/* NAVEGAÇÃO DE SUBMENU */}
      <div className="bg-white p-2 rounded-[40px] shadow-2xl border border-slate-100 flex gap-2">
        {Object.entries(menuConfig).map(([key, config]) => {
          const isActive = activeSubMenu === key;
          return (
            <button key={key} onClick={() => setActiveSubMenu(key as PrintSubMenu)} className={`flex-1 flex items-center justify-center gap-4 px-10 py-6 rounded-[32px] text-[11px] font-black uppercase tracking-[0.25em] transition-all ${isActive ? 'bg-slate-950 text-white shadow-2xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
              {config.icon} {config.label}
            </button>
          );
        })}
      </div>

      {/* PAINEL DE PARÂMETROS V9 */}
      <section className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="flex items-center gap-5 mb-14">
          <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/30"><Filter size={24} /></div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Configuração de Relatório</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mt-2">Extração de Lote via Motor V9 Core</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-2">Ano Base</label>
            <select value={currentSubState.filterAno} onChange={e => updateCurrentState({ filterAno: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] py-6 px-8 font-black text-sm text-slate-800 focus:border-blue-500 outline-none transition-all">
               <option value="">SELECIONAR ANO</option>
               {dateOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-2">Mês Competência</label>
            <select value={currentSubState.filterMes} onChange={e => updateCurrentState({ filterMes: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] py-6 px-8 font-black text-sm text-slate-800 focus:border-blue-500 outline-none transition-all">
               <option value="">SELECIONAR MÊS</option>
               {dateOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-2">Razão Social</label>
            <select value={currentSubState.filterRz} onChange={e => updateCurrentState({ filterRz: e.target.value })} disabled={loadingOptions} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] py-6 px-8 font-black text-sm text-slate-800 disabled:opacity-50">
               <option value="">TODAS AS RAZÕES</option>
               {uiOptions.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-2">Matrícula Técnico</label>
            <select value={currentSubState.filterMatr} onChange={e => updateCurrentState({ filterMatr: e.target.value })} disabled={loadingOptions} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] py-6 px-8 font-black text-sm text-slate-800 disabled:opacity-50">
               <option value="">TODAS AS MATRÍCULAS</option>
               {uiOptions.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-16 flex justify-center gap-8">
           <button onClick={handleGerarRelatorio} disabled={loading || !currentSubState.filterAno || !currentSubState.filterMes} className="px-28 py-7 bg-blue-600 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.35em] shadow-2xl hover:bg-blue-700 hover:scale-[1.03] transition-all disabled:opacity-20 flex items-center gap-6">
              {loading ? <Activity className="animate-spin" size={24} /> : <Play size={24} fill="currentColor" />} GERAR RELATÓRIO
           </button>
           <button onClick={() => updateCurrentState({ ...initialSubState, datasetRelatorio: [] })} className="px-14 py-7 bg-slate-100 text-slate-500 rounded-[32px] text-[10px] font-black uppercase tracking-widest flex items-center gap-4 hover:bg-slate-200 transition-all"><RotateCcw size={20} /> REINICIAR</button>
        </div>
      </section>

      {currentSubState.displayResults && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
           {/* DASHBOARD RÁPIDO E IA */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 bg-slate-950 p-12 rounded-[56px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between border border-white/5">
                 <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none"><Sparkles size={180} /></div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-5 mb-8">
                       <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-500/40"><Sparkles size={28} className="text-white" /></div>
                       <h3 className="text-2xl font-black uppercase tracking-tighter italic">Diagnóstico Estratégico SAL</h3>
                    </div>
                    {aiInsights ? (
                      <div className="p-10 bg-white/5 rounded-[40px] border border-white/10 text-slate-200 whitespace-pre-wrap text-sm leading-relaxed animate-in fade-in">{aiInsights}</div>
                    ) : (
                      <div className="flex flex-col gap-6">
                         <p className="text-[11px] text-slate-400 uppercase font-black tracking-[0.4em]">Análise cognitiva de gargalos operacionais</p>
                         <button onClick={handleGetAiInsights} disabled={loadingAi} className="w-fit px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-blue-500 transition-all flex items-center gap-4 shadow-2xl shadow-blue-600/30">
                            {loadingAi ? <RefreshCw className="animate-spin" size={18} /> : "Sincronizar Consultoria IA"}
                         </button>
                      </div>
                    )}
                 </div>
              </div>
              <div className="bg-white p-12 rounded-[56px] border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                 <div className="p-6 bg-slate-50 rounded-full mb-6 text-slate-300"><PieChart size={40} /></div>
                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-3">Volume do Lote</p>
                 <h3 className="text-7xl font-black text-slate-950 tracking-tighter italic">{filteredData.length.toLocaleString()}</h3>
                 <div className="mt-8 flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-[9px] font-black uppercase border border-blue-100">
                    <CheckCircle2 size={12}/> DATASET SINCRONIZADO
                 </div>
              </div>
           </div>

           {/* FILTROS LOCAIS (BUSCA EM MEMÓRIA) */}
           <div className="bg-white p-12 rounded-[56px] border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Filtrar Razão Local</label>
                 <div className="relative"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} /><input type="text" value={currentSubState.searchRz} onChange={(e) => updateCurrentState({ searchRz: e.target.value, currentPage: 1 })} className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold focus:border-blue-500 outline-none transition-all" placeholder="Buscar razão no lote..."/></div>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Filtrar Matrícula Local</label>
                 <div className="relative"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} /><input type="text" value={currentSubState.searchMatr} onChange={(e) => updateCurrentState({ searchMatr: e.target.value, currentPage: 1 })} className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold focus:border-blue-500 outline-none transition-all" placeholder="Buscar matrícula no lote..."/></div>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Filtrar Motivo Local</label>
                 <div className="relative"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} /><input type="text" value={currentSubState.searchMotivo} onChange={(e) => updateCurrentState({ searchMotivo: e.target.value, currentPage: 1 })} className="w-full bg-slate-50 border border-slate-100 rounded-[24px] py-5 pl-14 pr-6 text-sm font-bold focus:border-blue-500 outline-none transition-all" placeholder="Buscar ocorrência no lote..."/></div>
              </div>
           </div>

           {/* TABELA ANALÍTICA PRINCIPAL */}
           <section className="bg-white rounded-[72px] shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-14 border-b border-slate-100 flex flex-wrap items-center justify-between gap-10 bg-slate-50/20">
                <div className="flex items-center gap-7">
                  <div className="p-5 bg-slate-950 text-white rounded-[24px] shadow-2xl shadow-slate-900/20"><TableIcon size={28} /></div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900 leading-none">Listagem Analítica do Lote</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2.5">Visualização de alta densidade informativa</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(filteredData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "SAL_Lote");
                    XLSX.writeFile(wb, `SAL_Lote_${activeSubMenu}.xlsx`);
                  }} className="flex items-center gap-3 px-8 py-5 bg-emerald-600 text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20"><FileDown size={20}/> EXCEL</button>
                </div>
              </div>
              
              <div className="overflow-x-auto p-10">
                 <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-950 text-white uppercase font-black tracking-[0.1em]">
                       <tr>
                         <th className="px-6 py-5 border border-slate-800">ANO</th>
                         <th className="px-6 py-5 border border-slate-800">MÊS</th>
                         <th className="px-6 py-5 border border-slate-800">RAZÃO SOCIAL</th>
                         <th className="px-6 py-5 border border-slate-800">UL</th>
                         <th className="px-6 py-5 border border-slate-800">INSTAL.</th>
                         <th className="px-6 py-5 border border-slate-800">MEDIDOR</th>
                         <th className="px-6 py-5 border border-slate-800">REG</th>
                         <th className="px-6 py-5 border border-slate-800">TIPO</th>
                         <th className="px-6 py-5 border border-slate-800">MATR</th>
                         <th className="px-6 py-5 border border-slate-800 text-center">COD</th>
                         <th className="px-6 py-5 border border-slate-800 text-right">LEITURA</th>
                         <th className="px-6 py-5 border border-slate-800 bg-blue-700">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                       {paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-blue-50/40 transition-all">
                            <td className="px-6 py-4 border border-slate-50 text-slate-400">{r.ano || r.Ano}</td>
                            <td className="px-6 py-4 border border-slate-50 uppercase text-slate-400">{r.mes || r.Mes}</td>
                            <td className="px-6 py-4 border border-slate-50 uppercase truncate max-w-[200px]" title={r.rz || r.razao || r.RAZAO}>{r.rz || r.razao || r.RAZAO}</td>
                            <td className="px-6 py-4 border border-slate-50 text-slate-400">{r.rz_ul_lv || r.ul}</td>
                            <td className="px-6 py-4 border border-slate-50 font-mono text-blue-600">{r.instalacao}</td>
                            <td className="px-6 py-4 border border-slate-50 font-mono text-slate-500">{r.medidor}</td>
                            <td className="px-6 py-4 border border-slate-50 text-slate-400">{r.reg}</td>
                            <td className="px-6 py-4 border border-slate-50 text-[9px] uppercase font-black">{r.tipo}</td>
                            <td className="px-6 py-4 border border-slate-50 font-black">{r.matr || r.MATR}</td>
                            <td className="px-6 py-4 border border-slate-50 text-center"><span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black">{r.nl || r.NL}</span></td>
                            <td className="px-6 py-4 border border-slate-50 text-right font-black text-slate-900">{r.l_atual}</td>
                            <td className="px-6 py-4 border border-slate-50 font-black italic text-blue-900 bg-blue-50/40">{r[currentConfig.motivoKey] || r.motivo || 'N/A'}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              
              <div className="px-14 py-10 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentSubState.currentPage} de {totalPages}</span>
                   <span className="text-[12px] font-black text-slate-900 mt-1 uppercase tracking-tighter italic italic">{filteredData.length.toLocaleString()} Registros Processados</span>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => updateCurrentState({ currentPage: Math.max(1, currentSubState.currentPage - 1) })} disabled={currentSubState.currentPage === 1} className="px-10 py-5 bg-white border-2 border-slate-200 rounded-3xl disabled:opacity-30 hover:border-slate-900 transition-all font-black text-[11px] uppercase shadow-sm flex items-center gap-3">
                      <ChevronLeft size={18}/> ANTERIOR
                   </button>
                   <button onClick={() => updateCurrentState({ currentPage: Math.min(totalPages, currentSubState.currentPage + 1) })} disabled={currentSubState.currentPage >= totalPages} className="px-10 py-5 bg-white border-2 border-slate-200 rounded-3xl disabled:opacity-30 hover:border-slate-900 transition-all font-black text-[11px] uppercase shadow-sm flex items-center gap-3">
                      PRÓXIMO <ChevronRight size={18}/>
                   </button>
                </div>
              </div>
           </section>
        </div>
      )}

      {/* MODAL DE SINCRONIZAÇÃO */}
      {loading && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center">
           <div className="bg-white p-24 rounded-[80px] shadow-2xl flex flex-col items-center gap-12 animate-in zoom-in-95 duration-500 border border-white/10">
              <div className="relative h-40 w-40">
                 <div className="absolute inset-0 rounded-full border-[14px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Database size={48} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="text-center">
                <h2 className="text-4xl font-black uppercase italic text-slate-950 tracking-tighter">Sincronizando SAL V9</h2>
                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] mt-6 animate-pulse leading-loose">Capturando e Mapeando Lote Analítico<br/>Aguarde o Processamento do Motor Core...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
