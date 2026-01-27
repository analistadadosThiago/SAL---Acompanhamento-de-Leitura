
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  TABLE_NAME,
  RPC_CL_FILTROS,
  MONTH_ORDER,
  FALLBACK_MONTHS
} from '../constants';
import { 
  Filter, ChevronLeft, ChevronRight, 
  Activity, Check, ChevronDown, 
  Zap, Camera, Loader2, AlertCircle, RefreshCw,
  Maximize2, Minimize2, FileText, TrendingUp, BarChart3,
  FileDown, Trash2, ClipboardList, Printer, Tag
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import IndicatorCard from './IndicatorCard';

interface EvidenciaRecord {
  mes: string;
  ano: number;
  rz: string;
  ul: string;
  solicitadas: number;
  realizadas: number;
  nao_realizadas: number;
  matr: string;
  indicador: number;
}

const ITEMS_PER_PAGE = 20;

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-5 rounded-3xl shadow-2xl border border-slate-100 text-[11px] min-w-[200px]">
        <p className="font-black text-slate-900 mb-3 border-b pb-2 uppercase tracking-tighter">{label}</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-500 uppercase">Solicitadas:</span>
            <span className="text-slate-900 font-black">{data.sol.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold text-red-500 uppercase">Não Realizadas:</span>
            <span className="text-red-700 font-black">{data.nre.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t mt-2 flex justify-between items-center">
            <span className="font-bold text-indigo-600 uppercase">Indicador:</span>
            <span className="text-indigo-800 font-black text-sm">{data.ind.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const EvidenceAuditControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  const [options, setOptions] = useState<{ anos: any[], meses: any[], matriculas: any[] }>({
    anos: [], meses: [], matriculas: []
  });

  const [data, setData] = useState<EvidenciaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState(0);
  
  const [activeTableTab, setActiveTableTab] = useState<'por_matricula' | 'razao'>('por_matricula');
  const [activeChartTab, setActiveChartTab] = useState<'mes' | 'razao' | 'matr'>('mes');

  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const { data: res, error } = await supabase.rpc(RPC_CL_FILTROS);
        if (error) throw error;
        const filterData = Array.isArray(res) ? res[0] : res;
        if (filterData) {
          setOptions({
            anos: (filterData.anos || []).map((v: any) => ({ valor: String(v), label: String(v) })).sort((a: any, b: any) => Number(b.valor) - Number(a.valor)),
            meses: (filterData.meses || []).map((v: any) => ({ valor: String(v), label: String(v) })).sort((a: any, b: any) => (MONTH_ORDER[a.valor] || 0) - (MONTH_ORDER[b.valor] || 0)),
            matriculas: (filterData.matriculas || []).map((v: any) => ({ valor: String(v), label: String(v) })).sort((a: any, b: any) => a.label.localeCompare(b.label))
          });
        }
      } catch (err) {
        setOptions({
          anos: [],
          matriculas: [],
          meses: FALLBACK_MONTHS.map(m => ({ valor: m, label: m }))
        });
      }
    };
    loadFilters();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    setValidationError(null);
    setConnectionError(null);
    if (!filterAno || filterMeses.length === 0) {
      setValidationError("Selecione Ano e pelo menos um Mês para processar.");
      return;
    }

    setLoading(true);
    setHasGenerated(false);
    setData([]);
    setFetchProgress(0);
    setCurrentPage(1);

    try {
      const groupedMap = new Map();
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from(TABLE_NAME)
          .select('Mes, Ano, rz, matr, digitacao, foto, rz_ul_lv') 
          .eq('Ano', parseInt(filterAno, 10))
          .in('Mes', filterMeses);
        
        if (filterMatr) query = query.eq('matr', filterMatr);
        if (filterUlDe) query = query.gte('rz_ul_lv', filterUlDe);
        if (filterUlPara) query = query.lte('rz_ul_lv', filterUlPara);

        query = query.range(from, from + step - 1);
        const { data: batch, error } = await query;
        
        if (error) throw error;
        
        if (batch && batch.length > 0) {
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            const key = item.Mes + '|' + item.rz + '|' + item.matr + '|' + (item.rz_ul_lv || 'N/A');
            let g = groupedMap.get(key);
            if (!g) {
              g = { 
                mes: item.Mes, 
                ano: item.Ano, 
                rz: item.rz, 
                ul: item.rz_ul_lv || 'N/A', 
                matr: item.matr, 
                sol: 0, 
                rea: 0 
              };
              groupedMap.set(key, g);
            }
            if (item.digitacao && Number(item.digitacao) >= 2) g.sol++;
            if (item.foto === 'OK') g.rea++;
          }

          from += batch.length;
          setFetchProgress(from);
          if (batch.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      
      if (groupedMap.size > 0) {
        const formatted: EvidenciaRecord[] = Array.from(groupedMap.values()).map((g: any) => ({
          mes: g.mes, 
          ano: g.ano, 
          rz: g.rz, 
          ul: g.ul, 
          matr: g.matr,
          solicitadas: g.sol, 
          realizadas: g.rea, 
          nao_realizadas: Math.max(0, g.sol - g.rea),
          indicador: g.sol > 0 ? (g.rea / g.sol) * 100 : 0
        }));

        setData(formatted);
      }
      setHasGenerated(true);
    } catch (err: any) {
      setConnectionError(`Erro de Conexão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNovaConsulta = () => {
    setFilterAno(''); setFilterMeses([]); setFilterMatr(''); setFilterUlDe(''); setFilterUlPara('');
    setData([]); setHasGenerated(false); setFetchProgress(0); setCurrentPage(1);
    setValidationError(null); setConnectionError(null);
  };

  const currentSourceData = useMemo(() => {
    const grouped: Record<string, any> = {};
    data.forEach(item => {
      let key = activeTableTab === 'por_matricula' ? `${item.rz}-${item.matr}` : `${item.mes}-${item.ano}-${item.rz}`;
      if (!grouped[key]) {
        grouped[key] = { rz: item.rz, mes: item.mes, ano: item.ano, sol: 0, rea: 0, matr: activeTableTab === 'por_matricula' ? item.matr : 'LOTE' };
      }
      grouped[key].sol += item.solicitadas;
      grouped[key].rea += item.realizadas;
    });

    return Object.values(grouped).map((g: any) => ({
      rz: g.rz, mes: g.mes, ano: g.ano, matr: g.matr, solicitadas: g.sol, realizadas: g.rea,
      nao_realizadas: Math.max(0, g.sol - g.rea), indicador: g.sol > 0 ? (g.rea / g.sol) * 100 : 0
    })).sort((a, b) => b.indicador - a.indicador);
  }, [data, activeTableTab]);

  const summaryMetrics = useMemo(() => {
    const totals = currentSourceData.reduce((acc, curr) => {
      acc.sol += curr.solicitadas;
      acc.rea += curr.realizadas;
      return acc;
    }, { sol: 0, rea: 0 });

    const nre = Math.max(0, totals.sol - totals.rea);
    const ind = totals.sol > 0 ? (totals.rea / totals.sol) * 100 : 0;

    return { sol: totals.sol, rea: totals.rea, nre, ind };
  }, [currentSourceData]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { label: string, sol: number, rea: number }> = {};
    data.forEach(item => {
      let key = activeChartTab === 'mes' ? item.mes : activeChartTab === 'razao' ? item.rz : item.matr;
      if (!grouped[key]) grouped[key] = { label: key, sol: 0, rea: 0 };
      grouped[key].sol += item.solicitadas;
      grouped[key].rea += item.realizadas;
    });
    
    const result = Object.values(grouped).map(g => ({
      label: g.label, sol: g.sol, rea: g.rea, nre: Math.max(0, g.sol - g.rea), ind: g.sol > 0 ? (g.rea / g.sol) * 100 : 0
    }));

    if (activeChartTab === 'matr') {
      // Ordenação por indicador crescente (menor para maior)
      return result.sort((a, b) => a.ind - b.ind).slice(0, 20);
    }

    if (activeChartTab === 'razao') {
      // Ordenação Alfabética A-Z
      return result.sort((a, b) => a.label.localeCompare(b.label)).slice(0, 20);
    }
    
    // Ordenação Cronológica para Meses
    return result.sort((a, b) => (MONTH_ORDER[a.label] || 0) - (MONTH_ORDER[b.label] || 0)).slice(0, 20);
  }, [data, activeChartTab]);

  const totalPages = Math.max(1, Math.ceil(currentSourceData.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentSourceData.slice(start, start + ITEMS_PER_PAGE);
  }, [currentSourceData, currentPage]);

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14); doc.text("Controle de Evidências - Relação Quantitativa de Evidências", 14, 15);
    const headers = activeTableTab === 'razao' 
      ? [['RAZÃO', 'SOLICITADAS', 'REALIZADAS', 'NÃO REALIZADAS', 'INDICADOR (%)']]
      : [['RAZÃO', 'MATRICULA', 'SOLICITADAS', 'REALIZADAS', 'NÃO REALIZADAS', 'INDICADOR (%)']];
    
    const body = currentSourceData.map(r => {
      const baseRow = [r.rz, r.solicitadas.toLocaleString(), r.realizadas.toLocaleString(), r.nao_realizadas.toLocaleString(), `${r.indicador.toFixed(2)}%`];
      if (activeTableTab !== 'razao') baseRow.splice(1, 0, r.matr);
      return baseRow;
    });

    autoTable(doc, {
      startY: 20,
      head: headers,
      body: body,
      styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save("SAL_Relatorio_Evidencias.pdf");
  };

  return (
    <div className={`space-y-10 pb-20 ${isFullScreen ? 'fixed inset-0 z-[100] bg-[#f8fafc] overflow-y-auto p-10' : 'relative'}`}>
      
      {/* SEÇÃO DE FILTROS APLICADOS */}
      <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
          <Tag size={12} className="text-indigo-400" />
          Filtros Aplicados:
        </div>
        {filterAno && <span className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-600 uppercase">Ano: {filterAno}</span>}
        {filterMeses.length > 0 && <span className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-600 uppercase">Meses: {filterMeses.join(', ')}</span>}
        {filterMatr && <span className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-600 uppercase">Matricula: {filterMatr}</span>}
        {filterUlDe && <span className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-600 uppercase">UL: {filterUlDe} a {filterUlPara || 'Fim'}</span>}
        {!filterAno && !filterMeses.length && <span className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-400 uppercase italic">Nenhum parâmetro selecionado</span>}
      </div>

      {(connectionError || validationError) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 text-[11px] font-bold uppercase">
          <AlertCircle size={18} /> {connectionError || validationError}
        </div>
      )}

      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20"><ClipboardList size={20} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Controle de Evidências</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Campo v9.0</p>
            </div>
          </div>
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ANO</label>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all">
              <option value="">Selecione</option>
              {options.anos.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MESES</label>
            <button onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold flex items-center justify-between hover:border-indigo-600 transition-all">
              <span className="truncate">{filterMeses.length === 0 ? "Selecionar" : `${filterMeses.length} mês(es)`}</span>
              <ChevronDown size={18} />
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute z-[60] top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2 custom-scrollbar">
                {options.meses.map(o => (
                  <div key={o.valor} onClick={() => setFilterMeses(p => p.includes(o.valor) ? p.filter(v => v !== o.valor) : [...p, o.valor])} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all ${filterMeses.includes(o.valor) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                    <span className="text-xs uppercase font-bold">{o.label}</span>
                    {filterMeses.includes(o.valor) && <Check size={14} className="text-indigo-600" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Matricula</label>
            <select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all">
              <option value="">Todas</option>
              {options.matriculas.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL DE:</label>
            <input type="text" value={filterUlDe} maxLength={8} placeholder="Ex: 1000" onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL PARA:</label>
            <input type="text" value={filterUlPara} maxLength={8} placeholder="Ex: 2000" onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all" />
          </div>
        </div>

        <div className="mt-10 flex flex-col md:flex-row justify-center items-center gap-6">
          <button onClick={handleGenerate} disabled={loading} className="px-16 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30 min-w-[280px]">
            {loading ? <RefreshCw className="animate-spin" /> : <Zap size={20} fill="currentColor" />}
            Gerar Relatório
          </button>
          <button onClick={handleNovaConsulta} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all border border-slate-200">
            <Trash2 size={16} /> Nova Consulta
          </button>
        </div>
      </section>

      {hasGenerated && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Solicitadas" value={summaryMetrics.sol.toLocaleString()} icon={<FileText size={20}/>} color="blue" />
            <IndicatorCard label="Realizadas" value={summaryMetrics.rea.toLocaleString()} icon={<Check size={20}/>} color="green" />
            <IndicatorCard label="Não Realizadas" value={summaryMetrics.nre.toLocaleString()} icon={<AlertCircle size={20}/>} color="red" />
            <IndicatorCard label="Indicador Geral" value={summaryMetrics.ind.toFixed(2).replace('.',',')} suffix="%" icon={<TrendingUp size={20}/>} color="amber" />
          </div>

          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
               <div className="flex flex-wrap items-center gap-6">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border"><Camera size={24} className="text-indigo-600" /></div>
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-tighter italic">Relação Quantitativa de Evidências</h3>
                  <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm ml-4">
                      <button onClick={() => { setActiveTableTab('por_matricula'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTableTab === 'por_matricula' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Matricula</button>
                      <button onClick={() => { setActiveTableTab('razao'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTableTab === 'razao' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Por Razão</button>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <button onClick={handleExportPDF} className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100">
                     <Printer size={16} /> PDF
                   </button>
                   <button onClick={() => {
                     const ws = XLSX.utils.json_to_sheet(currentSourceData);
                     const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "SAL_Evidencias");
                     XLSX.writeFile(wb, "SAL_Relatorio_Evidencias.xlsx");
                   }} className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">
                     <FileDown size={16} /> EXCEL
                   </button>
                </div>
             </div>
             <div className="overflow-x-auto p-10">
                <table className="w-full text-[11px] border-collapse">
                   <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                      <tr>
                         <th className="px-6 py-5 border-x border-slate-100">RAZÃO</th>
                         {activeTableTab !== 'razao' && <th className="px-6 py-5 border-x border-slate-100">MATRICULA</th>}
                         <th className="px-6 py-5 border-x border-slate-100 text-center">SOLICITADAS</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-center">REALIZADAS</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-center">NÃO REALIZADAS</th>
                         <th className="px-6 py-5 border-x border-slate-100 text-right font-black">INDICADOR</th>
                      </tr>
                   </thead>
                   <tbody>
                      {paginatedData.map((row, idx) => (
                         <tr key={idx} className={`${row.indicador >= 90 ? 'bg-[#166534] text-white' : row.indicador >= 70 ? 'bg-[#854d0e] text-white' : 'bg-[#991b1b] text-white'} border-b border-white/10 hover:brightness-110 transition-all`}>
                            <td className="px-6 py-4 border-x border-white/5 font-black uppercase truncate max-w-[200px]">{row.rz}</td>
                            {activeTableTab !== 'razao' && <td className="px-6 py-4 border-x border-white/5 font-bold">{row.matr}</td>}
                            <td className="px-6 py-4 text-center border-x border-white/5 font-bold">{row.solicitadas.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center border-x border-white/5 font-bold">{row.realizadas.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center border-x border-white/5 font-bold">{row.nao_realizadas.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right border-x border-white/5 font-black text-[13px] italic">{row.indicador.toFixed(2)}%</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             <div className="px-10 py-6 border-t flex items-center justify-between bg-slate-50/50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-4">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-600 transition-all disabled:opacity-30"><ChevronLeft size={18}/></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-600 transition-all disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
             </div>
          </section>

          <section className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm"><BarChart3 size={24} /></div>
                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight italic leading-none">
                    Visualização Grafica dos Resultados
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Módulo de Performance</p>
                </div>
              </div>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                 <button onClick={() => setActiveChartTab('mes')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChartTab === 'mes' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Mês</button>
                 <button onClick={() => setActiveChartTab('razao')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChartTab === 'razao' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Razão</button>
                 <button onClick={() => setActiveChartTab('matr')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChartTab === 'matr' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Matricula</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-8 mb-10 px-8 py-5 bg-slate-50/70 rounded-[2rem] border border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Legenda de Performance:</span>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-md bg-[#166534] shadow-sm"></div>
                <span className="text-[10px] font-black text-slate-700 uppercase">Bom (≥ 90%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-md bg-[#854d0e] shadow-sm"></div>
                <span className="text-[10px] font-black text-slate-700 uppercase">Médio (70-89%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-md bg-[#991b1b] shadow-sm"></div>
                <span className="text-[10px] font-black text-slate-700 uppercase">Ruim (&lt; 70%)</span>
              </div>
            </div>

            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip content={<CustomChartTooltip />} cursor={{fill: '#f8fafc', radius: 12}} />
                  <Legend iconType="circle" />
                  <Bar dataKey="nre" name="Não Realizadas" barSize={40} radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => {
                      let color = '#991b1b';
                      if (entry.ind >= 90) color = '#166534';
                      else if (entry.ind >= 70) color = '#854d0e';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                    <LabelList 
                      dataKey="ind" 
                      position="top" 
                      formatter={(v: number) => `${v.toFixed(2)}%`} 
                      style={{ fill: '#0f172a', fontSize: '11px', fontWeight: '900' }} 
                      offset={15} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-16 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8 border border-slate-100">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-50 border-t-indigo-600 animate-spin"></div>
                <Loader2 size={32} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
             </div>
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Análise de Evidências</h2>
               <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.5em] mt-3 animate-pulse">Sincronizando Dataset ({fetchProgress.toLocaleString()} registros)...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
