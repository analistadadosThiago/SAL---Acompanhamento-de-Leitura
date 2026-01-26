
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CL_TABELA_IMPEDIMENTOS,
  RPC_CL_GRAFICO_IMPEDIMENTOS,
  RPC_CL_FILTROS,
  MONTH_ORDER 
} from '../constants';
import { 
  Users, Play, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, 
  LayoutList, Activity, Database,
  Calendar, Filter, RotateCcw, AlertTriangle, X, Check, ChevronDown, BarChart3, Home, Map, Tent
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import IndicatorCard from './IndicatorCard';

interface TabelaData {
  ano: number;
  mes: string;
  razao: string;
  ul: string | number;
  matr: string;
  leit_urb: number;
  leit_povoado: number;
  leit_rural: number;
  leit_total: number;
  impedimentos: number;
  indicador: number;
  tipo?: string;
}

interface GraficoData {
  matr: string;
  impedimentos: number;
  razao?: string;
  mes?: string;
  ano?: number;
  tipo?: string;
}

const ITEMS_PER_PAGE = 20;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-100 text-[11px]">
        <p className="font-black text-slate-900 mb-2 border-b pb-1 uppercase">{data.groupLabel}: {label}</p>
        <div className="space-y-1">
          {data.razao && data.groupKey !== 'razao' && <p><span className="font-bold text-slate-500 uppercase">Razão:</span> <span className="text-black">{data.razao}</span></p>}
          <p className="pt-1 border-t"><span className="font-bold text-red-500 uppercase">IMPEDIMENTOS:</span> <span className="text-red-700 font-black">{data.impedimentos || 0}</span></p>
          {data.indicador !== undefined && <p><span className="font-bold text-slate-500 uppercase">INDICADOR MÉDIO:</span> <span className="text-black font-black">{(data.indicador || 0).toFixed(2)}%</span></p>}
        </div>
      </div>
    );
  }
  return null;
};

