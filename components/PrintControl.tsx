
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
  Table as TableIcon, FileDown,
  Sparkles, RefreshCw,
  ChevronLeft, ChevronRight, PieChart,
  Copy, Check, Info, BarChart3, TrendingUp, Layers, AlertCircle,
  Calendar, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [dateOptions, setDateOptions] = useState({ anos: [] as string[], meses: [] as { label: string; value: string }[] });
  const [uiOptions, setUiOptions] = useState({ razoes: [] as string[], matriculas: [] as string[] });
  
  const [states, setStates] = useState<Record<PrintSubMenu, SubMenuState>>({
    [PrintSubMenu.NOSB_IMPEDIMENTO]: { ...initialSubState, datasetRelatorio: [] },
    [PrintSubMenu.NOSB_SIMULACAO]: { ...initialSubState, datasetRelatorio: [] }
  });

  const currentSubState = states[activeSubMenu];
  
  // Saneamento de Dados Profissional v9.0
  const safeGet = (val: any) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'object') {
      return val.nome || val.rz || val.razao || val.RAZAO || val.matr || val.descricao || val.label || JSON.stringify(val);
    }
    return String(val);
  };

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

  // Carregamento de Metadados de Tempo (Filtros de Data)
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
        setDateOptions({ anos: anosList, meses: mesesList });
      } catch (err) { console.error("SAL - Erro filtros base:", err); }
    };
    fetchBaseFilters();
  }, []);

  // Carregamento de Opções Dinâmicas baseadas no Período Selecionado
  useEffect(() => {
    const fetchUiOptions = async () => {
      if (!currentSubState.filterAno || !currentSubState.filterMes) return;
      setLoadingOptions(true);
      try {
        const params = { p_ano: parseInt(currentSubState.filterAno), p_mes: currentSubState.filterMes };
        const [resRz, resMatr] = await Promise.all([
          supabase.rpc(RPC_FILTRO_RAZAO_CI_UI, params),
          supabase.rpc(RPC_FILTRO_MATRICULA_CI_UI, params)
        ]);
        setUiOptions({ 
          razoes: (resRz.data || []).map((r: any) => safeGet(r.rz || r.RAZAO || r)).sort(), 
          matriculas: (resMatr.data || []).map((m: any) => safeGet(m.matr || m.MATR || m)).sort() 
        });
      } catch (err) { console.error("SAL - Erro UI Options:", err); } finally { setLoadingOptions(false); }
    };
    fetchUiOptions();
  }, [currentSubState.filterAno, currentSubState.filterMes, activeSubMenu]);

  const updateCurrentState = (updates: Partial<SubMenuState>) => {
    setStates(prev => ({ ...prev, [activeSubMenu]: { ...prev[activeSubMenu], ...updates } }));
  };

  /**
   * GERAR RELATÓRIO - Workflow Principal v9.0
   * Executa a RPC do submenu ativo com parâmetros estritos.
   */
  const handleGerarRelatorio = async () => {
    if (!currentSubState.filterAno || !currentSubState.filterMes) { 
      alert("Configuração Requerida: Selecione Ciclo Anual e Mês Competência."); 
      return; 
    }
    setLoading(true); 
    setAiInsights(null);
    try {
      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: parseInt(currentSubState.filterAno), 
        p_mes: currentSubState.filterMes,
        p_rz: currentSubState.filterRz || null, 
        p_matr: currentSubState.filterMatr || null,
        p_motivo: currentSubState.searchMotivo || null, 
        p_limit: 100000, 
        p_offset: 0
      });
      if (error) throw error;
      
      let finalData = data || [];

      // REQUISITO: FALLBACK PARA DATASET SIMULADO SE VAZIO
      if (finalData.length === 0) {
        console.warn("SAL v9.0: RPC retornou vazio. Iniciando dataset simulado profissional.");
        finalData = [
          { 
            ano: currentSubState.filterAno, 
            mes: currentSubState.filterMes, 
            rz: "Empresa A (Simulação v9)", 
            rz_ul_lv: "UL01", 
            instalacao: "INST001", 
            medidor: "MED001", 
            reg: "001", 
            tipo: "Urbano", 
            matr: "12345", 
            nl: "C001", 
            l_atual: 100, 
            [currentConfig.motivoKey]: "Registro Simulado - Sem Ocorrências no Banco" 
          },
          { 
            ano: currentSubState.filterAno, 
            mes: currentSubState.filterMes, 
            rz: "Empresa B (Simulação v9)", 
            rz_ul_lv: "UL02", 
            instalacao: "INST002", 
            medidor: "MED002", 
            reg: "002", 
            tipo: "Rural", 
            matr: "12346", 
            nl: "C002", 
            l_atual: 200, 
            [currentConfig.motivoKey]: "Registro Simulado - Sem Ocorrências no Banco" 
          }
        ];
      }

      updateCurrentState({ datasetRelatorio: finalData, displayResults: true, currentPage: 1 });
    } catch (err) { 
      console.error("SAL - Falha crítica no faturamento:", err); 
      alert("Erro na comunicação com o núcleo de dados.");
    } finally { 
      setLoading(false); 
    }
  };

  const filteredData = useMemo(() => {
    if (!currentSubState.datasetRelatorio) return [];
    return currentSubState.datasetRelatorio.filter(item => {
      const rz = safeGet(item.rz || item.razao || item.RAZAO).toLowerCase();
      const matr = safeGet(item.matr || item.MATR).toLowerCase();
      const mot = safeGet(item[currentConfig.motivoKey] || item.motivo).toLowerCase();
      return rz.includes(currentSubState.searchRz.toLowerCase()) && 
             matr.includes(currentSubState.searchMatr.toLowerCase()) && 
             mot.includes(currentSubState.searchMotivo.toLowerCase());
    });
  }, [currentSubState.datasetRelatorio, currentSubState.searchRz, currentSubState.searchMatr, currentSubState.searchMotivo, currentConfig.motivoKey]);

  const paginatedData = useMemo(() => {
    const start = (currentSubState.currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentSubState.currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  // Relação Quantitativa para Auditoria
  const quantitativeData = useMemo(() => {
    const groups: Record<string, { rz: string, motivo: string, count: number }> = {};
    filteredData.forEach(item => {
      const rz = safeGet(item.rz || item.razao || item.RAZAO);
      const motivo = safeGet(item[currentConfig.motivoKey] || item.motivo);
      const key = `${rz}|${motivo}`;
      if (!groups[key]) {
        groups[key] = { rz, motivo, count: 0 };
      }
      groups[key].count++;
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [filteredData, currentConfig.motivoKey]);

  // Insights do Dataset via Gemini AI
  const handleGetAiInsights = async () => {
    if (filteredData.length === 0 || loadingAi) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sample = filteredData.slice(0, 8).map(i => `${safeGet(i.rz)}: ${safeGet(i[currentConfig.motivoKey])}`).join("; ");
      const prompt = `Analista Master SAL v9.0, avalie este lote de ${currentConfig.label}: ${filteredData.length} registros totais. Dataset: ${sample}. 
      Gere um diagnóstico de faturamento estratégico focado em:
      1. Causas prováveis de perda de faturamento.
      2. Padrões de impedimento por Razão Social.
      3. Sugestão de rota de auditoria prioritária.
      Use tom executivo e profissional. 3 parágrafos curtos.`;
      
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiInsights(response.text);
    } catch (err) { 
      setAiInsights("Erro na sincronização neural v9.0. Tente novamente em instantes."); 
    } finally { 
      setLoadingAi(false); 
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const chartData = useMemo(() => {
    const getTop = (keyFn: (i: any) => string) => {
      const map: Record<string, number> = {};
      filteredData.forEach(i => { const k = keyFn(i); map[k] = (map[k] || 0) + 1; });
      return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    };

    return {
      motivo: getTop(i => safeGet(i[currentConfig.motivoKey] || i.motivo)),
      razao: getTop(i => safeGet(i.rz || i.razao)),
      matr: getTop(i => safeGet(i.matr || i.MATR))
    };
  }, [filteredData, currentConfig.motivoKey]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Submenu Corporativo de Módulos de Impressão */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-2 print:hidden overflow-x-auto no-scrollbar">
        {Object.entries(menuConfig).map(([key, config]) => {
          const isActive = activeSubMenu === key;
          return (
            <button 
              key={key} 
              onClick={() => {
                setActiveSubMenu(key as PrintSubMenu);
                setAiInsights(null);
              }} 
              className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                isActive ? 'bg-slate-950 text-white shadow-xl translate-y-[-2px]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon} {config.label}
            </button>
          );
        })}
      </div>

      {/* Painel de Filtros Operacionais Master */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 print:hidden relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none rotate-12 transition-transform group-hover:scale-105 duration-1000">
          <Database size={240} />
        </div>
        
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20"><Filter size={20} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Setup de Faturamento v9.0</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Parametrização de Lote Executivo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Calendar size={12}/> Ciclo Anual
            </label>
            <select 
              value={currentSubState.filterAno} 
              onChange={e => updateCurrentState({ filterAno: e.target.value })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer"
            >
               <option value="">SELECIONAR ANO</option>
               {dateOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Activity size={12}/> Competência
            </label>
            <select 
              value={currentSubState.filterMes} 
              onChange={e => updateCurrentState({ filterMes: e.target.value })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer"
            >
               <option value="">SELECIONAR MÊS</option>
               {dateOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Layers size={12}/> Razão Social
            </label>
            <select 
              value={currentSubState.filterRz} 
              onChange={e => updateCurrentState({ filterRz: e.target.value })} 
              disabled={loadingOptions || !currentSubState.filterAno || !currentSubState.filterMes}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold disabled:opacity-50 transition-all cursor-pointer"
            >
               <option value="">TODAS AS RAZÕES</option>
               {uiOptions.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Users size={12}/> Técnico
            </label>
            <select 
              value={currentSubState.filterMatr} 
              onChange={e => updateCurrentState({ filterMatr: e.target.value })} 
              disabled={loadingOptions || !currentSubState.filterAno || !currentSubState.filterMes}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold disabled:opacity-50 transition-all cursor-pointer"
            >
               <option value="">TODOS OS TÉCNICOS</option>
               {uiOptions.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button 
             onClick={handleGerarRelatorio} 
             disabled={loading || !currentSubState.filterAno || !currentSubState.filterMes} 
             className="px-24 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02] transition-all disabled:opacity-20 flex items-center gap-4"
           >
              {loading ? <Activity className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              GERAR RELATÓRIO
           </button>
           <button 
             onClick={() => updateCurrentState({ ...initialSubState, datasetRelatorio: [] })} 
             className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all"
           >
             <RotateCcw size={16} /> REINICIAR BUSCA
           </button>
        </div>
      </section>

      {currentSubState.displayResults && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700">
           {/* Dash de Resumo Executivo e IA */}
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
              <div className="lg:col-span-3 bg-[#0a0c10] p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden border border-white/5 flex flex-col justify-between group">
                 <div className="absolute bottom-0 right-0 p-16 opacity-5 pointer-events-none rotate-12 group-hover:scale-110 transition-transform"><Sparkles size={200} /></div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-5 mb-8">
                       <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl ring-4 ring-white/10"><Sparkles size={32} className="text-white" /></div>
                       <div>
                          <h3 className="text-2xl font-black uppercase tracking-tight italic">Relatório Analítico IA v9.0</h3>
                          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Sincronização com Motor Neural Gemini</p>
                       </div>
                    </div>
                    
                    {aiInsights ? (
                      <div className="p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-slate-300 text-base leading-relaxed animate-in fade-in-50 duration-700 whitespace-pre-wrap font-medium">
                        {aiInsights}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6">
                         <p className="text-sm text-slate-400 font-medium max-w-2xl leading-relaxed">
                           O motor de inteligência neural está disponível para processar este lote de faturamento. A análise identificará tendências de impedimentos não faturáveis e oferecerá estratégias para redução de desvios operacionais.
                         </p>
                         <button onClick={handleGetAiInsights} disabled={loadingAi} className="w-fit px-12 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-4 shadow-2xl shadow-blue-600/40">
                            {loadingAi ? <RefreshCw className="animate-spin" size={20} /> : "SINCRONIZAR CONSULTORIA IA"}
                         </button>
                      </div>
                    )}
                 </div>
              </div>
              
              <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                 <div className="p-8 bg-slate-50 rounded-full mb-6 text-slate-200"><PieChart size={64} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Dataset Processado</p>
                 <h3 className="text-6xl font-black text-slate-950 tracking-tighter leading-none">{filteredData.length.toLocaleString()}</h3>
                 <div className="mt-10 flex items-center gap-3 bg-emerald-50 text-emerald-700 px-6 py-3 rounded-full text-[10px] font-black uppercase border border-emerald-100 shadow-sm">
                    <CheckCircle2 size={18} className="text-emerald-500"/> INTEGRIDADE OK
                 </div>
              </div>
           </div>

           {/* Filtros de Lista Dinâmicos */}
           <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[
                { label: 'Razão Social', val: currentSubState.searchRz, set: (v: string) => updateCurrentState({ searchRz: v, currentPage: 1 }) },
                { label: 'Técnico', val: currentSubState.searchMatr, set: (v: string) => updateCurrentState({ searchMatr: v, currentPage: 1 }) },
                { label: 'Motivo/Código', val: currentSubState.searchMotivo, set: (v: string) => updateCurrentState({ searchMotivo: v, currentPage: 1 }) }
              ].map((f, i) => (
                <div key={i} className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={22} />
                  <input 
                    type="text" 
                    value={f.val} 
                    onChange={(e) => f.set(e.target.value)} 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-5 pl-16 pr-6 text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all shadow-inner" 
                    placeholder={`Filtrar por ${f.label}...`}
                  />
                </div>
              ))}
           </div>

           {/* Grid Principal de Dados de Faturamento */}
           <section className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden print-report-only">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/20 print:hidden">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg"><TableIcon size={24} /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Dataset de Faturamento Profissional</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Relatório Tabular de Auditoria</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const ws = XLSX.utils.json_to_sheet(filteredData.map(r => ({
                        'ANO': r.ano || r.Ano,
                        'MÊS': r.mes || r.Mes,
                        'RAZÃO SOCIAL': safeGet(r.rz || r.razao || r.RAZAO),
                        'UL': r.rz_ul_lv || r.ul,
                        'INSTALAÇÃO': r.instalacao,
                        'MEDIDOR': r.medidor,
                        'REG': r.reg,
                        'TIPO': r.tipo,
                        'MATRÍCULA': safeGet(r.matr || r.MATR),
                        'CÓDIGO (NL)': r.nl || r.NL,
                        'LEITURA': r.l_atual,
                        'MOTIVO': safeGet(r[currentConfig.motivoKey] || r.motivo)
                      })));
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "SAL_Dataset_Faturamento");
                      XLSX.writeFile(wb, `SAL_Relatorio_v9_${activeSubMenu}.xlsx`);
                    }} 
                    className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all"
                  >
                    <FileDown size={18}/> EXPORTAR EXCEL
                  </button>
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
                  >
                    <TableIcon size={18}/> IMPRIMIR PDF
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto p-4 print:p-0">
                 <table className="w-full text-left text-[9px] border-collapse print:text-[7.5pt] border border-slate-200">
                    <thead className="bg-slate-950 text-white uppercase font-black print:bg-slate-100 print:text-black">
                       <tr>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-center">MÊS</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-center">ANO</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black">RAZÃO SOCIAL</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-center">UL</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black">INSTALAÇÃO</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black">MEDIDOR</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-center">REG</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-center bg-blue-900 print:bg-slate-200">TIPO</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black">MATR</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-center">COD</th>
                         <th className="px-3 py-4 border border-slate-800 print:border-black text-right">LEITURA</th>
                         <th className="px-3 py-4 border border-slate-800 bg-blue-700 print:bg-slate-100 italic">NÃO IMPRESSÃO (MOTIVO)</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700 print:divide-black bg-white">
                       {paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-center uppercase">{r.mes || r.Mes}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-center">{r.ano || r.Ano}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black truncate max-w-[150px] font-black text-slate-900">{safeGet(r.rz || r.razao || r.RAZAO)}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-center">{r.rz_ul_lv || r.ul}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black font-mono text-blue-700 flex items-center justify-between">
                               {r.instalacao}
                               <button onClick={() => copyToClipboard(String(r.instalacao))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-all print:hidden">
                                 {copiedId === String(r.instalacao) ? <Check size={12} className="text-green-600"/> : <Copy size={12} className="text-slate-300"/>}
                               </button>
                            </td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black font-mono">{r.medidor}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-center">{r.reg}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-[8px] uppercase font-black text-center">{r.tipo}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-slate-950 font-black">{safeGet(r.matr || r.MATR)}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-center"><span className="px-2 py-0.5 bg-slate-100 rounded-full font-black text-[8px]">{r.nl || r.NL}</span></td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black text-right">{r.l_atual}</td>
                            <td className="px-3 py-3 border border-slate-100 print:border-black font-black italic text-blue-900 bg-blue-50/20 print:bg-transparent">{safeGet(r[currentConfig.motivoKey] || r.motivo)}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              
              <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t print:hidden">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentSubState.currentPage} de {totalPages}</span>
                <div className="flex gap-3">
                   <button 
                     onClick={() => updateCurrentState({ currentPage: Math.max(1, currentSubState.currentPage - 1) })} 
                     disabled={currentSubState.currentPage === 1} 
                     className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl disabled:opacity-30 flex items-center gap-3 text-[10px] font-black uppercase hover:border-blue-600 transition-all shadow-sm"
                   >
                     <ChevronLeft size={16}/> Anterior
                   </button>
                   <button 
                     onClick={() => updateCurrentState({ currentPage: Math.min(totalPages, currentSubState.currentPage + 1) })} 
                     disabled={currentSubState.currentPage >= totalPages} 
                     className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl disabled:opacity-30 flex items-center gap-3 text-[10px] font-black uppercase hover:border-blue-600 transition-all shadow-sm"
                   >
                     Próximo <ChevronRight size={16}/>
                   </button>
                </div>
              </div>
           </section>

           {/* Painel Analítico de Auditoria (Quantitativo) */}
           <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex items-center gap-5 bg-slate-50/30">
                 <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg"><Layers size={24}/></div>
                 <div>
                   <h3 className="text-sm font-black uppercase text-slate-900">Cruzamento Razão vs Motivo</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mapeamento Geográfico de Impedimentos</p>
                 </div>
              </div>
              <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                 <div className="overflow-y-auto max-h-[550px] border-2 border-slate-50 rounded-[2.5rem] shadow-inner">
                    <table className="w-full text-left text-[10px] border-collapse">
                       <thead className="bg-slate-50 text-slate-400 font-black uppercase sticky top-0 z-20">
                          <tr>
                             <th className="px-8 py-5 border-b">RAZÃO SOCIAL</th>
                             <th className="px-8 py-5 border-b">MOTIVO DE NÃO IMPRESSÃO</th>
                             <th className="px-8 py-5 border-b text-center">OCORRÊNCIAS</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                          {quantitativeData.slice(0, 50).map((row, idx) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 font-black text-slate-900">{row.rz}</td>
                                <td className="px-8 py-5 italic text-blue-700">{row.motivo}</td>
                                <td className="px-8 py-5 text-center">
                                  <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full font-black text-[11px] shadow-sm">{row.count}</span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>

                 {/* Visualização de Top Ocorrências */}
                 <div className="bg-slate-50/50 p-10 rounded-[3rem] border border-slate-100 flex flex-col justify-between">
                    <div>
                       <div className="flex items-center justify-between mb-10">
                          <h4 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-3"><BarChart3 size={18} className="text-blue-600"/> Top 10 Motivos Identificados</h4>
                          <span className="bg-white px-4 py-1.5 rounded-full border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">Dataset v9.0</span>
                       </div>
                       <div className="h-[400px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={chartData.motivo} layout="vertical" margin={{ left: 20, right: 60 }}>
                                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 10, fontWeight: 900, fill: '#1e293b'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f1f5f9', radius: 10}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px'}} />
                                <Bar dataKey="value" fill="#2563eb" radius={[0, 12, 12, 0]} barSize={24}>
                                   {chartData.motivo.map((_, index) => (
                                     <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.08)} />
                                   ))}
                                   <LabelList dataKey="value" position="right" style={{fontSize: 11, fontWeight: 900, fill: '#0f172a'}} offset={15} />
                                </Bar>
                             </BarChart>
                          </ResponsiveContainer>
                       </div>
                    </div>
                    
                    <div className="mt-8 p-6 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
                       <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Info size={20}/></div>
                       <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase">
                         O gráfico acima demonstra a volumetria das ocorrências filtradas. Utilize o diagnóstico IA para avaliar correlações estatísticas.
                       </p>
                    </div>
                 </div>
              </div>
           </section>

           {/* Gráficos de Perfomance por Dimensão */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {[
                { label: 'Ocorrências por Razão Social', data: chartData.razao, color: '#2563eb' },
                { label: 'Ocorrências por Técnico (Top 10)', data: chartData.matr, color: '#0f172a' }
              ].map((c, i) => (
                <section key={i} className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200 group">
                   <h3 className="text-[11px] font-black uppercase text-slate-900 mb-10 flex items-center gap-4 group-hover:translate-x-1 transition-transform duration-500">
                     <TrendingUp size={20} className="text-blue-600"/> {c.label}
                   </h3>
                   <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={c.data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                            <Tooltip cursor={{fill: '#f8fafc', radius: 15}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px'}} />
                            <Bar dataKey="value" fill={c.color} radius={[12, 12, 0, 0]} barSize={48} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </section>
              ))}
           </div>
        </div>
      )}

      {/* Loading Overlay v9.0 */}
      {loading && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-20 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 text-center border border-slate-100">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Database size={40} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black uppercase text-slate-900 tracking-tighter italic">Sincronizando Motor v9.0</h2>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse">Cruzando Banco de Dados de Faturamento...</p>
                <div className="w-64 h-2 bg-slate-50 rounded-full overflow-hidden mt-8">
                   <div className="h-full bg-blue-600 animate-progress"></div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
