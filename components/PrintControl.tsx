
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
  RotateCcw, Database, 
  ShieldAlert, ScanLine, 
  Table as TableIcon, FileDown,
  Sparkles, RefreshCw,
  ChevronLeft, ChevronRight,
  TrendingUp,
  Printer as PrinterIcon, Zap, Users,
  Filter, ClipboardList, Target, Layers,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { GoogleGenAI } from "@google/genai";
import IndicatorCard from './IndicatorCard';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 25;

enum PrintSubMenu {
  NOSB_IMPEDIMENTO = 'NOSB_IMPEDIMENTO',
  NOSB_SIMULACAO = 'NOSB_SIMULACAO'
}

interface FilterOptions {
  anos: string[];
  meses: { label: string; value: string }[];
  razoes: string[];
  matriculas: string[];
}

interface PrintState {
  filterAno: string;
  filterMes: string;
  filterRz: string;
  filterMatr: string;
  dataset: any[];
  isLoaded: boolean;
  currentPage: number;
}

const initialPrintState: PrintState = {
  filterAno: '',
  filterMes: '',
  filterRz: '',
  filterMatr: '',
  dataset: [],
  isLoaded: false,
  currentPage: 1
};

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const [options, setOptions] = useState<FilterOptions>({ 
    anos: [], meses: [], razoes: [], matriculas: [] 
  });
  
  const [states, setStates] = useState<Record<PrintSubMenu, PrintState>>({
    [PrintSubMenu.NOSB_IMPEDIMENTO]: { ...initialPrintState },
    [PrintSubMenu.NOSB_SIMULACAO]: { ...initialPrintState }
  });

  const currentState = states[activeSubMenu];

  const menuConfig = {
    [PrintSubMenu.NOSB_IMPEDIMENTO]: { 
      label: 'Impedimentos (NOSB)', 
      icon: <ShieldAlert size={20}/>, 
      rpc: RPC_CE_IMPEDIMENTOS, 
      motivoKey: 'nosb_impedimento' 
    },
    [PrintSubMenu.NOSB_SIMULACAO]: { 
      label: 'Simulação (NOSB)', 
      icon: <ScanLine size={20}/>, 
      rpc: RPC_CE_SIMULACAO_NOSB, 
      motivoKey: 'nosb_simulacao' 
    }
  };

  const currentConfig = menuConfig[activeSubMenu];

  // Extração robusta de string para evitar [Object object]
  const safeExtractString = (val: any, field: string): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      const extracted = val[field] || val.rz || val.matr || val.razao || val.razao_social || (Object.values(val)[0]);
      if (extracted === null || extracted === undefined) return "";
      return typeof extracted === 'object' ? JSON.stringify(extracted) : String(extracted);
    }
    return String(val);
  };

  useEffect(() => {
    const fetchBaseFilters = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        const anosList = (resAnos.data || []).map((a: any) => safeExtractString(a, 'ano')).filter(Boolean).sort((a: any, b: any) => Number(b) - Number(a));
        const mesesList = (resMeses.data || []).map((m: any) => safeExtractString(m, 'mes').toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map((m: string) => ({ label: m, value: m }));
        setOptions(prev => ({ ...prev, anos: anosList, meses: mesesList }));
      } catch (err) { console.error("SAL - Erro filtros base:", err); }
    };
    fetchBaseFilters();
  }, []);

  // Filtros dinâmicos baseados no Ano e Mês selecionados
  useEffect(() => {
    const fetchDynamicFilters = async () => {
      if (!currentState.filterAno || !currentState.filterMes) {
        setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
        return;
      }
      setLoadingFilters(true);
      try {
        const p_ano = currentState.filterAno; 
        const p_mes = currentState.filterMes;
        
        // Convertendo ano para int para a RPC de filtros, pois estas geralmente esperam number
        const yearInt = parseInt(p_ano);
        
        const [resRz, resMatr] = await Promise.all([
          supabase.rpc(RPC_FILTRO_RAZAO_CI_UI, { p_ano: yearInt, p_mes }),
          supabase.rpc(RPC_FILTRO_MATRICULA_CI_UI, { p_ano: yearInt, p_mes })
        ]);

        const razoesLimpas = (resRz.data || []).map((i: any) => safeExtractString(i, 'rz')).filter(Boolean);
        const matriculasLimpas = (resMatr.data || []).map((i: any) => safeExtractString(i, 'matr')).filter(Boolean);

        setOptions(prev => ({
          ...prev,
          razoes: Array.from(new Set(razoesLimpas)).sort(),
          matriculas: Array.from(new Set(matriculasLimpas)).sort()
        }));
      } catch (err) {
        console.error("SAL - Erro filtros dinâmicos:", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchDynamicFilters();
  }, [currentState.filterAno, currentState.filterMes, activeSubMenu]);

  const updateCurrentState = (updates: Partial<PrintState>) => {
    setStates(prev => ({ ...prev, [activeSubMenu]: { ...prev[activeSubMenu], ...updates } }));
  };

  const handleGerarRelatorio = async () => {
    if (!currentState.filterAno || !currentState.filterMes) { 
      alert("Selecione obrigatoriamente o Ano e o Mês para continuar."); 
      return; 
    }
    setLoading(true); 
    setAiInsights(null);
    try {
      // Chamada da RPC com p_ano passado como string conforme requisito (::text no BD)
      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: currentState.filterAno,
        p_mes: currentState.filterMes,
        p_rz: currentState.filterRz || null, 
        p_matr: currentState.filterMatr || null,
        p_motivo: null,
        p_limit: 1000000,
        p_offset: 0
      });
      
      if (error) throw error;
      updateCurrentState({ dataset: data || [], isLoaded: true, currentPage: 1 });
    } catch (err) { 
      console.error("SAL - Erro Auditoria:", err); 
      alert("Falha no processamento de dados reais do banco de dados.");
    } finally { 
      setLoading(false); 
    }
  };

  const paginatedData = useMemo(() => {
    const start = (currentState.currentPage - 1) * ITEMS_PER_PAGE;
    return currentState.dataset.slice(start, start + ITEMS_PER_PAGE);
  }, [currentState.dataset, currentState.currentPage]);

  const totalPages = Math.max(1, Math.ceil(currentState.dataset.length / ITEMS_PER_PAGE));

  const metrics = useMemo(() => {
    const data = currentState.dataset;
    const uniqueMatrs = new Set(data.map(i => safeExtractString(i.matr, 'matr'))).size;
    const uniqueRzs = new Set(data.map(i => safeExtractString(i.rz || i.razao, 'rz'))).size;
    return {
      total: data.length,
      matrs: uniqueMatrs,
      rzs: uniqueRzs
    };
  }, [currentState.dataset]);

  const quantitativoData = useMemo(() => {
    const map: Record<string, { rz: string, motivo: string, qtd: number }> = {};
    currentState.dataset.forEach(item => {
      const rz = safeExtractString(item.rz || item.razao, 'rz');
      // Tenta a coluna 'motivo' genérica ou a específica do config
      const motivo = String(item.motivo || item[currentConfig.motivoKey] || 'N/A');
      const key = `${rz}|${motivo}`;
      if (!map[key]) map[key] = { rz, motivo, qtd: 0 };
      map[key].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd);
  }, [currentState.dataset, currentConfig.motivoKey]);

  const chartData = useMemo(() => {
    const getTop = (keyFn: (i: any) => string) => {
      const map: Record<string, number> = {};
      currentState.dataset.forEach(i => { const k = keyFn(i); map[k] = (map[k] || 0) + 1; });
      return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    };
    return {
      motivo: getTop(i => String(i.motivo || i[currentConfig.motivoKey] || 'N/A')),
      razao: getTop(i => safeExtractString(i.rz || i.razao, 'rz') || 'N/A'),
      matr: getTop(i => safeExtractString(i.matr, 'matr') || 'N/A'),
      mes: getTop(i => String(i.Mes || i.mes || 'N/A')),
      ano: getTop(i => String(i.Ano || i.ano || 'N/A'))
    };
  }, [currentState.dataset, currentConfig.motivoKey]);

  const handleGetAiInsights = async () => {
    if (currentState.dataset.length === 0 || loadingAi) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Como consultor sênior do SAL v9, analise este dataset de ${currentConfig.label}: ${currentState.dataset.length} registros detectados. Ano ${currentState.filterAno}, Mês ${currentState.filterMes}. Forneça um diagnóstico executivo focado em redução de desvios de faturamento e recomendações de controle operacional. Seja direto e profissional.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiInsights(response.text);
    } catch (err) { setAiInsights("IA indisponível no momento."); } finally { setLoadingAi(false); }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-200 flex gap-3 print:hidden">
        {Object.entries(menuConfig).map(([key, config]) => {
          const isActive = activeSubMenu === key;
          return (
            <button 
              key={key} 
              onClick={() => { setActiveSubMenu(key as PrintSubMenu); setAiInsights(null); }} 
              className={`flex-1 flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'bg-slate-950 text-white shadow-xl scale-[1.01]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon} {config.label}
            </button>
          );
        })}
      </div>

      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 print:hidden relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Filter size={20} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Parâmetros de Auditoria</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Impressão e Faturamento</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione o Ano</label>
            <select 
              value={currentState.filterAno} 
              onChange={e => updateCurrentState({ filterAno: e.target.value, filterRz: '', filterMatr: '', isLoaded: false })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
               <option value="">Selecione...</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione o Mês</label>
            <select 
              value={currentState.filterMes} 
              onChange={e => updateCurrentState({ filterMes: e.target.value, filterRz: '', filterMatr: '', isLoaded: false })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
               <option value="">Selecione...</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione a Razão</label>
            <select 
              value={currentState.filterRz} 
              onChange={e => updateCurrentState({ filterRz: e.target.value })} 
              className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all ${loadingFilters ? 'opacity-50 animate-pulse' : ''}`}
              disabled={loadingFilters || !currentState.filterAno || !currentState.filterMes}
            >
               <option value="">Todas as Razões</option>
               {options.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione a Matrícula</label>
            <select 
              value={currentState.filterMatr} 
              onChange={e => updateCurrentState({ filterMatr: e.target.value })} 
              className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all ${loadingFilters ? 'opacity-50 animate-pulse' : ''}`}
              disabled={loadingFilters || !currentState.filterAno || !currentState.filterMes}
            >
               <option value="">Todas as Matrículas</option>
               {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button 
             onClick={handleGerarRelatorio} 
             disabled={loading || !currentState.filterAno || !currentState.filterMes} 
             className="px-20 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center gap-4"
           >
              {loading ? <Activity className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />}
              GERAR RELATÓRIO
           </button>
           <button 
             onClick={() => updateCurrentState({ ...initialPrintState })} 
             className="px-12 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-200 transition-all"
           >
             <RotateCcw size={16} /> LIMPAR TUDO
           </button>
        </div>
      </section>

      {currentState.isLoaded && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <IndicatorCard label="Dataset Consolidado" value={metrics.total.toLocaleString()} icon={<ClipboardList size={24}/>} color="blue" />
              <IndicatorCard label="Agentes de Campo" value={metrics.matrs} icon={<Users size={24}/>} color="green" />
              <IndicatorCard label="Unidades de Negócio" value={metrics.rzs} icon={<Target size={24}/>} color="amber" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
              <div className="lg:col-span-4 bg-slate-900 p-12 rounded-[3.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group border border-white/5">
                 <Sparkles className="absolute -top-10 -right-10 text-white/5 group-hover:scale-125 transition-transform duration-1000" size={240} />
                 <div className="relative z-10">
                    <div className="flex items-center gap-6 mb-10">
                       <div className="p-4 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-3xl shadow-2xl shadow-blue-500/20"><Sparkles size={32} /></div>
                       <div>
                          <h3 className="text-2xl font-black uppercase italic tracking-tight">Análise Executiva v9.0</h3>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mt-1">Diagnóstico de Desvios de Faturamento</p>
                       </div>
                    </div>
                    {aiInsights ? (
                      <div className="text-slate-300 text-base leading-relaxed whitespace-pre-wrap font-medium bg-white/5 p-10 rounded-[2.5rem] border border-white/10 shadow-inner animate-in fade-in duration-500 prose prose-invert max-w-none">{aiInsights}</div>
                    ) : (
                      <div className="space-y-6">
                        <p className="text-slate-400 text-sm max-w-xl font-medium">O núcleo de inteligência identificou padrões críticos no dataset atual. Deseja realizar uma consultoria preditiva?</p>
                        <button onClick={handleGetAiInsights} disabled={loadingAi} className="px-14 py-6 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all flex items-center gap-4 shadow-2xl">
                          {loadingAi ? <RefreshCw className="animate-spin" size={20} /> : <><Sparkles size={18} /> INICIAR CONSULTORIA PREDITIVA</>}
                        </button>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           <section className="bg-white rounded-[4rem] shadow-sm border border-slate-200 overflow-hidden print-report-only">
              <div className="px-12 py-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 print:hidden">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl"><TableIcon size={24} /></div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">Relatório Tabular de Auditoria</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registros reais sincronizados do banco de dados</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(currentState.dataset);
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "SAL_Export");
                    XLSX.writeFile(wb, `SAL_CI_${activeSubMenu}_${Date.now()}.xlsx`);
                  }} className="flex items-center gap-4 px-8 py-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-emerald-600/20">
                    <FileDown size={20}/> EXCEL
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-4 px-8 py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-600/20">
                    <PrinterIcon size={20}/> IMPRIMIR
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-[11px] border-collapse print:text-[7.5pt]">
                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                       <tr>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">MES</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">ANO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">RAZÃO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">UL</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">INSTALAÇÃO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">MEDIDOR</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">REG</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">TIPO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">MATR</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">COD</th>
                         <th className="px-6 py-6 border-x border-slate-100 text-right">LEITURA</th>
                         <th className="px-6 py-6 border-x border-slate-100 bg-blue-50/50 font-black text-blue-900 italic">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                       {paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase font-bold">{r.Mes || r.mes}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">{r.Ano || r.ano}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-bold text-slate-900 uppercase whitespace-nowrap">{safeExtractString(r.rz || r.razao, 'rz')}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">{r.rz_ul_lv}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-mono text-blue-600 font-bold">{r.instalacao}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-mono">{r.medidor}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase">{r.reg}</td>
                            <td className="px-6 py-5 border-x border-slate-50">{r.tipo}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-bold">{safeExtractString(r.matr, 'matr')}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">
                              <span className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-700">{r.nl}</span>
                            </td>
                            <td className="px-6 py-5 border-x border-slate-50 text-right font-black text-slate-900">{r.l_atual}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-black italic text-blue-800 bg-blue-50/20">{r.motivo || r[currentConfig.motivoKey]}</td>
                          </tr>
                       ))}
                       {currentState.dataset.length === 0 && (
                         <tr><td colSpan={12} className="py-32 text-center text-slate-300 font-black uppercase tracking-[0.3em] italic">Nenhum dado encontrado</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
              <div className="px-12 py-8 bg-slate-50 border-t flex items-center justify-between print:hidden">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Exibindo registros {(currentState.currentPage-1)*ITEMS_PER_PAGE + 1} a {Math.min(currentState.currentPage*ITEMS_PER_PAGE, currentState.dataset.length)} de {currentState.dataset.length}</span>
                <div className="flex gap-4">
                   <button onClick={() => updateCurrentState({ currentPage: Math.max(1, currentState.currentPage - 1) })} disabled={currentState.currentPage === 1} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-white hover:border-blue-600 transition-all disabled:opacity-30"><ChevronLeft size={20}/></button>
                   <button onClick={() => updateCurrentState({ currentPage: Math.min(totalPages, currentState.currentPage + 1) })} disabled={currentState.currentPage >= totalPages} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-white hover:border-blue-600 transition-all disabled:opacity-30"><ChevronRight size={20}/></button>
                </div>
              </div>
           </section>

           <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-10 py-8 border-b border-slate-100 flex items-center gap-4">
               <Layers size={22} className="text-blue-600" />
               <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">Relação Quantitativa de Desvios</h3>
             </div>
             <div className="p-10">
               <table className="w-full text-[11px] border-collapse">
                 <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest">
                   <tr>
                     <th className="px-6 py-4 border border-slate-100 text-left">RAZÃO SOCIAL</th>
                     <th className="px-6 py-4 border border-slate-100 text-left">NÃO IMPRESSÃO (MOTIVO)</th>
                     <th className="px-6 py-4 border border-slate-100 text-right">QUANTIDADE</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {quantitativoData.map((item, idx) => (
                     <tr key={idx} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 border-x border-slate-50 font-bold uppercase">{item.rz}</td>
                       <td className="px-6 py-4 border-x border-slate-50 text-blue-600 italic font-medium">{item.motivo}</td>
                       <td className="px-6 py-4 border-x border-slate-50 text-right font-black text-slate-900">{item.qtd}</td>
                     </tr>
                   ))}
                   {quantitativoData.length === 0 && (
                     <tr><td colSpan={3} className="py-10 text-center text-slate-400 font-bold uppercase">Sem dados quantitativos</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <section className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200">
                 <div className="flex items-center justify-between mb-12">
                   <h3 className="text-base font-black uppercase text-slate-900 flex items-center gap-4">
                     <TrendingUp className="text-blue-600" size={26}/> Top 10 Ocorrências por Motivo
                   </h3>
                 </div>
                 <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData.motivo} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} interval={0} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                          <Tooltip cursor={{fill: '#f8fafc', radius: 15}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '24px', fontSize: '11px', fontWeight: 'bold'}} />
                          <Bar dataKey="value" fill="#2563eb" radius={[15, 15, 0, 0]} barSize={50}>
                             {chartData.motivo.map((_, index) => <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />)}
                             <LabelList dataKey="value" position="top" style={{fill: '#0f172a', fontSize: '12px', fontWeight: '900'}} offset={15}/>
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </section>
              <section className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200">
                 <div className="flex items-center justify-between mb-12">
                   <h3 className="text-base font-black uppercase text-slate-900 flex items-center gap-4">
                     <Users className="text-slate-950" size={26}/> Desempenho por Agente de Campo
                   </h3>
                 </div>
                 <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData.matr} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} interval={0} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                          <Tooltip cursor={{fill: '#f8fafc', radius: 15}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '24px', fontSize: '11px', fontWeight: 'bold'}} />
                          <Bar dataKey="value" fill="#0f172a" radius={[15, 15, 0, 0]} barSize={50}>
                             {chartData.matr.map((_, index) => <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />)}
                             <LabelList dataKey="value" position="top" style={{fill: '#1e293b', fontSize: '12px', fontWeight: '900'}} offset={15}/>
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </section>
           </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 text-center border border-white/20">
              <div className="relative h-40 w-40">
                 <div className="absolute inset-0 rounded-full border-[12px] border-slate-100 border-t-blue-600 animate-spin"></div>
                 <Database size={48} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black uppercase text-slate-900 tracking-tight italic">SAL Engine v9.0</h2>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.8em] animate-pulse">Cruzando Dados de Faturamento...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
