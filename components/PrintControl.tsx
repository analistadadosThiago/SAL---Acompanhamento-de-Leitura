
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  MONTH_ORDER
} from '../constants';
import { 
  RotateCcw, Database, 
  ShieldAlert, ScanLine, 
  Table as TableIcon, FileDown,
  ChevronLeft, ChevronRight,
  Printer as PrinterIcon, Zap,
  Filter, ClipboardList, Target,
  Activity, CheckCircle2,
  Loader2
} from 'lucide-react';
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
}

interface PrintState {
  filterAno: string;
  filterMes: string;
  filterRz: string;
  filterMatr: string;
  technicalBase: any[]; // Tabela Técnica Oculta
  baseCarregada: boolean; 
  relatorioExecutado: boolean;
  currentPage: number;
}

const initialPrintState: PrintState = {
  filterAno: '',
  filterMes: '',
  filterRz: '',
  filterMatr: '',
  technicalBase: [],
  baseCarregada: false,
  relatorioExecutado: false,
  currentPage: 1
};

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  const [loadingBase, setLoadingBase] = useState(false);
  const [options, setOptions] = useState<FilterOptions>({ anos: [], meses: [] });
  
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

  // Extração de valores (Case-Insensitive)
  const safeExtractString = (val: any, field: string): string => {
    if (!val) return "";
    const possibleKeys = [field.toLowerCase(), field.toUpperCase(), field];
    const key = Object.keys(val).find(k => possibleKeys.includes(k));
    if (!key) {
       if (field === 'rz') return String(val.rz || val.RZ || val.razao || val.razao_social || "").trim();
       if (field === 'matr') return String(val.matr || val.MATR || val.matricula || "").trim();
    }
    return key ? String(val[key]).trim() : "";
  };

  useEffect(() => {
    const fetchBaseFilters = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        const anosList = (resAnos.data || []).map((a: any) => String(a.ano || a)).filter(Boolean).sort((a: any, b: any) => Number(b) - Number(a));
        const mesesList = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map((m: string) => ({ label: m, value: m }));
        setOptions({ anos: anosList, meses: mesesList });
      } catch (err) { console.error("Erro filtros base:", err); }
    };
    fetchBaseFilters();
  }, []);

  const updateCurrentState = (updates: Partial<PrintState>) => {
    setStates(prev => ({ ...prev, [activeSubMenu]: { ...prev[activeSubMenu], ...updates } }));
  };

  const handleSincronizarBaseTecnica = async () => {
    if (!currentState.filterAno || !currentState.filterMes) return;
    setLoadingBase(true); 
    try {
      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: currentState.filterAno, 
        p_mes: currentState.filterMes, 
        p_rz: null, 
        p_matr: null
      });
      if (error) throw error;
      updateCurrentState({ 
        technicalBase: data || [], 
        baseCarregada: true, 
        relatorioExecutado: false 
      });
    } catch (err) { 
      updateCurrentState({ baseCarregada: false, technicalBase: [] });
    } finally { 
      setLoadingBase(false); 
    }
  };

  useEffect(() => {
    if (currentState.filterAno && currentState.filterMes && !currentState.baseCarregada && !loadingBase) {
      handleSincronizarBaseTecnica();
    }
  }, [currentState.filterAno, currentState.filterMes, currentState.baseCarregada, activeSubMenu]);

  const dynamicOptions = useMemo(() => {
    const dataset = currentState.technicalBase || [];
    const razoes = Array.from(new Set(dataset.map(i => safeExtractString(i, 'rz')))).filter(Boolean).sort();
    const matriculas = Array.from(new Set(dataset.map(i => safeExtractString(i, 'matr')))).filter(Boolean).sort();
    return { razoes, matriculas };
  }, [currentState.technicalBase]);

  const handleGerarRelatorio = () => {
    if (currentState.baseCarregada) {
      updateCurrentState({ relatorioExecutado: true });
    }
  };

  const filteredData = useMemo(() => {
    return currentState.technicalBase.filter(item => {
      const matchRz = !currentState.filterRz || safeExtractString(item, 'rz') === currentState.filterRz;
      const matchMatr = !currentState.filterMatr || safeExtractString(item, 'matr') === currentState.filterMatr;
      return matchRz && matchMatr;
    });
  }, [currentState.technicalBase, currentState.filterRz, currentState.filterMatr]);

  const paginatedData = useMemo(() => {
    const start = (currentState.currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentState.currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  const metrics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const motif = String(item.motivo || item[currentConfig.motivoKey] || 'N/A');
      counts[motif] = (counts[motif] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      maxMotif: sorted.length > 0 ? sorted[0][0] : 'N/A',
      minMotif: sorted.length > 0 ? sorted[sorted.length - 1][0] : 'N/A'
    };
  }, [filteredData, currentConfig.motivoKey]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      {/* 1. TABELA TÉCNICA (OCULTA) - SUPORTE MATERIALIZAÇÃO */}
      <div id="technical-base-print" aria-hidden="true" className="hidden sr-only">
        <table>
          <thead><tr><th>RZ</th><th>MATR</th><th>RPC</th></tr></thead>
          <tbody>
            {currentState.technicalBase.slice(0, 100).map((r, i) => (
              <tr key={i}><td>{safeExtractString(r, 'rz')}</td><td>{safeExtractString(r, 'matr')}</td><td>{currentConfig.rpc}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-200 flex gap-3 print:hidden">
        {Object.entries(menuConfig).map(([key, config]) => (
          <button 
            key={key} 
            onClick={() => { setActiveSubMenu(key as PrintSubMenu); }} 
            className={`flex-1 flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
              activeSubMenu === key ? 'bg-slate-950 text-white shadow-xl' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 print:hidden relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Filter size={20} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Parâmetros Operacionais v9</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Base de Filtros</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Ano</label>
            <select 
              value={currentState.filterAno} 
              onChange={e => updateCurrentState({ filterAno: e.target.value, filterRz: '', filterMatr: '', baseCarregada: false, relatorioExecutado: false, technicalBase: [] })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
               <option value="">Selecione</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Mês</label>
            <select 
              value={currentState.filterMes} 
              onChange={e => updateCurrentState({ filterMes: e.target.value, filterRz: '', filterMatr: '', baseCarregada: false, relatorioExecutado: false, technicalBase: [] })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
               <option value="">Selecione</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">3. Razão Social</label>
            <select 
              value={currentState.filterRz} 
              onChange={e => updateCurrentState({ filterRz: e.target.value, currentPage: 1 })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer disabled:opacity-30"
              disabled={loadingBase || !currentState.baseCarregada}
            >
               <option value="">{loadingBase ? "Carregando..." : currentState.baseCarregada ? "Todas as Razões" : "Aguardando Mês/Ano..."}</option>
               {dynamicOptions.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">4. Matrícula</label>
            <select 
              value={currentState.filterMatr} 
              onChange={e => updateCurrentState({ filterMatr: e.target.value, currentPage: 1 })} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer disabled:opacity-30"
              disabled={loadingBase || !currentState.baseCarregada}
            >
               <option value="">{loadingBase ? "Carregando..." : currentState.baseCarregada ? "Todas as Matrículas" : "Aguardando Mês/Ano..."}</option>
               {dynamicOptions.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
           {loadingBase && (
              <div className="flex items-center gap-3 text-blue-600 font-bold text-[9px] uppercase animate-pulse">
                <Activity size={14} className="animate-spin"/> Materializando Base Técnica v9...
              </div>
           )}
           {currentState.baseCarregada && !loadingBase && (
              <div className="flex items-center gap-3 text-green-600 font-bold text-[9px] uppercase">
                <CheckCircle2 size={14} /> Filtros Ativados ({currentState.technicalBase.length} registros)
              </div>
           )}
           <div className="flex gap-6">
             <button 
               onClick={handleGerarRelatorio} 
               disabled={!currentState.baseCarregada || loadingBase} 
               className="px-24 py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center gap-4"
             >
                <Zap size={18} fill="currentColor" />
                GERAR RELATÓRIO
             </button>
             <button onClick={() => updateCurrentState({ ...initialPrintState })} className="px-12 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-200 transition-all">
               <RotateCcw size={16} /> REINICIAR
             </button>
           </div>
        </div>
      </section>

      {currentState.relatorioExecutado && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <IndicatorCard label="Dataset Analítico" value={filteredData.length.toLocaleString()} icon={<ClipboardList size={24}/>} color="blue" />
              <IndicatorCard label="Principal Ocorrência" value={metrics.maxMotif} icon={<Target size={24}/>} color="green" />
              <IndicatorCard label="Menor Incidência" value={metrics.minMotif} icon={<Activity size={24}/>} color="amber" />
           </div>

           <section className="bg-white rounded-[4rem] shadow-sm border border-slate-200 overflow-hidden print-report-only">
              <div className="px-12 py-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 print:hidden">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl"><TableIcon size={24} /></div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight italic">Relatório de Auditoria Materializado</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fonte: {currentConfig.label}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(filteredData);
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "SAL_CI");
                    XLSX.writeFile(wb, `SAL_CI_${activeSubMenu}.xlsx`);
                  }} className="flex items-center gap-4 px-8 py-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                    <FileDown size={20}/> EXCEL
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-4 px-8 py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                    <PrinterIcon size={20}/> IMPRIMIR
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                 <table id="main-report-table" className="w-full text-left text-[11px] border-collapse print:text-[7.5pt]">
                    <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                       <tr>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">MES</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">ANO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">RAZÃO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">UL</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">INSTALAÇÃO</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">MEDIDOR</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">REG</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black">MATR</th>
                         <th className="px-6 py-6 border-x border-slate-100 print:border-black text-center">COD</th>
                         <th className="px-6 py-6 border-x border-slate-100 text-right">LEITURA</th>
                         <th className="px-6 py-6 border-x border-slate-100 bg-blue-50/50 font-black text-blue-900 italic">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                       {paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase font-bold">{r.mes}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">{r.ano}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-bold text-slate-900 uppercase whitespace-nowrap">{safeExtractString(r, 'rz')}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">{r.rz_ul_lv}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-mono text-blue-600 font-bold">{r.instalacao}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-mono">{r.medidor}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase">{r.reg}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-bold">{safeExtractString(r, 'matr')}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">
                              <span className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-700">{r.nl}</span>
                            </td>
                            <td className="px-6 py-5 border-x border-slate-50 text-right font-black text-slate-900">{r.l_atual}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-black italic text-blue-800 bg-blue-50/20">{r.motivo || r[currentConfig.motivoKey]}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              <div className="px-12 py-8 bg-slate-50 border-t flex items-center justify-between print:hidden">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Página {currentState.currentPage} de {totalPages}</span>
                <div className="flex gap-4">
                   <button onClick={() => updateCurrentState({ currentPage: Math.max(1, currentState.currentPage - 1) })} disabled={currentState.currentPage === 1} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-600 transition-all disabled:opacity-30"><ChevronLeft size={20}/></button>
                   <button onClick={() => updateCurrentState({ currentPage: Math.min(totalPages, currentState.currentPage + 1) })} disabled={currentState.currentPage >= totalPages} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-600 transition-all disabled:opacity-30"><ChevronRight size={20}/></button>
                </div>
              </div>
           </section>
        </div>
      )}

      {loadingBase && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-6">
             <Loader2 className="animate-spin text-blue-600" size={40} />
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900">Sincronização Neural</h2>
               <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.5em] mt-3 animate-pulse">Materializando Base Técnica v9...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
