
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
  CheckCircle2, Activity, Play, 
  Table as TableIcon, FileDown,
  Sparkles, RefreshCw,
  ChevronLeft, ChevronRight,
  Layers, TrendingUp, Calendar,
  Printer as PrinterIcon, Zap, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from "@google/genai";

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
  // Estado para controlar qual submenu está ativo
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  
  // Estados globais de carregamento
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  // Opções de filtros populadas dinamicamente
  const [options, setOptions] = useState<FilterOptions>({ 
    anos: [], meses: [], razoes: [], matriculas: [] 
  });
  
  // Estados independentes para cada submenu (requisito de filtros isolados)
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

  // 1. Carregar filtros de base (Ano e Mês) uma única vez
  useEffect(() => {
    const fetchBaseFilters = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        const anosList = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));
        const mesesList = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map((m: string) => ({ label: m, value: m }));
        setOptions(prev => ({ ...prev, anos: anosList, meses: mesesList }));
      } catch (err) { console.error("SAL - Erro filtros base:", err); }
    };
    fetchBaseFilters();
  }, []);

  // 2. Carregar Razões e Matrículas dinamicamente baseados no Ano/Mês selecionados
  useEffect(() => {
    const fetchDynamicFilters = async () => {
      if (!currentState.filterAno || !currentState.filterMes) {
        setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
        return;
      }
      setLoadingFilters(true);
      try {
        const p_ano = parseInt(currentState.filterAno);
        const p_mes = currentState.filterMes;
        
        // Chamada das RPCs de UI específicas conforme requisito
        const [resRz, resMatr] = await Promise.all([
          supabase.rpc(RPC_FILTRO_RAZAO_CI_UI, { p_ano, p_mes }),
          supabase.rpc(RPC_FILTRO_MATRICULA_CI_UI, { p_ano, p_mes })
        ]);

        setOptions(prev => ({
          ...prev,
          razoes: (resRz.data || []).map((i: any) => String(i.rz || i.razao || i)).sort(),
          matriculas: (resMatr.data || []).map((i: any) => String(i.matr || i)).sort()
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

  // 3. Execução da consulta principal (RPC do submenu ativo)
  const handleGerarRelatorio = async () => {
    if (!currentState.filterAno || !currentState.filterMes) { 
      alert("Selecione obrigatoriamente o Ano e o Mês."); 
      return; 
    }
    setLoading(true); 
    setAiInsights(null);
    try {
      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: parseInt(currentState.filterAno), 
        p_mes: currentState.filterMes,
        p_rz: currentState.filterRz || null, 
        p_matr: currentState.filterMatr || null
      });
      
      if (error) throw error;
      updateCurrentState({ dataset: data || [], isLoaded: true, currentPage: 1 });
    } catch (err) { 
      console.error("SAL - Erro Faturamento:", err); 
      alert("Falha ao comunicar com o banco de dados.");
    } finally { 
      setLoading(false); 
    }
  };

  const paginatedData = useMemo(() => {
    const start = (currentState.currentPage - 1) * ITEMS_PER_PAGE;
    return currentState.dataset.slice(start, start + ITEMS_PER_PAGE);
  }, [currentState.dataset, currentState.currentPage]);

  const totalPages = Math.max(1, Math.ceil(currentState.dataset.length / ITEMS_PER_PAGE));

  // 4. Relação Quantitativa consolidada (Razão vs Motivo)
  const quantitativeData = useMemo(() => {
    const groups: Record<string, { rz: string, motivo: string, count: number }> = {};
    currentState.dataset.forEach(item => {
      const rz = String(item.rz || item.razao || 'N/A');
      const motivo = String(item[currentConfig.motivoKey] || 'N/A');
      const key = `${rz}|${motivo}`;
      if (!groups[key]) {
        groups[key] = { rz, motivo, count: 0 };
      }
      groups[key].count++;
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [currentState.dataset, currentConfig.motivoKey]);

  // 5. Dados para Analytics comparativo
  const chartData = useMemo(() => {
    const getTop = (keyFn: (i: any) => string) => {
      const map: Record<string, number> = {};
      currentState.dataset.forEach(i => { const k = keyFn(i); map[k] = (map[k] || 0) + 1; });
      return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    };
    return {
      motivo: getTop(i => String(i[currentConfig.motivoKey] || 'N/A')),
      razao: getTop(i => String(i.rz || 'N/A')),
      matr: getTop(i => String(i.matr || 'N/A'))
    };
  }, [currentState.dataset, currentConfig.motivoKey]);

  // 6. Consultoria IA com Gemini
  const handleGetAiInsights = async () => {
    if (currentState.dataset.length === 0 || loadingAi) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analise este dataset de ${currentConfig.label}: ${currentState.dataset.length} registros. Forneça um diagnóstico executivo focado em redução de impedimentos de faturamento. Use tom técnico de consultoria SAL v9.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiInsights(response.text);
    } catch (err) { setAiInsights("Falha na sincronização IA."); } finally { setLoadingAi(false); }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      {/* Cabeçalho de Navegação de Submenus */}
      <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-200 flex gap-3 print:hidden">
        {Object.entries(menuConfig).map(([key, config]) => {
          const isActive = activeSubMenu === key;
          return (
            <button 
              key={key} 
              onClick={() => setActiveSubMenu(key as PrintSubMenu)} 
              className={`flex-1 flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'bg-slate-950 text-white shadow-xl scale-[1.01]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon} {config.label}
            </button>
          );
        })}
      </div>

      {/* Seção de Filtros Independentes */}
      <section className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Calendar size={12}/> Ano Operacional
            </label>
            <select 
              value={currentState.filterAno} 
              onChange={e => updateCurrentState({ filterAno: e.target.value, filterRz: '', filterMatr: '' })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all"
            >
               <option value="">Selecione...</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Activity size={12}/> Mês Competência
            </label>
            <select 
              value={currentState.filterMes} 
              onChange={e => updateCurrentState({ filterMes: e.target.value, filterRz: '', filterMatr: '' })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all"
            >
               <option value="">Selecione...</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Layers size={12}/> Razão Social
            </label>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Users size={12}/> Matrícula Técnico
            </label>
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

        <div className="mt-12 flex justify-center gap-4">
           <button 
             onClick={handleGerarRelatorio} 
             disabled={loading || !currentState.filterAno || !currentState.filterMes} 
             className="px-20 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center gap-3"
           >
              {loading ? <Activity className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
              GERAR RELATÓRIO
           </button>
           <button 
             onClick={() => updateCurrentState({ ...initialPrintState })} 
             className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all"
           >
             <RotateCcw size={14} /> LIMPAR FILTROS
           </button>
        </div>
      </section>

      {currentState.isLoaded && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
           {/* Painel Executivo IA */}
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:hidden">
              <div className="lg:col-span-3 bg-slate-950 p-12 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                 <Sparkles className="absolute top-10 right-10 text-white/5 group-hover:scale-125 transition-transform duration-1000" size={150} />
                 <div className="relative z-10">
                    <div className="flex items-center gap-5 mb-8">
                       <div className="p-4 bg-blue-600 rounded-2xl shadow-lg"><Zap size={28} /></div>
                       <h3 className="text-2xl font-black uppercase italic tracking-tight">SAL v9 Neural Auditor</h3>
                    </div>
                    {aiInsights ? (
                      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium bg-white/5 p-8 rounded-3xl border border-white/10 shadow-inner">{aiInsights}</div>
                    ) : (
                      <button onClick={handleGetAiInsights} disabled={loadingAi} className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center gap-3 shadow-xl">
                        {loadingAi ? <RefreshCw className="animate-spin" size={18} /> : <><Sparkles size={16} /> SOLICITAR ANÁLISE PREDITIVA</>}
                      </button>
                    )}
                 </div>
              </div>
              <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Registros em Lote</p>
                 <h3 className="text-7xl font-black text-slate-900 tracking-tighter">{currentState.dataset.length.toLocaleString()}</h3>
                 <div className="mt-10 flex items-center gap-3 bg-emerald-50 text-emerald-700 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <CheckCircle2 size={16} /> DATASET VERIFICADO
                 </div>
              </div>
           </div>

           {/* Tabela Principal de Auditoria (12 colunas) */}
           <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden print-report-only">
              <div className="px-12 py-8 border-b border-slate-100 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-600"><TableIcon size={22} /></div>
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">Relatório Tabular de Faturamento</h3>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(currentState.dataset);
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Controle_Impressao");
                    XLSX.writeFile(wb, `SAL_CI_${activeSubMenu}_${Date.now()}.xlsx`);
                  }} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10">
                    <FileDown size={18}/> EXPORTAR EXCEL
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10">
                    <PrinterIcon size={18}/> IMPRIMIR PDF
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-[11px] border-collapse print:text-[8pt]">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b">
                       <tr>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-center">MES</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-center">ANO</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black">RAZÃO</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-center">UL</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black">INSTALAÇÃO</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black">MEDIDOR</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-center">REG</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-center">TIPO</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black">MATR</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-center">COD</th>
                         <th className="px-6 py-5 border border-slate-100 print:border-black text-right">LEITURA</th>
                         <th className="px-6 py-5 border border-slate-100 bg-blue-50/30 font-black text-blue-900 italic">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                       {paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 border border-slate-50 text-center uppercase">{r.Mes || r.mes}</td>
                            <td className="px-6 py-4 border border-slate-50 text-center">{r.Ano || r.ano}</td>
                            <td className="px-6 py-4 border border-slate-50 font-bold text-slate-900 uppercase">{r.rz}</td>
                            <td className="px-6 py-4 border border-slate-50 text-center">{r.rz_ul_lv}</td>
                            <td className="px-6 py-4 border border-slate-50 font-mono text-blue-600">{r.instalacao}</td>
                            <td className="px-6 py-4 border border-slate-50 font-mono">{r.medidor}</td>
                            <td className="px-6 py-4 border border-slate-50 text-center">{r.reg}</td>
                            <td className="px-6 py-4 border border-slate-50 text-center uppercase">{r.tipo}</td>
                            <td className="px-6 py-4 border border-slate-50 font-bold">{r.matr}</td>
                            <td className="px-6 py-4 border border-slate-50 text-center">
                              <span className="bg-slate-100 px-2.5 py-1 rounded text-[9px] font-black">{r.nl}</span>
                            </td>
                            <td className="px-6 py-4 border border-slate-50 text-right font-black">{r.l_atual}</td>
                            <td className="px-6 py-4 border border-slate-50 font-black italic text-blue-700 bg-blue-50/20">{r[currentConfig.motivoKey]}</td>
                          </tr>
                       ))}
                       {currentState.dataset.length === 0 && (
                         <tr><td colSpan={12} className="py-24 text-center text-slate-300 font-bold uppercase tracking-widest italic">Nenhum dado encontrado para os filtros selecionados</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
              <div className="px-12 py-6 bg-slate-50 border-t flex items-center justify-between print:hidden">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentState.currentPage} de {totalPages}</span>
                <div className="flex gap-3">
                   <button onClick={() => updateCurrentState({ currentPage: Math.max(1, currentState.currentPage - 1) })} disabled={currentState.currentPage === 1} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all disabled:opacity-30"><ChevronLeft size={18}/></button>
                   <button onClick={() => updateCurrentState({ currentPage: Math.min(totalPages, currentState.currentPage + 1) })} disabled={currentState.currentPage >= totalPages} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
              </div>
           </section>

           {/* Relação Quantitativa de Faturamento */}
           <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-12 py-10 border-b border-slate-100 bg-slate-50/30 flex items-center gap-5">
                 <div className="p-4 bg-blue-600 rounded-3xl text-white shadow-xl"><Layers size={24}/></div>
                 <div>
                    <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">Relação Quantitativa Consolidada</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Grupamento por Razão Social e Motivo de Não Impressão</p>
                 </div>
              </div>
              <div className="p-10">
                 <div className="max-h-[500px] overflow-y-auto border border-slate-100 rounded-[2rem] shadow-inner">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 sticky top-0 font-black uppercase text-slate-500 z-10 border-b">
                          <tr>
                             <th className="px-10 py-6">RAZÃO SOCIAL</th>
                             <th className="px-10 py-6">NÃO IMPRESSÃO (MOTIVO)</th>
                             <th className="px-10 py-6 text-center">QUANTIDADE</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {quantitativeData.map((row, idx) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-10 py-6 font-black text-slate-900 uppercase tracking-tight">{row.rz}</td>
                                <td className="px-10 py-6 italic text-blue-600 font-bold uppercase">{row.motivo}</td>
                                <td className="px-10 py-6 text-center">
                                   <span className="bg-slate-950 text-white px-6 py-2 rounded-full font-black text-[11px] shadow-xl shadow-black/10 tracking-widest">{row.count}</span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </section>

           {/* Analytics Comparativo Final */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <section className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200">
                 <h3 className="text-sm font-black uppercase text-slate-900 mb-12 flex items-center gap-4">
                   <TrendingUp className="text-blue-600" size={22}/> Top 10 Motivos de Ocorrência
                 </h3>
                 <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData.motivo}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                          <Tooltip cursor={{fill: '#f8fafc', radius: 15}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '20px', fontSize: '11px', fontWeight: 'bold'}} />
                          <Bar dataKey="value" fill="#2563eb" radius={[12, 12, 0, 0]} barSize={50}>
                             {chartData.motivo.map((_, index) => <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />)}
                             <LabelList dataKey="value" position="top" style={{fill: '#1e293b', fontSize: '12px', fontWeight: '900'}} offset={15}/>
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </section>
              <section className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200">
                 <h3 className="text-sm font-black uppercase text-slate-900 mb-12 flex items-center gap-4">
                   <Users className="text-slate-950" size={22}/> Performance por Matrícula
                 </h3>
                 <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData.matr}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                          <Tooltip cursor={{fill: '#f8fafc', radius: 15}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '20px', fontSize: '11px', fontWeight: 'bold'}} />
                          <Bar dataKey="value" fill="#0f172a" radius={[12, 12, 0, 0]} barSize={50}>
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

      {/* Overlay de Processamento Global */}
      {loading && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 text-center border border-white/20">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Database size={40} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black uppercase text-slate-900 tracking-tight italic">Core Neural v9.0</h2>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.6em] animate-pulse">Sincronizando Matrizes de Faturamento...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
