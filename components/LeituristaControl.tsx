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
  Calendar, Filter, RotateCcw, AlertCircle, Map, Home, Tent, AlertTriangle, ListFilter, X, Info, Check, ChevronDown, BarChart3
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

  // Nova aba de agrupamento para o gráfico
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

  // Gráfico de Impedimentos REAGRUPADO NO FRONTEND conforme chartGrouping
  const chartData = useMemo(() => {
    const grouped: Record<string, { key: string, impedimentos: number, razao?: string, indicador: number, count: number }> = {};
    
    dadosTabela.forEach(item => {
      let groupKey = '';
      if (chartGrouping === 'matr') groupKey = item.matr;
      else if (chartGrouping === 'razao') groupKey = item.razao;
      else if (chartGrouping === 'mes') groupKey = item.mes;

      if (!grouped[groupKey]) {
        grouped[groupKey] = { 
          key: groupKey, 
          impedimentos: item.impedimentos, 
          razao: item.razao, 
          indicador: item.indicador,
          count: 1
        };
      } else {
        grouped[groupKey].impedimentos += item.impedimentos;
        grouped[groupKey].indicador += item.indicador;
        grouped[groupKey].count += 1;
      }
    });

    return Object.values(grouped)
      .map(g => ({
        name: g.key,
        impedimentos: g.impedimentos,
        razao: g.razao,
        indicador: g.indicador / g.count,
        groupKey: chartGrouping,
        groupLabel: chartGrouping === 'matr' ? 'Matrícula' : chartGrouping === 'razao' ? 'Razão' : 'Mês'
      }))
      .sort((a, b) => b.impedimentos - a.impedimentos)
      .slice(0, 15);
  }, [dadosTabela, chartGrouping]);

  const exportToExcel = () => {
    if (currentTableData.length === 0) return;
    const dataToExport = currentTableData.map(row => ({
      "ANO": row.ano,
      "MÊS": row.mes.toUpperCase(),
      "RAZÃO SOCIAL": row.razao,
      "UL": row.ul || '-',
      "MATRÍCULA": row.matr,
      "URBANO": row.leit_urb,
      "POVOADO": row.leit_povoado,
      "RURAL": row.leit_rural,
      "TOTAL": row.leit_total,
      "IMPEDIMENTOS": row.impedimentos,
      "INDICADOR (%)": `${row.indicador.toFixed(2)}%`
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Impedimentos");
    XLSX.writeFile(wb, "SAL_Relatorio_Leiturista.xlsx");
  };

  const exportToPDF = () => {
    if (currentTableData.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    const tableColumn = ["ANO", "MES", "RAZÃO", "UL", "MATR", "URB", "POV", "RUR", "TOTAL", "IMP", "INDICADOR"];
    const tableRows = currentTableData.map(row => [
      row.ano, 
      row.mes.toUpperCase(), 
      row.razao, 
      row.ul || '-', 
      row.matr,
      row.leit_urb, 
      row.leit_povoado, 
      row.leit_rural,
      row.leit_total, 
      row.impedimentos, 
      `${row.indicador.toFixed(2)}%`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    doc.setFontSize(14);
    doc.text("SAL - Relatório de Impedimentos", 14, 15);
    doc.save("SAL_Relatorio_Leiturista.pdf");
  };

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
                                <td className="px-6 py-4 font-bold text-black">{item.matr}</td>
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
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase">UL DE</label>
            <input 
              type="text" 
              value={filterUlDe} 
              maxLength={8}
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase">UL PARA</label>
            <input 
              type="text" 
              value={filterUlPara} 
              maxLength={8}
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4" 
            />
          </div>
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
                <div className="flex flex-wrap items-center gap-6">
                   <h3 className="text-xs font-black uppercase tracking-tight leading-relaxed">
                      Relação de Impedimentos.
                   </h3>
                   <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => { setActiveTab('completo'); setCurrentPage(1); }} className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'completo' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Geral</button>
                      <button onClick={() => { setActiveTab('razao'); setCurrentPage(1); }} className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'razao' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Por Razão</button>
                   </div>
                </div>
                
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                   <div className="flex gap-2">
                      <button 
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-100 transition-all"
                      >
                        <FileSpreadsheet size={14} /> Exportar para Excel
                      </button>
                      <button 
                        onClick={exportToPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 transition-all"
                      >
                        <FileText size={14} /> Exportar para PDF
                      </button>
                   </div>
                   <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold">{currentTableData.length} registros</span>
                </div>
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

          {/* GRÁFICO DE IMPEDIMENTOS COM SELEÇÃO DE AGRUPAMENTO (FRONTEND ONLY) */}
          <section className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <BarChart3 size={20} />
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">Análise Gráfica de Impedimentos</h3>
                   </div>
                </div>

                {/* ABA DE SELEÇÃO DE AGRUPAMENTO */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                   <button 
                     onClick={() => setChartGrouping('matr')}
                     className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartGrouping === 'matr' ? 'bg-white text-blue-600 shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     Matr
                   </button>
                   <button 
                     onClick={() => setChartGrouping('razao')}
                     className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartGrouping === 'razao' ? 'bg-white text-blue-600 shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     Razão
                   </button>
                   <button 
                     onClick={() => setChartGrouping('mes')}
                     className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartGrouping === 'mes' ? 'bg-white text-blue-600 shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     Mês
                   </button>
                </div>
             </div>

             <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc', radius: 8}} />
                      <Bar dataKey="impedimentos" name="Impedimentos" barSize={36} radius={[8, 8, 0, 0]}>
                         {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.indicador >= 0.50 ? '#991b1b' : entry.indicador >= 0.41 ? '#b45309' : '#1d4ed8'} />
                         ))}
                         <LabelList dataKey="impedimentos" position="top" style={{ fill: '#0f172a', fontSize: '11px', fontWeight: '900' }} offset={10} />
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
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