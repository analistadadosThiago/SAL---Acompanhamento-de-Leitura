
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
  Hash, LayoutList, Activity, TrendingUp, Database,
  Calendar, Filter, RotateCcw, AlertCircle, Map, Home, Tent, AlertTriangle, ListFilter, X, Info, Check, ChevronDown
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
        <p className="font-black text-slate-900 mb-2 border-b pb-1 uppercase">{label}</p>
        <div className="space-y-1">
          <p><span className="font-bold text-slate-500 uppercase">Razão:</span> <span className="text-black">{data.razao || label}</span></p>
          <p><span className="font-bold text-slate-500 uppercase">Leit. Urb:</span> <span className="text-black">{data.leit_urb || 0}</span></p>
          <p><span className="font-bold text-slate-500 uppercase">Leit. Pov:</span> <span className="text-black">{data.leit_povoado || 0}</span></p>
          <p><span className="font-bold text-slate-500 uppercase">Leit. Rur:</span> <span className="text-black">{data.leit_rural || 0}</span></p>
          <p className="pt-1 border-t"><span className="font-bold text-slate-500 uppercase">Leit. Total:</span> <span className="text-black font-black">{data.leit_total || 0}</span></p>
          <p className="pt-1 border-t"><span className="font-bold text-red-500 uppercase">IMPEDIMENTOS:</span> <span className="text-red-700 font-black">{data.value || 0}</span></p>
          <p><span className="font-bold text-slate-500 uppercase">INDICADOR:</span> <span className="text-black font-black">{(data.indicador || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span></p>
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
        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 flex items-center justify-between text-sm text-black transition-all hover:border-slate-400"
      >
        <span className="truncate">{selected.length === 0 ? "Selecionar Mês(es)" : `${selected.length} mês(es) selecionado(s)`}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-2 space-y-1">
            <button 
              onClick={onToggleAll}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-black uppercase text-blue-600 hover:bg-slate-50 transition-colors"
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
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-slate-50'}`}>
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
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  const [options, setOptions] = useState<{ anos: string[], meses: string[], matriculas: string[] }>({
    anos: [], meses: [], matriculas: []
  });

  const [dadosTabela, setDadosTabela] = useState<TabelaData[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<GraficoData[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'completo' | 'razao'>('completo');
  const [chartDimension, setChartDimension] = useState<'ano' | 'mes' | 'razao' | 'matr' | 'tipo'>('matr');

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
      setErrorMsg("Selecione ao menos um mês para análise");
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
        const [resT, resG] = await Promise.all([
          supabase.rpc(RPC_CL_TABELA_IMPEDIMENTOS, params),
          supabase.rpc(RPC_CL_GRAFICO_IMPEDIMENTOS, params)
        ]);
        if (resT.error) throw resT.error;
        if (resG.error) throw resG.error;
        return { table: (resT.data || []) as TabelaData[], chart: (resG.data || []) as GraficoData[] };
      }));

      const rawCombinedTabela = fetchResults.flatMap(r => r.table);
      const rawCombinedGrafico = fetchResults.flatMap(r => r.chart);

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

      console.log("SAL_DEBUG: Dados Processados Controle Leiturista:", finalTabela.length);
      
      setDadosTabela(finalTabela);
      setDadosGrafico(rawCombinedGrafico);
      setHasGenerated(true);

      const alertData = finalTabela
        .filter(item => item.indicador >= 0.50)
        .sort((a, b) => b.indicador - a.indicador);

      if (alertData.length > 0) {
        setAlertItems(alertData);
        setIsAlertModalOpen(true);
      }
    } catch (err: any) {
      console.error("Erro Processar Leiturista:", err);
      setErrorMsg(err.message || "Erro no processamento.");
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
    if (!currentTableData || currentTableData.length === 0) return [];
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-red-100">
              <div className="bg-[#991b1b] p-6 flex items-center justify-between text-white">
                 <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="animate-bounce" />
                    <h2 className="text-lg font-black uppercase tracking-tighter">Resultados em Atenção!</h2>
                 </div>
                 <button onClick={() => setIsAlertModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
              </div>
              <div className="p-8">
                 <div className="overflow-y-auto max-h-[400px] border border-slate-100 rounded-2xl">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 sticky top-0"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-6 py-4">Matrícula</th><th className="px-6 py-4">Razão</th><th className="px-6 py-4 text-center">Indicador</th></tr></thead>
                       <tbody className="divide-y divide-slate-100">
                          {alertItems.slice(0, 50).map((item, idx) => (
                             <tr key={idx} className="text-xs">
                                <td className="px-6 py-4 font-bold">{item.matr}</td>
                                <td className="px-6 py-4 text-slate-600">{item.razao}</td>
                                <td className="px-6 py-4 text-center font-black text-red-700">{item.indicador.toFixed(2)}%</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 <div className="mt-8 flex justify-end"><button onClick={() => setIsAlertModalOpen(false)} className="px-8 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase">Fechar Alerta</button></div>
              </div>
           </div>
        </div>
      )}

      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-8"><div className="p-2 bg-black text-white rounded-lg"><Filter size={18}/></div><h2 className="text-sm font-bold text-black uppercase tracking-tight">Filtros Operacionais:</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase">Ano</label><select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4">{options.anos.map(a => <option key={a} value={a}>{a}</option>)}<option value="">Todos</option></select></div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase">Meses</label><MonthMultiSelect options={options.meses} selected={filterMeses} onToggle={toggleMonth} onToggleAll={toggleAllMonths} /></div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase">Matrícula</label><select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4"><option value="">Todas</option>{options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase">UL DE</label><input type="text" value={filterUlDe} onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4" /></div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase">UL PARA</label><input type="text" value={filterUlPara} onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4" /></div>
        </div>
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={handleGenerate} disabled={loading} className="px-16 py-4 bg-black text-white rounded-xl font-bold text-sm uppercase flex items-center gap-3">{loading ? <Activity className="animate-spin" size={18}/> : <Play size={16} fill="currentColor"/>} GERAR</button>
        </div>
      </section>

      {hasGenerated && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard label="Leit. Urb" value={cardTotals.urb.toLocaleString()} icon={<Home size={20}/>} color="blue" />
            <IndicatorCard label="Leit. Povoado" value={cardTotals.pov.toLocaleString()} icon={<Map size={20}/>} color="blue" />
            <IndicatorCard label="Leit. Rural" value={cardTotals.rur.toLocaleString()} icon={<Tent size={20}/>} color="blue" />
            <IndicatorCard label="Impedimentos" value={cardTotals.imp.toLocaleString()} icon={<AlertTriangle size={20}/>} color="red" />
          </div>

          <section className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap items-center justify-between">
                <div className="flex items-center gap-6">
                   <h3 className="text-xs font-black uppercase tracking-tight">Relação de Impedimentos</h3>
                   <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => { setActiveTab('completo'); setCurrentPage(1); }} className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'completo' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Geral</button>
                      <button onClick={() => { setActiveTab('razao'); setCurrentPage(1); }} className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'razao' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Por Razão</button>
                   </div>
                </div>
                <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full">{currentTableData.length} registros</span>
             </div>
             <div className="overflow-x-auto p-4">
                <table className="w-full text-[10px] border-collapse">
                   <thead className="bg-slate-100 text-black uppercase font-black tracking-wider">
                      <tr>
                         <th className="px-6 py-4 border">ANO</th><th className="px-6 py-4 border">MES</th><th className="px-6 py-4 border">RAZÃO</th>
                         {activeTab === 'completo' && <th className="px-6 py-4 border">UL</th>}<th className="px-6 py-4 border">MATR</th>
                         <th className="px-6 py-4 border">URB</th><th className="px-6 py-4 border">POV</th><th className="px-6 py-4 border">RUR</th>
                         <th className="px-6 py-4 border">TOTAL</th><th className="px-6 py-4 border">IMP</th><th className="px-6 py-4 border">INDICADOR</th>
                      </tr>
                   </thead>
                   <tbody>
                      {paginatedData.map((row, idx) => (
                         <tr key={idx} className={`${row.indicador >= 0.50 ? 'bg-[#991b1b] text-white' : row.indicador >= 0.41 ? 'bg-[#b45309] text-white' : 'bg-[#166534] text-white'} border`}>
                            <td className="px-6 py-3 border">{row.ano}</td><td className="px-6 py-3 uppercase border">{row.mes}</td><td className="px-6 py-3 border">{row.razao}</td>
                            {activeTab === 'completo' && <td className="px-6 py-3 border">{row.ul}</td>}<td className="px-6 py-3 border">{row.matr}</td>
                            <td className="px-6 py-3 border">{row.leit_urb}</td><td className="px-6 py-3 border">{row.leit_povoado}</td><td className="px-6 py-3 border">{row.leit_rural}</td>
                            <td className="px-6 py-3 border">{row.leit_total}</td><td className="px-6 py-3 border">{row.impedimentos}</td><td className="px-6 py-3 border font-black">{row.indicador.toFixed(2)}%</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             <div className="px-8 py-5 border-t flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-2">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-black text-white rounded-lg disabled:opacity-30"><ChevronLeft size={16}/></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-2 bg-black text-white rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
                </div>
             </div>
          </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-12 rounded-[40px] flex flex-col items-center gap-6">
             <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-[6px] border-slate-50 border-t-black animate-spin"></div>
                <Database size={24} className="absolute inset-0 m-auto animate-pulse" />
             </div>
             <h2 className="text-lg font-black uppercase">Sincronizando Dataset...</h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;