const MonthMultiSelect: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  onToggleAll: () => void;
}> = ({ options, selected, onToggle, onToggleAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = selected.length === options.length && options.length > 0;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 border-2 rounded-xl py-3 px-4 flex items-center justify-between text-sm transition-all ${isOpen ? 'border-blue-600 bg-white ring-4 ring-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
      >
        <span className="truncate font-bold text-slate-700 uppercase tracking-tight">
          {selected.length === 0 ? "Selecionar Mês(es)" : `${selected.length} mês(es) selecionado(s)`}
        </span>
        <ChevronDown size={16} className={`transition-transform text-slate-400 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200 custom-scrollbar">
          <div className="p-2 space-y-1">
            <button 
              onClick={onToggleAll}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 transition-colors"
            >
              {allSelected ? "Desmarcar Todos" : "Selecionar Todos"}
            </button>
            <div className="h-px bg-slate-100 my-1" />
            {options.map((opt) => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${isSel ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="uppercase">{opt}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSel ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
                    {isSel && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const LeituristaControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  const [options, setOptions] = useState<{ anos: string[], meses: string[], matriculas: string[] }>({
    anos: [], meses: [], matriculas: []
  });

  const [dadosTabela, setDadosTabela] = useState<TabelaData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'completo' | 'razao'>('completo');
  const [chartGrouping, setChartGrouping] = useState<'matr' | 'razao' | 'mes'>('matr');

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertItems, setAlertItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const { data: res, error } = await supabase.rpc(RPC_CL_FILTROS);
        if (error) throw error;
        const filterData = Array.isArray(res) ? res[0] : res;
        if (filterData) {
          setOptions({
            anos: (filterData.anos || []).map(String),
            meses: (filterData.meses || []).map(String).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)),
            matriculas: (filterData.matriculas || []).map(String).sort()
          });
        }
      } catch (err: any) {
        console.error("Erro filters:", err);
      }
    };
    fetchOptions();
  }, []);

  const handleGenerate = async () => {
    if (loading) return;
    if (filterMeses.length === 0) {
      setErrorMsg("Selecione ao menos um mês para análise.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setCurrentPage(1);
    setIsAlertModalOpen(false);

    try {
      const fetchResults = await Promise.all(filterMeses.map(async (m) => {
        const params = {
          p_ano: filterAno === '' ? null : parseInt(filterAno),
          p_mes: m,
          p_matr: filterMatr === '' ? null : filterMatr,
          p_ul_de: filterUlDe === '' ? null : parseInt(filterUlDe),
          p_ul_para: filterUlPara === '' ? null : parseInt(filterUlPara)
        };
        const resT = await supabase.rpc(RPC_CL_TABELA_IMPEDIMENTOS, params);
        if (resT.error) throw resT.error;
        return (resT.data || []) as TabelaData[];
      }));

      const rawCombinedTabela = fetchResults.flat();
      const groupedMap: Record<string, TabelaData> = {};
      
      rawCombinedTabela.forEach(item => {
        const key = `${item.ano}|${item.mes}|${item.razao}|${item.ul}|${item.matr}`;
        if (!groupedMap[key]) {
          groupedMap[key] = { ...item };
        } else {
          groupedMap[key].leit_urb += Number(item.leit_urb) || 0;
          groupedMap[key].leit_povoado += Number(item.leit_povoado) || 0;
          groupedMap[key].leit_rural += Number(item.leit_rural) || 0;
          groupedMap[key].leit_total += Number(item.leit_total) || 0;
          groupedMap[key].impedimentos += Number(item.impedimentos) || 0;
        }
      });

      const finalTabela = Object.values(groupedMap).map(item => ({
        ...item,
        indicador: (item.impedimentos / (item.leit_total || 1)) * 100
      }));

      setDadosTabela(finalTabela);
      setHasGenerated(true);

      const alertData = finalTabela
        .filter(item => item.indicador >= 50)
        .sort((a, b) => b.indicador - a.indicador);

      if (alertData.length > 0) {
        setAlertItems(alertData);
        setIsAlertModalOpen(true);
      }
    } catch (err: any) {
      console.error("Erro Processar Leiturista:", err);
      setErrorMsg(err.message || "Erro no processamento de dados.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (val: string) => {
    setFilterMeses(prev => prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]);
  };

  const toggleAllMonths = () => {
    if (filterMeses.length === options.meses.length) setFilterMeses([]);
    else setFilterMeses([...options.meses]);
  };

  const sortedDadosTabela = useMemo(() => {
    return [...dadosTabela].sort((a, b) => b.indicador - a.indicador);
  }, [dadosTabela]);

  const dadosPorRazao = useMemo(() => {
    const grouped: Record<string, TabelaData> = {};
    dadosTabela.forEach(item => {
      const key = `${item.razao}|${item.matr}`;
      if (!grouped[key]) {
        grouped[key] = { ...item, leit_urb: 0, leit_povoado: 0, leit_rural: 0, leit_total: 0, impedimentos: 0, indicador: 0 };
      }
      grouped[key].leit_urb += Number(item.leit_urb) || 0;
      grouped[key].leit_povoado += Number(item.leit_povoado) || 0;
      grouped[key].leit_rural += Number(item.leit_rural) || 0;
      grouped[key].leit_total += Number(item.leit_total) || 0;
      grouped[key].impedimentos += Number(item.impedimentos) || 0;
    });

    return Object.values(grouped)
      .map(item => ({ ...item, indicador: (item.impedimentos / (item.leit_total || 1)) * 100 }))
      .sort((a, b) => b.indicador - a.indicador);
  }, [dadosTabela]);

  const currentTableData = useMemo(() => (activeTab === 'completo' ? sortedDadosTabela : dadosPorRazao), [activeTab, sortedDadosTabela, dadosPorRazao]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTableData.slice(start, start + ITEMS_PER_PAGE);
  }, [currentTableData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(currentTableData.length / ITEMS_PER_PAGE));

  const cardTotals = useMemo(() => {
    return dadosTabela.reduce((acc, row) => ({
      urb: acc.urb + (Number(row.leit_urb) || 0),
      pov: acc.pov + (Number(row.leit_povoado) || 0),
      rur: acc.rur + (Number(row.leit_rural) || 0),
      imp: acc.imp + (Number(row.impedimentos) || 0)
    }), { urb: 0, pov: 0, rur: 0, imp: 0 });
  }, [dadosTabela]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { key: string, impedimentos: number, indicatorSum: number, count: number }> = {};
    
    dadosTabela.forEach(item => {
      let groupKey = '';
      if (chartGrouping === 'matr') groupKey = item.matr;
      else if (chartGrouping === 'razao') groupKey = item.razao;
      else if (chartGrouping === 'mes') groupKey = item.mes;

      if (!grouped[groupKey]) {
        grouped[groupKey] = { 
          key: groupKey, 
          impedimentos: item.impedimentos, 
          indicatorSum: item.indicador,
          count: 1
        };
      } else {
        grouped[groupKey].impedimentos += item.impedimentos;
        grouped[groupKey].indicatorSum += item.indicador;
        grouped[groupKey].count += 1;
      }
    });

    return Object.values(grouped)
      .map(g => ({
        name: g.key,
        impedimentos: g.impedimentos,
        indicador: g.indicatorSum / g.count,
        groupKey: chartGrouping,
        groupLabel: chartGrouping === 'matr' ? 'Matrícula' : chartGrouping === 'razao' ? 'Razão' : 'Mês'
      }))
      .sort((a, b) => b.impedimentos - a.impedimentos)
      .slice(0, 15);
  }, [dadosTabela, chartGrouping]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative pb-20">
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-red-100 animate-in zoom-in-95 duration-200">
              <div className="bg-[#991b1b] p-6 flex items-center justify-between text-white">
                 <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="animate-bounce" />
                    <h2 className="text-lg font-black uppercase tracking-tighter italic">Resultados Críticos Detectados</h2>
                 </div>
                 <button onClick={() => setIsAlertModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <div className="p-8">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Lista de técnicos com impedimento superior a 50%:</p>
                 <div className="overflow-y-auto max-h-[400px] border border-slate-100 rounded-2xl custom-scrollbar">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 sticky top-0"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-6 py-4">Matrícula</th><th className="px-6 py-4">Razão</th><th className="px-6 py-4 text-center">Indicador</th></tr></thead>
                       <tbody className="divide-y divide-slate-100">
                          {alertItems.slice(0, 50).map((item, idx) => (
                             <tr key={idx} className="text-xs hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-black">{item.matr}</td>
                                <td className="px-6 py-4 text-slate-600 truncate max-w-[150px]">{item.razao}</td>
                                <td className="px-6 py-4 text-center font-black text-red-700">{item.indicador.toFixed(2)}%</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 <div className="mt-8 flex justify-end"><button onClick={() => setIsAlertModalOpen(false)} className="px-8 py-3 bg-slate-950 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all">Fechar Alerta</button></div>
              </div>
           </div>
        </div>
      )}

      <section className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Filter size={20}/></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Parâmetros Operacionais</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Dataset V9.0</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ano</label>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-blue-600 outline-none transition-all">
              <option value="">Todos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Meses</label>
            <MonthMultiSelect options={options.meses} selected={filterMeses} onToggle={toggleMonth} onToggleAll={toggleAllMonths} />
          </div>
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Matrícula</label>
            <select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-blue-600 outline-none transition-all">
              <option value="">Todas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL Inicial</label>
            <input 
              type="text" 
              value={filterUlDe} 
              placeholder="0"
              maxLength={8}
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-black focus:border-blue-600 outline-none transition-all" 
            />
          </div>
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL Final</label>
            <input 
              type="text" 
              value={filterUlPara} 
              placeholder="99999"
              maxLength={8}
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-black focus:border-blue-600 outline-none transition-all" 
            />
          </div>
        </div>
        <div className="mt-12 flex justify-center gap-4">
          <button onClick={handleGenerate} disabled={loading} className="px-20 py-5 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-20">
            {loading ? <Activity className="animate-spin" size={20}/> : <Play size={18} fill="currentColor"/>} SINCRONIZAR DADOS
          </button>
        </div>
        {errorMsg && <p className="mt-6 text-center text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-50 p-3 rounded-xl border border-red-100">{errorMsg}</p>}
      </section>

      {hasGenerated && (
        <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Leit. Urbana" value={cardTotals.urb.toLocaleString()} icon={<Home size={20}/>} color="blue" />
            <IndicatorCard label="Leit. Povoado" value={cardTotals.pov.toLocaleString()} icon={<Map size={20}/>} color="blue" />
            <IndicatorCard label="Leit. Rural" value={cardTotals.rur.toLocaleString()} icon={<Tent size={20}/>} color="blue" />
            <IndicatorCard label="Impedimentos" value={cardTotals.imp.toLocaleString()} icon={<AlertTriangle size={20}/>} color="red" />
          </div>

          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-10 py-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
                <div className="flex flex-wrap items-center gap-6">
                   <h3 className="text-sm font-black uppercase text-slate-900 tracking-tighter italic">
                      Matriz de Performance Técnica
                   </h3>
                   <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                      <button onClick={() => { setActiveTab('completo'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'completo' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Geral</button>
                      <button onClick={() => { setActiveTab('razao'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'razao' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Por Razão</button>
                   </div>
                </div>
                
                <div className="flex items-center gap-3">
                   <button onClick={() => {
                     const dataToExport = currentTableData.map(row => ({
                       "ANO": row.ano, "MÊS": row.mes.toUpperCase(), "RAZÃO SOCIAL": row.razao, "UL": row.ul, "MATRÍCULA": row.matr,
                       "TOTAL": row.leit_total, "IMP": row.impedimentos, "INDICADOR (%)": `${row.indicador.toFixed(2)}%`
                     }));
                     const ws = XLSX.utils.json_to_sheet(dataToExport);
                     const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "SAL_Relatorio");
                     XLSX.writeFile(wb, "SAL_Relatorio_Leiturista.xlsx");
                   }} className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">
                     <FileSpreadsheet size={16} /> EXCEL
                   </button>
                   <span className="text-[10px] font-black bg-slate-100 px-4 py-2 rounded-full uppercase text-slate-500 tracking-widest">{currentTableData.length} Registros</span>
                </div>
             </div>
             <div className="overflow-x-auto p-10">
                <table className="w-full text-[11px] border-collapse">
                   <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                      <tr>
                         <th className="px-6 py-5 border-x border-slate-100 text-center">ANO</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-center">MES</th>
                         <th className="px-6 py-5 border-x border-slate-100">RAZÃO SOCIAL</th>
                         {activeTab === 'completo' && <th className="px-6 py-5 border-x border-slate-100 text-center">UL</th>}
                         <th className="px-6 py-5 border-x border-slate-100">MATR</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-center">TOTAL</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-center">IMP</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-right font-black">INDICADOR</th>
                      </tr>
                   </thead>
                   <tbody>
                      {paginatedData.map((row, idx) => (
                         <tr key={idx} className={`${row.indicador >= 50 ? 'bg-[#991b1b] text-white' : row.indicador >= 41 ? 'bg-[#b45309] text-white' : 'bg-[#166534] text-white'} border-b border-white/10 hover:brightness-110 transition-all`}>
                            <td className="px-6 py-4 text-center border-x border-white/5">{row.ano}</td>
                            <td className="px-6 py-4 uppercase text-center border-x border-white/5 font-bold">{row.mes}</td>
                            <td className="px-6 py-4 border-x border-white/5 font-black uppercase truncate max-w-[200px]">{row.razao}</td>
                            {activeTab === 'completo' && <td className="px-6 py-4 text-center border-x border-white/5 font-mono">{row.ul}</td>}
                            <td className="px-6 py-4 border-x border-white/5 font-bold">{row.matr}</td>
                            <td className="px-6 py-4 text-center border-x border-white/5 font-bold">{row.leit_total}</td>
                            <td className="px-6 py-4 text-center border-x border-white/5 font-bold">{row.impedimentos}</td>
                            <td className="px-6 py-4 text-right border-x border-white/5 font-black text-[13px] italic">{row.indicador.toFixed(2)}%</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             <div className="px-10 py-6 border-t flex items-center justify-between bg-slate-50/50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-4">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-600 transition-all disabled:opacity-30"><ChevronLeft size={18}/></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-600 transition-all disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
             </div>
          </section>

          <section className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                <div className="flex items-center gap-4">
                   <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-sm"><BarChart3 size={24} /></div>
                   <div>
                      <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight italic leading-none">Análise Gráfica de Impedimentos</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Módulo de Visualização Neural</p>
                   </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                   <button onClick={() => setChartGrouping('matr')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartGrouping === 'matr' ? 'bg-white text-blue-600 shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}>Matr</button>
                   <button onClick={() => setChartGrouping('razao')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartGrouping === 'razao' ? 'bg-white text-blue-600 shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}>Razão</button>
                   <button onClick={() => setChartGrouping('mes')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartGrouping === 'mes' ? 'bg-white text-blue-600 shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}>Mês</button>
                </div>
             </div>

             <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc', radius: 12}} />
                      <Bar dataKey="impedimentos" name="Impedimentos" barSize={44} radius={[12, 12, 0, 0]}>
                         {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.indicador >= 50 ? '#991b1b' : entry.indicador >= 41 ? '#d97706' : '#2563eb'} />
                         ))}
                         <LabelList dataKey="impedimentos" position="top" style={{ fill: '#0f172a', fontSize: '11px', fontWeight: '900' }} offset={15} />
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-16 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8 border border-slate-100">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-50 border-t-blue-600 animate-spin"></div>
                <Database size={32} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Processamento de Matriz</h2>
               <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.5em] mt-3 animate-pulse">Sincronizando Core v9.0...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;
