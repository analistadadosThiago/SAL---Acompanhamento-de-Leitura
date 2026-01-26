
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRADO, 
  RPC_CE_POR_RAZAO,
  RPC_GET_ANOS,
  RPC_GET_MESES,
  RPC_GET_MATRICULAS,
  RPC_GET_ULS,
  MONTH_ORDER 
} from '../constants';
import { 
  Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, 
  Database, Activity, Check, ChevronDown, AlertTriangle, 
  TrendingUp, Zap, RotateCcw, Search, Camera,
  LayoutList, BarChart3, Info, PieChart as PieIcon, LineChart as LineIcon,
  CheckCircle2, XCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LabelList, Cell, Legend, LineChart, Line, PieChart, Pie
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import IndicatorCard from './IndicatorCard';

const ITEMS_PER_PAGE = 25;

interface EvidenciaRecord {
  mes: string;
  ano: number;
  rz: string;
  ul: string | number;
  solicitadas: number;
  realizadas: number;
  nao_realizadas: number;
  matr: string;
  nl: string;
  l_atual: number;
  digitacao: string;
  indicador: number;
  CorIndicador?: string; // Campo opcional vindo da RPC
}

const EvidenceAuditControl: React.FC = () => {
  // Estados dos Filtros
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  // Estados das Opções (RPCs de Validação)
  const [options, setOptions] = useState<{ anos: string[], meses: string[], matriculas: string[] }>({
    anos: [], meses: [], matriculas: []
  });

  // Estados de Dados e UI
  const [dataCompleto, setDataCompleto] = useState<EvidenciaRecord[]>([]);
  const [dataPorRazao, setDataPorRazao] = useState<EvidenciaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<'completo' | 'razao'>('completo');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Carregar metadados iniciais via RPCs de validação
  useEffect(() => {
    const fetchValidationFilters = async () => {
      setLoadingFilters(true);
      try {
        const [resAnos, resMeses, resMatr] = await Promise.all([
          supabase.rpc(RPC_GET_ANOS),
          supabase.rpc(RPC_GET_MESES),
          supabase.rpc(RPC_GET_MATRICULAS)
        ]);

        setOptions({
          anos: (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: string, b: string) => Number(b) - Number(a)),
          meses: (resMeses.data || []).map((m: any) => String(m.mes || m)).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)),
          matriculas: (resMatr.data || []).map((m: any) => String(m.matr || m)).sort()
        });
      } catch (err) {
        console.error("Erro ao carregar validações de filtros:", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchValidationFilters();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validação: Habilitar GERAR apenas com filtros preenchidos
  const canGenerate = filterAno !== '' && filterMeses.length > 0 && filterMatr !== '' && filterUlDe !== '' && filterUlPara !== '';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    
    // Validação lógica UL
    if (Number(filterUlDe) > Number(filterUlPara)) {
      alert("A UL inicial (DE) não pode ser maior que a UL final (PARA).");
      return;
    }

    setLoading(true);
    setCurrentPage(1);

    try {
      const params = {
        p_ano_inicial: Number(filterAno),
        p_ano_final: Number(filterAno),
        p_meses: filterMeses.join(','), 
        p_matr: filterMatr,
        p_ul_de: Number(filterUlDe),
        p_ul_para: Number(filterUlPara)
      };

      const [resCompleto, resRazao] = await Promise.all([
        supabase.rpc(RPC_CE_FILTRADO, params),
        supabase.rpc(RPC_CE_POR_RAZAO, params)
      ]);

      if (resCompleto.error) throw resCompleto.error;
      if (resRazao.error) throw resRazao.error;

      setDataCompleto((resCompleto.data || []).sort((a: any, b: any) => b.indicador - a.indicador));
      setDataPorRazao((resRazao.data || []).sort((a: any, b: any) => b.indicador - a.indicador));
      setHasGenerated(true);
    } catch (err: any) {
      console.error("Erro ao gerar evidências:", err);
      alert(`Falha no processamento: ${err.message || 'Erro de conexão'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilterAno('');
    setFilterMeses([]);
    setFilterMatr('');
    setFilterUlDe('');
    setFilterUlPara('');
    setDataCompleto([]);
    setDataPorRazao([]);
    setHasGenerated(false);
    setCurrentPage(1);
  };

  const currentData = activeTab === 'completo' ? dataCompleto : dataPorRazao;
  const paginatedData = currentData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE) || 1;

  // Regra de cores por linha baseado em CorIndicador ou Threshhold manual v9
  const getRowStyle = (row: EvidenciaRecord) => {
    if (row.CorIndicador) {
      if (row.CorIndicador === 'vermelho-escuro') return "bg-[#c62828] text-white font-bold border-red-900/50";
      if (row.CorIndicador === 'amarelo-escuro') return "bg-[#f9a825] text-black border-amber-900/50";
      if (row.CorIndicador === 'verde-escuro') return "bg-[#2e7d32] text-white border-green-900/50";
    }
    // Fallback Manual
    const ind = row.indicador;
    if (ind >= 50) return "bg-[#c62828] text-white font-bold border-red-900/50";
    if (ind >= 41) return "bg-[#f9a825] text-black border-amber-900/50";
    return "bg-[#2e7d32] text-white border-green-900/50";
  };

  const totals = useMemo(() => {
    return dataCompleto.reduce((acc, curr) => ({
      sol: acc.sol + (Number(curr.solicitadas) || 0),
      rea: acc.rea + (Number(curr.realizadas) || 0),
      nre: acc.nre + (Number(curr.nao_realizadas) || 0)
    }), { sol: 0, rea: 0, nre: 0 });
  }, [dataCompleto]);

  // Gráfico 1: Barras - Solicitadas vs Realizadas por Mês
  const barChartData = useMemo(() => {
    const monthly: Record<string, { name: string, sol: number, rea: number }> = {};
    dataCompleto.forEach(d => {
      if (!monthly[d.mes]) monthly[d.mes] = { name: d.mes, sol: 0, rea: 0 };
      monthly[d.mes].sol += Number(d.solicitadas) || 0;
      monthly[d.mes].rea += Number(d.realizadas) || 0;
    });
    return Object.values(monthly).sort((a, b) => (MONTH_ORDER[a.name] || 0) - (MONTH_ORDER[b.name] || 0));
  }, [dataCompleto]);

  // Gráfico 2: Linhas - Indicador médio por Ano
  const lineChartData = useMemo(() => {
    const yearly: Record<number, { year: number, indSum: number, count: number }> = {};
    dataCompleto.forEach(d => {
      if (!yearly[d.ano]) yearly[d.ano] = { year: d.ano, indSum: 0, count: 0 };
      yearly[d.ano].indSum += d.indicador;
      yearly[d.ano].count++;
    });
    return Object.values(yearly).map(v => ({ year: v.year, indicador: v.indSum / v.count })).sort((a,b) => a.year - b.year);
  }, [dataCompleto]);

  // Gráfico 3: Pizza - Distribuição por Status
  const pieChartData = [
    { name: 'Realizadas', value: totals.rea, color: '#2e7d32' },
    { name: 'Não-Realizadas', value: totals.nre, color: '#c62828' }
  ].filter(p => p.value > 0);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(currentData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SAL_Evidencias_V9");
    XLSX.writeFile(wb, `SAL_Auditoria_${activeTab}_${filterAno}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`SAL - Controle de Evidências (${activeTab === 'completo' ? 'Geral' : 'Consolidado Razão'})`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Ano: ${filterAno} | Meses: ${filterMeses.join(', ')} | UL: ${filterUlDe} a ${filterUlPara}`, 14, 22);

    const headers = activeTab === 'completo' 
      ? [["MÊS", "ANO", "RAZÃO", "UL", "SOLIC.", "REALIZ.", "N-REALIZ.", "MATR", "COD", "INDICADOR"]]
      : [["MÊS", "ANO", "RAZÃO", "SOLIC.", "REALIZ.", "N-REALIZ.", "INDICADOR"]];
    
    const body = activeTab === 'completo'
      ? currentData.map(r => [r.mes, r.ano, r.rz, r.ul, r.solicitadas, r.realizadas, r.nao_realizadas, r.matr, r.nl, `${r.indicador.toFixed(2)}%`])
      : currentData.map(r => [r.mes, r.ano, r.rz, r.solicitadas, r.realizadas, r.nao_realizadas, `${r.indicador.toFixed(2)}%`]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [10, 12, 16], textColor: [255, 255, 255] }
    });
    doc.save(`SAL_Auditoria_${activeTab}_V9.pdf`);
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {/* 1. SEÇÃO DE FILTROS PROFISSIONAIS */}
      <section className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-slate-950 text-white rounded-3xl shadow-xl shadow-slate-900/20">
            <Camera size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Auditoria de Evidências Fotográficas</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronização Estrutural V9.0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Filtro Ano */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Ano Operacional</label>
            <select 
              value={filterAno} 
              onChange={e => setFilterAno(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
              <option value="">Selecione Ano</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Filtro Meses (Multi-Select Profissional) */}
          <div className="space-y-3 relative" ref={dropdownRef}>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Meses (Múltiplo)</label>
            <button 
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold flex items-center justify-between hover:border-blue-200 transition-all shadow-sm"
            >
              <span className="truncate">{filterMeses.length === 0 ? "Selecionar Meses" : `${filterMeses.length} Selecionados`}</span>
              <ChevronDown size={18} className={`transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute z-[100] top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-72 overflow-y-auto p-3 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 gap-1">
                   {options.meses.map(m => (
                    <label key={m} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${filterMeses.includes(m) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                      <input 
                        type="checkbox" 
                        checked={filterMeses.includes(m)}
                        onChange={() => setFilterMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className="text-xs font-black uppercase">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filtro Matrícula */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Matrícula Técnica</label>
            <select 
              value={filterMatr} 
              onChange={e => setFilterMatr(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all"
            >
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Filtro UL DE */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center justify-between">
              UL Inicial (DE)
              <button 
                title="Sugerir range de UL"
                onClick={async () => {
                   const { data } = await supabase.rpc(RPC_GET_ULS);
                   if (data && data.length > 0) {
                      setFilterUlDe(String(data[0].min_ul || ''));
                      setFilterUlPara(String(data[0].max_ul || ''));
                   }
                }}
                className="text-[9px] text-blue-600 hover:underline font-black"
              >
                AUTOCARREGAR
              </button>
            </label>
            <input 
              type="text" 
              maxLength={8}
              value={filterUlDe} 
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-black focus:border-blue-600 outline-none" 
              placeholder="00000000"
            />
          </div>

          {/* Filtro UL PARA */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">UL Final (PARA)</label>
            <input 
              type="text" 
              maxLength={8}
              value={filterUlPara} 
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-black focus:border-blue-600 outline-none" 
              placeholder="99999999"
            />
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
          <button 
            onClick={handleGenerate} 
            disabled={loading || !canGenerate}
            className="px-24 py-5 bg-slate-950 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 hover:scale-[1.03] active:scale-95 transition-all shadow-2xl disabled:opacity-20 shadow-slate-900/40"
          >
            {loading ? <Activity className="animate-spin" size={20}/> : <Zap size={20} fill="currentColor"/>}
            SINCRO AUDITORIA
          </button>
          <button onClick={handleReset} className="px-12 py-5 bg-slate-100 text-slate-500 rounded-[2.5rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-200 transition-all">
            <RotateCcw size={18} /> RESETAR FILTROS
          </button>
        </div>
      </section>

      {hasGenerated && (
        <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-1000">
          {/* INDICADORES ESTRATÉGICOS V9 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Dataset Consolidado" value={currentData.length.toLocaleString()} color="blue" icon={<Database size={24}/>} />
            <IndicatorCard label="Total Solicitadas" value={totals.sol.toLocaleString()} color="blue" icon={<LayoutList size={24}/>} />
            <IndicatorCard label="Total Realizadas" value={totals.rea.toLocaleString()} color="green" icon={<CheckCircle2 size={24}/>} />
            <IndicatorCard label="Eficiência Média" value={(totals.sol > 0 ? (totals.rea/totals.sol)*100 : 0).toFixed(2).replace('.',',')} suffix="%" color="amber" icon={<TrendingUp size={24}/>} />
          </div>

          {/* TABELA DE RESULTADOS COM CORES V9 */}
          <section className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-12 py-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-8">
              <div className="flex bg-slate-100 p-2 rounded-[2rem] shadow-inner">
                <button 
                  onClick={() => { setActiveTab('completo'); setCurrentPage(1); }} 
                  className={`px-12 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-[1.5rem] transition-all ${activeTab === 'completo' ? 'bg-white shadow-xl text-slate-950 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Relatório Completo
                </button>
                <button 
                  onClick={() => { setActiveTab('razao'); setCurrentPage(1); }} 
                  className={`px-12 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-[1.5rem] transition-all ${activeTab === 'razao' ? 'bg-white shadow-xl text-slate-950 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Relatório Por Razão
                </button>
              </div>

              <div className="flex gap-4">
                <button onClick={exportExcel} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                  <FileSpreadsheet size={18}/> EXCEL
                </button>
                <button onClick={exportPDF} className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                  <FileText size={18}/> PDF V9
                </button>
              </div>
            </div>

            <div className="overflow-x-auto p-6">
              <table className="w-full text-[11px] border-separate border-spacing-y-2">
                <thead className="text-slate-500 font-black uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-6 py-4 text-center">MÊS</th>
                    <th className="px-6 py-4 text-center">ANO</th>
                    <th className="px-6 py-4 text-left">RAZÃO SOCIAL</th>
                    {activeTab === 'completo' && <th className="px-6 py-4 text-center">UL</th>}
                    <th className="px-6 py-4 text-center">SOLIC.</th>
                    <th className="px-6 py-4 text-center">REALIZ.</th>
                    <th className="px-6 py-4 text-center">N-REALIZ.</th>
                    {activeTab === 'completo' && (
                      <>
                        <th className="px-6 py-4 text-center">MATR</th>
                        <th className="px-6 py-4 text-center">COD</th>
                        <th className="px-6 py-4 text-right">LEITURA</th>
                        <th className="px-6 py-4 text-center">DIG.</th>
                      </>
                    )}
                    <th className="px-6 py-4 text-right">INDICADOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-transparent">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getRowStyle(row)} shadow-lg transition-transform hover:scale-[1.002]`}>
                      <td className="px-6 py-4 uppercase font-black text-center rounded-l-2xl">{row.mes}</td>
                      <td className="px-6 py-4 text-center">{row.ano}</td>
                      <td className="px-6 py-4 text-left uppercase font-black truncate max-w-[220px]">{row.rz}</td>
                      {activeTab === 'completo' && <td className="px-6 py-4 font-mono text-center">{row.ul}</td>}
                      <td className="px-6 py-4 font-black text-center">{row.solicitadas}</td>
                      <td className="px-6 py-4 font-black text-center">{row.realizadas}</td>
                      <td className="px-6 py-4 text-center opacity-80">{row.nao_realizadas}</td>
                      {activeTab === 'completo' && (
                        <>
                          <td className="px-6 py-4 font-mono text-center">{row.matr}</td>
                          <td className="px-6 py-4 font-black text-center italic">{row.nl}</td>
                          <td className="px-6 py-4 text-right font-black">{row.l_atual}</td>
                          <td className="px-6 py-4 text-[9px] text-center opacity-70 truncate max-w-[80px]">{row.digitacao}</td>
                        </>
                      )}
                      <td className="px-6 py-4 font-black text-right text-sm rounded-r-2xl">
                        {row.indicador.toFixed(2).replace('.', ',')}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-12 py-8 border-t flex items-center justify-between bg-slate-50">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Dataset Página {currentPage} de {totalPages}</span>
              <div className="flex gap-4">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 shadow-sm disabled:opacity-30 transition-all">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 shadow-sm disabled:opacity-30 transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </section>

          {/* TRÊS GRÁFICOS ANALÍTICOS V9 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Gráfico 1: Barras - Solicitadas vs Realizadas */}
            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BarChart3 size={20} /></div>
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight italic">Status de Evidências por Mês</h3>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip cursor={{fill: '#f8fafc', radius: 8}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }} />
                    <Bar dataKey="sol" name="Solicitadas" fill="#0f172a" barSize={30} radius={[6,6,0,0]} />
                    <Bar dataKey="rea" name="Realizadas" fill="#2e7d32" barSize={30} radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Linhas - Evolução do Indicador */}
            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><LineIcon size={20} /></div>
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight italic">Evolução do Indicador por Ano</h3>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="indicador" name="Eficiência Média" stroke="#2563eb" strokeWidth={5} dot={{ r: 6, fill: '#2563eb' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 3: Pizza - Distribuição por Status */}
            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200 lg:col-span-2">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl"><PieIcon size={20} /></div>
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight italic">Distribuição Status de Auditoria</h3>
              </div>
              <div className="h-[400px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white border-2 border-dashed border-slate-200 rounded-[4rem] text-center shadow-inner">
          <div className="p-16 bg-slate-50 rounded-full mb-10 text-slate-200 animate-pulse">
             <Camera size={100} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Auditoria Operacional V9.0</h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-8 max-w-md leading-relaxed">
            Selecione Ano, Meses e Parâmetros de UL para materializar a matriz de auditoria em tempo real.
          </p>
          {loadingFilters && <span className="mt-6 text-[9px] font-black text-blue-600 uppercase tracking-widest animate-pulse">Sincronizando Filtros Validados via RPC...</span>}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-24 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 border border-slate-100">
             <div className="relative">
                <div className="h-32 w-32 border-[8px] border-slate-50 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 m-auto h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center">
                   <Database size={32} className="text-blue-600 animate-pulse" />
                </div>
             </div>
             <div className="text-center">
                <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter italic">Dataset Materialization</h2>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] mt-5 animate-pulse">Processando Matriz de Evidências v9.0 Neural...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
