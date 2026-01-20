
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
          <p><span className="font-bold text-red-500 uppercase">IMPEDIMENTOS:</span> <span className="text-red-700 font-black">{data.value || 0}</span></p>
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
  const [filterMes, setFilterMes] = useState<string[]>([]);
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

  const validateUlInput = (val: string) => val.replace(/\D/g, '').slice(0, 8);

  const calculateCorrectedIndicator = (imp: number, total: number) => {
    if (!total || total === 0) return 0;
    return (imp / total) * 100;
  };

  const formatPercent = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  };

  const toggleMonth = (val: string) => {
    setFilterMes(prev => prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]);
  };

  const toggleAllMonths = () => {
    if (filterMes.length === options.meses.length) setFilterMes([]);
    else setFilterMes([...options.meses]);
  };

  const handleGenerate = async () => {
    if (loading) return;
    if (filterMes.length === 0) {
      setErrorMsg("Selecione ao menos um mês para análise");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setHasGenerated(false);
    setCurrentPage(1);
    setIsAlertModalOpen(false);

    try {
      // EXECUÇÃO INDIVIDUAL POR MÊS conforme regra
      const fetchResults = await Promise.all(filterMes.map(async (m) => {
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

      // AGRUPAMENTO NO FRONTEND: ANO, MES, RAZAO, UL, MATR
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

      // Recalcular indicadores após agrupamento
      const finalTabela = Object.values(groupedMap).map(item => ({
        ...item,
        indicador: calculateCorrectedIndicator(item.impedimentos, item.leit_total)
      }));

      // LÓGICA DE ALERTA BASEADA NO RELATÓRIO POR RAZÃO (Agrupamento Matricula + Razão)
      const groupedByReason: Record<string, any> = {};
      finalTabela.forEach(item => {
        const key = `${item.razao}|${item.matr}`;
        if (!groupedByReason[key]) {
          groupedByReason[key] = { razao: item.razao, matr: item.matr, leit_total: 0, impedimentos: 0 };
        }
        groupedByReason[key].leit_total += Number(item.leit_total) || 0;
        groupedByReason[key].impedimentos += Number(item.impedimentos) || 0;
      });

      const alertData = Object.values(groupedByReason)
        .map(item => ({
          ...item,
          indicador: (item.impedimentos / (item.leit_total || 1)) * 100
        }))
        .filter(item => item.indicador >= 0.50)
        .sort((a, b) => b.indicador - a.indicador);

      if (alertData.length > 0) {
        setAlertItems(alertData);
        setIsAlertModalOpen(true);
      }

      setDadosTabela(finalTabela);
      setDadosGrafico(rawCombinedGrafico);
      setHasGenerated(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro no processamento.");
      setDadosTabela([]);
      setDadosGrafico([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilterAno('');
    setFilterMes([]);
    setFilterMatr('');
    setFilterUlDe('');
    setFilterUlPara('');
    setDadosTabela([]);
    setDadosGrafico([]);
    setHasGenerated(false);
    setErrorMsg(null);
  };

  const getRowStyles = (indicador: number) => {
    if (indicador >= 0.50) return 'bg-[#991b1b] text-white font-bold'; // VERMELHO ESCURO
    if (indicador >= 0.41) return 'bg-[#b45309] text-white'; // AMARELO ESCURO (Amber 700ish)
    return 'bg-[#166534] text-white'; // VERDE ESCURO
  };

  const sortedDadosTabela = useMemo(() => {
    return [...dadosTabela].sort((a, b) => b.indicador - a.indicador);
  }, [dadosTabela]);

  const dadosPorRazao = useMemo(() => {
    const grouped: Record<string, TabelaData> = {};
    dadosTabela.forEach(item => {
      const key = `${item.razao}|${item.matr}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...item,
          leit_urb: 0,
          leit_povoado: 0,
          leit_rural: 0,
          leit_total: 0,
          impedimentos: 0,
          indicador: 0
        };
      }
      grouped[key].leit_urb += Number(item.leit_urb) || 0;
      grouped[key].leit_povoado += Number(item.leit_povoado) || 0;
      grouped[key].leit_rural += Number(item.leit_rural) || 0;
      grouped[key].leit_total += Number(item.leit_total) || 0;
      grouped[key].impedimentos += Number(item.impedimentos) || 0;
    });

    return Object.values(grouped)
      .map(item => ({
        ...item,
        indicador: calculateCorrectedIndicator(item.impedimentos, item.leit_total)
      }))
      .sort((a, b) => b.indicador - a.indicador);
  }, [dadosTabela]);

  const currentTableData = activeTab === 'completo' ? sortedDadosTabela : dadosPorRazao;

  const totalPages = Math.ceil(currentTableData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTableData.slice(start, start + ITEMS_PER_PAGE);
  }, [currentTableData, currentPage]);

  const cardTotals = useMemo(() => {
    return dadosTabela.reduce((acc, row) => ({
      urb: acc.urb + (Number(row.leit_urb) || 0),
      pov: acc.pov + (Number(row.leit_povoado) || 0),
      rur: acc.rur + (Number(row.leit_rural) || 0),
      imp: acc.imp + (Number(row.impedimentos) || 0)
    }), { urb: 0, pov: 0, rur: 0, imp: 0 });
  }, [dadosTabela]);

  const processedChartData = useMemo(() => {
    if (dadosTabela.length === 0) return [];

    const grouped: Record<string, any> = {};
    dadosTabela.forEach(item => {
      let key = '';
      switch (chartDimension) {
        case 'ano': key = String(item.ano); break;
        case 'mes': key = String(item.mes); break;
        case 'razao': key = String(item.razao); break;
        case 'matr': key = String(item.matr); break;
        case 'tipo': key = item.tipo || (item.leit_urb > 0 ? 'Urbano' : item.leit_povoado > 0 ? 'Povoado' : 'Rural'); break;
        default: key = String(item.matr);
      }
      if (!grouped[key]) {
        grouped[key] = { label: key, value: 0, leit_urb: 0, leit_povoado: 0, leit_rural: 0, leit_total: 0, razao: key, indicador: 0 };
      }
      grouped[key].value += (Number(item.impedimentos) || 0);
      grouped[key].leit_urb += (Number(item.leit_urb) || 0);
      grouped[key].leit_povoado += (Number(item.leit_povoado) || 0);
      grouped[key].leit_rural += (Number(item.leit_rural) || 0);
      grouped[key].leit_total += (Number(item.leit_total) || 0);
    });

    return Object.values(grouped)
      .map(item => ({
        ...item,
        indicador: calculateCorrectedIndicator(item.value, item.leit_total)
      }))
      .sort((a, b) => b.value - a.value); // Ordenado por Impedimentos Decrescente
  }, [dadosTabela, chartDimension]);

  const exportExcel = () => {
    if (currentTableData.length === 0) return;
    const exportRows = currentTableData.map(r => ({
      'ANO': r.ano,
      'MÊS': r.mes,
      'RAZÃO': r.razao,
      ...(activeTab === 'completo' ? { 'UL': r.ul } : {}),
      'MATR': r.matr,
      'Leit. Urb': r.leit_urb,
      'Leit. Povoado': r.leit_povoado,
      'Leit. Rural': r.leit_rural,
      'Leit. Total': r.leit_total,
      'IMPEDIMENTOS': r.impedimentos,
      'INDICADOR': formatPercent(calculateCorrectedIndicator(r.impedimentos, r.leit_total))
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Impedimentos");
    XLSX.writeFile(wb, `SAL_Controle_Leiturista_${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    if (currentTableData.length === 0) return;
    const doc = new jsPDF('landscape');
    autoTable(doc, {
      head: activeTab === 'completo' 
        ? [['ANO', 'MES', 'RAZÃO', 'UL', 'MATR', 'URB', 'POV', 'RUR', 'TOTAL', 'IMP', 'INFM']]
        : [['ANO', 'MES', 'RAZÃO', 'MATR', 'URB', 'POV', 'RUR', 'TOTAL', 'IMP', 'INFM']],
      body: currentTableData.map(r => [
        r.ano, r.mes, r.razao, 
        ...(activeTab === 'completo' ? [r.ul] : []),
        r.matr, 
        r.leit_urb, r.leit_povoado, r.leit_rural, 
        r.leit_total, r.impedimentos, 
        formatPercent(calculateCorrectedIndicator(r.impedimentos, r.leit_total))
      ]),
      theme: 'grid',
      styles: { fontSize: 7, halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
    });
    doc.save(`SAL_Relatorio_Leiturista_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      
      {/* MODAL DE ALERTA (CUIDADO) */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-red-100 animate-in zoom-in-95 duration-300">
              <div className="bg-[#991b1b] p-6 flex items-center justify-between text-white">
                 <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="animate-bounce" />
                    <h2 className="text-lg font-black uppercase tracking-tighter">CUIDADO com os seguintes resultados!</h2>
                 </div>
                 <button onClick={() => setIsAlertModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-8">
                 <div className="overflow-y-auto max-h-[400px] border border-slate-100 rounded-2xl">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 sticky top-0">
                          <tr className="text-[10px] font-black uppercase text-slate-400">
                             <th className="px-6 py-4 border-r border-slate-200">Matrícula</th>
                             <th className="px-6 py-4 border-r border-slate-200">Razão</th>
                             <th className="px-6 py-4 text-center">Indicador (%)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {alertItems.map((item, idx) => (
                             <tr key={idx} className="text-xs">
                                <td className="px-6 py-4 font-bold text-black border-r border-slate-200">{item.matr}</td>
                                <td className="px-6 py-4 text-slate-600 border-r border-slate-200">{item.razao}</td>
                                <td className="px-6 py-4 text-center font-black text-red-700">
                                   {formatPercent(item.indicador)}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 <div className="mt-8 flex justify-end">
                    <button 
                       onClick={() => setIsAlertModalOpen(false)}
                       className="px-8 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                    >
                       Fechar Alerta
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* FILTER PANEL */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 no-print">
        <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-wrap items-center gap-x-8 gap-y-2">
           <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Ano</span><span className="text-xs font-bold text-black">{filterAno || 'Todos'}</span></div>
           <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Mês selecionado(s)</span>
              <span className="text-xs font-bold text-black uppercase">{filterMes.length > 0 ? filterMes.join(', ') : 'Nenhum'}</span>
           </div>
           <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
           <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Matrícula</span><span className="text-xs font-bold text-black">{filterMatr || 'Todos'}</span></div>
           <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
           <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">UL De</span><span className="text-xs font-bold text-black">{filterUlDe || 'Todos'}</span></div>
           <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
           <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">UL Para</span><span className="text-xs font-bold text-black">{filterUlPara || 'Todos'}</span></div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-black text-white rounded-lg"><Filter size={18} /></div>
          <h2 className="text-sm font-bold text-black uppercase tracking-tight">Selecione os dados desejado:</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase tracking-wider">Ano</label><select value={filterAno} onChange={(e) => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black">{options.anos.map(a => <option key={a} value={a}>{a}</option>)}<option value="">Todos</option></select></div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">Mês (Múltiplo)</label>
            <MonthMultiSelect options={options.meses} selected={filterMes} onToggle={toggleMonth} onToggleAll={toggleAllMonths} />
          </div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase tracking-wider">Matrícula</label><select value={filterMatr} onChange={(e) => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black"><option value="">Todas</option>{options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase tracking-wider">UL DE</label><input type="text" value={filterUlDe} placeholder="00000000" onChange={(e) => setFilterUlDe(validateUlInput(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black" /></div>
          <div className="space-y-2"><label className="text-[11px] font-bold text-black uppercase tracking-wider">UL PARA</label><input type="text" value={filterUlPara} placeholder="99999999" onChange={(e) => setFilterUlPara(validateUlInput(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black" /></div>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-3 px-16 py-4 bg-black text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 active:scale-95">{loading ? <Activity className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />} GERAR</button>
          <button onClick={handleReset} className="flex items-center gap-2 px-8 py-4 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"><RotateCcw size={14} /> Limpar</button>
        </div>

        {errorMsg && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-[11px] font-bold uppercase animate-bounce">
            <AlertCircle size={20} /> <p>{errorMsg}</p>
          </div>
        )}
      </section>

      {hasGenerated && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            <IndicatorCard label="Leit. Urb" value={cardTotals.urb.toLocaleString()} icon={<Home size={20} />} color="blue" />
            <IndicatorCard label="Leit. Povoado" value={cardTotals.pov.toLocaleString()} icon={<Map size={20} />} color="blue" />
            <IndicatorCard label="Leit. Rural" value={cardTotals.rur.toLocaleString()} icon={<Tent size={20} />} color="blue" />
            <IndicatorCard label="Impedimentos" value={cardTotals.imp.toLocaleString()} icon={<AlertTriangle size={20} />} color="red" />
          </div>

          <section className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden relative">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 no-print">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><LayoutList size={18} className="text-black" /><h3 className="text-xs font-black text-black uppercase tracking-tight">Relação de Impedimentos</h3></div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => { setActiveTab('completo'); setCurrentPage(1); }} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'completo' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Relatório Geral</button>
                  <button onClick={() => { setActiveTab('razao'); setCurrentPage(1); }} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'razao' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Relatório Por Razão</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-bold mr-2">{currentTableData.length} registros</span>
                <button onClick={exportExcel} className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 border border-green-100"><FileSpreadsheet size={18} /></button>
                <button onClick={exportPDF} className="p-2.5 bg-black text-white rounded-xl hover:bg-slate-900"><FileText size={18} /></button>
              </div>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-[10px] text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-black uppercase font-black tracking-wider border border-slate-200">
                  <tr>
                    <th className="px-6 py-4 border border-slate-200">ANO</th>
                    <th className="px-6 py-4 border border-slate-200">MES</th>
                    <th className="px-6 py-4 border border-slate-200">RAZÃO</th>
                    {activeTab === 'completo' && <th className="px-6 py-4 text-center border border-slate-200">UL</th>}
                    <th className="px-6 py-4 border border-slate-200">MATR</th>
                    <th className="px-6 py-4 text-center border border-slate-200">Leit. Urb</th>
                    <th className="px-6 py-4 text-center border border-slate-200">Leit. Pov</th>
                    <th className="px-6 py-4 text-center border border-slate-200">Leit. Rur</th>
                    <th className="px-6 py-4 text-center border border-slate-200 font-black">Leit. Total</th>
                    <th className="px-6 py-4 text-center border border-slate-200 font-black">IMPEDIMENTOS</th>
                    <th className="px-6 py-4 text-center border border-slate-200 font-black">INDICADOR</th>
                  </tr>
                </thead>
                <tbody className="text-black font-medium">
                  {paginatedData.map((row, idx) => {
                    const ind = calculateCorrectedIndicator(row.impedimentos, row.leit_total);
                    const styles = getRowStyles(ind);
                    return (
                      <tr key={idx} className={`${styles} border border-slate-200 transition-colors`}>
                        <td className="px-6 py-3 border border-slate-200">{row.ano}</td>
                        <td className="px-6 py-3 uppercase border border-slate-200">{row.mes}</td>
                        <td className="px-6 py-3 whitespace-nowrap border border-slate-200">{row.razao}</td>
                        {activeTab === 'completo' && <td className="px-6 py-3 text-center font-mono border border-slate-200">{row.ul}</td>}
                        <td className="px-6 py-3 border border-slate-200">{row.matr}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.leit_urb}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.leit_povoado}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.leit_rural}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.leit_total}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.impedimentos}</td>
                        <td className="px-6 py-3 text-center border border-slate-200 font-black">{formatPercent(ind)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30 no-print">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Página {currentPage} de {totalPages || 1}</p>
              <div className="flex gap-2">
                <button disabled={currentPage === 1 || loading} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 rounded-lg bg-black text-white hover:bg-slate-800 disabled:opacity-30 shadow-sm transition-all"><ChevronLeft size={16} /></button>
                <button disabled={currentPage === totalPages || totalPages === 0 || loading} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 rounded-lg bg-black text-white hover:bg-slate-800 disabled:opacity-30 shadow-sm transition-all"><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>

          {/* GRÁFICO ANALÍTICO */}
          {processedChartData.length > 0 && (
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 no-print">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2"><TrendingUp size={18} className="text-black" /><h3 className="text-sm font-black text-black uppercase tracking-tight">Gráfico Analítico de Impedimentos</h3></div>
                <div className="flex bg-slate-100 p-1 rounded-xl items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter px-3">Visualizar por:</span>
                  {[
                    { id: 'ano', label: 'Ano', icon: <Calendar size={12}/> },
                    { id: 'mes', label: 'Mês', icon: <Calendar size={12}/> },
                    { id: 'razao', label: 'Razão', icon: <ListFilter size={12}/> },
                    { id: 'matr', label: 'Matrícula', icon: <Users size={12}/> },
                    { id: 'tipo', label: 'Tipo', icon: <Info size={12}/> }
                  ].map((dim) => (
                    <button key={dim.id} onClick={() => setChartDimension(dim.id as any)} className={`flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${chartDimension === dim.id ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{dim.icon}{dim.label}</button>
                  ))}
                </div>
              </div>

              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#000', fontSize: 9, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc', opacity: 0.4}} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32} fill="#991b1b">
                       {processedChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#991b1b" className="hover:fill-[#7f1d1d] transition-colors" />
                       ))}
                       <LabelList dataKey="value" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#991b1b' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}

      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center mx-auto max-w-lg shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6"><Users size={32} className="text-slate-200" /></div>
          <h3 className="text-slate-900 font-black text-lg mb-2 tracking-tight uppercase">Controle de Leiturista</h3>
          <p className="text-slate-400 font-medium text-[10px] uppercase tracking-[0.2em] px-10">Configure os filtros e clique em <span className="text-black font-black">GERAR</span> para carregar a relação de impedimentos.</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 text-center border border-white/20">
             <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-[6px] border-slate-50 border-t-black animate-spin"></div>
                <Database size={24} className="absolute inset-0 m-auto text-black animate-pulse" />
             </div>
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Sincronizando Dados</h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;
