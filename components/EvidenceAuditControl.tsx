
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
  FileDown, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
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
      <div className="bg-white p-5 rounded-3xl shadow-2xl border border-slate-100 text-[11px] min-w-[180px]">
        <p className="font-black text-slate-900 mb-3 border-b pb-2 uppercase tracking-tighter">{label}</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-500 uppercase">Solicitadas:</span>
            <span className="text-slate-900 font-black">{data.sol.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold text-green-500 uppercase">Realizadas:</span>
            <span className="text-green-700 font-black">{data.rea.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold text-red-500 uppercase">Não Realizadas:</span>
            <span className="text-red-700 font-black">{data.nre.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t mt-2 flex justify-between items-center">
            <span className="font-bold text-indigo-600 uppercase">Eficiência:</span>
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
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState(0);
  
  const [activeTableTab, setActiveTableTab] = useState<'completo' | 'razao'>('completo');
  const [activeChartTab, setActiveChartTab] = useState<'mes' | 'ano' | 'matr'>('mes');

  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFilters = async () => {
      setLoadingFilters(true);
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
        setConnectionError("Falha na carga rápida de filtros.");
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilters();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleGenerate = async () => {
    setValidationError(null);
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
      const allRecords: any[] = [];
      let from = 0;
      const step = 2000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from(TABLE_NAME)
          .select('Ano, Mes, rz, matr, digitacao, foto, instalacao, rz_ul_lv') 
          .eq('Ano', parseInt(filterAno, 10))
          .in('Mes', filterMeses);
        
        if (filterMatr) query = query.eq('matr', filterMatr);
        if (filterUlDe) query = query.gte('rz_ul_lv', filterUlDe);
        if (filterUlPara) query = query.lte('rz_ul_lv', filterUlPara);

        query = query.range(from, from + step - 1);

        const { data: batch, error } = await query;
        if (error) throw error;
        
        if (batch && batch.length > 0) {
          allRecords.push(...batch);
          setFetchProgress(allRecords.length);
          from += batch.length;
        } else {
          hasMore = false;
        }
        
        if (from > 200000) break; 
      }
      
      if (allRecords.length > 0) {
        const groupedMap: Record<string, any> = {};

        allRecords.forEach(item => {
          const key = `${item.Mes}-${item.Ano}-${item.rz}-${item.matr}-${item.rz_ul_lv}`;
          if (!groupedMap[key]) {
            groupedMap[key] = {
              mes: item.Mes,
              ano: item.Ano,
              rz: item.rz,
              ul: item.rz_ul_lv || 'N/A',
              matr: item.matr,
              solicitadas: 0,
              uniqueInstalsRealizadas: new Set<string>(),
              uniqueInstalsNaoRealizadas: new Set<string>() 
            };
          }

          if (item.digitacao && Number(item.digitacao) >= 2) {
            groupedMap[key].solicitadas++;
          }
          
          if (item.foto === 'OK') {
            groupedMap[key].uniqueInstalsRealizadas.add(item.instalacao);
          } else if (item.foto === 'N-OK') {
            groupedMap[key].uniqueInstalsNaoRealizadas.add(item.instalacao);
          }
        });

        const formatted: EvidenciaRecord[] = Object.values(groupedMap).map((g: any) => ({
          ...g,
          realizadas: g.uniqueInstalsRealizadas.size,
          nao_realizadas: g.uniqueInstalsNaoRealizadas.size,
          indicador: g.solicitadas > 0 ? (g.uniqueInstalsRealizadas.size / g.solicitadas) * 100 : 0
        })).sort((a, b) => a.indicador - b.indicador);

        setData(formatted);
      }
      setHasGenerated(true);
    } catch (err: any) {
      console.error("ERRO INTEGRAL:", err);
      setConnectionError(`Erro de conexão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNovaConsulta = () => {
    setFilterAno('');
    setFilterMeses([]);
    setFilterMatr('');
    setFilterUlDe('');
    setFilterUlPara('');
    setData([]);
    setHasGenerated(false);
    setFetchProgress(0);
    setCurrentPage(1);
    setValidationError(null);
    setConnectionError(null);
  };

  const exportToPDF = () => {
    if (currentSourceData.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const tableData = paginatedData.map(d => [
        d.rz,
        d.matr,
        d.solicitadas.toLocaleString(),
        d.realizadas.toLocaleString(),
        d.nao_realizadas.toLocaleString(),
        `${d.indicador.toFixed(2).replace('.', ',')}%`
      ]);
      
      autoTable(doc, {
        head: [['RAZÃO', 'MATR', 'SOLICITADAS', 'REALIZADAS', 'NÃO REALIZADAS', 'EFICIÊNCIA']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
        margin: { top: 20 },
        didDrawPage: (data) => {
          doc.text("SAL - Relatório Analítico de Evidências", data.settings.margin.left, 10);
        }
      });
      doc.save("SAL_Relatorio_Evidencias.pdf");
    } catch (error) {
      console.error("PDF Error:", error);
    }
  };

  const totals = useMemo(() => {
    if (!data.length) return { sol: 0, rea: 0, nre: 0, ind: 0 };
    const t = data.reduce((acc, c) => ({
      sol: acc.sol + c.solicitadas,
      rea: acc.rea + c.realizadas,
      nre: acc.nre + c.nao_realizadas
    }), { sol: 0, rea: 0, nre: 0 });
    
    return { ...t, ind: t.sol > 0 ? (t.rea / t.sol) * 100 : 0 };
  }, [data]);

  const currentSourceData = useMemo(() => {
    if (activeTableTab === 'completo') return data;
    
    const grouped: Record<string, any> = {};
    data.forEach(item => {
      const key = `${item.mes}-${item.ano}-${item.rz}`;
      if (!grouped[key]) {
        grouped[key] = { ...item, solicitadas: 0, realizadas: 0, nao_realizadas: 0, matr: 'LOTE', ul: 'VÁRIAS' };
      }
      grouped[key].solicitadas += item.solicitadas;
      grouped[key].realizadas += item.realizadas;
      grouped[key].nao_realizadas += item.nao_realizadas;
    });

    return Object.values(grouped).map((g: any) => ({
      ...g,
      indicador: g.solicitadas > 0 ? (g.realizadas / g.solicitadas) * 100 : 0
    })).sort((a, b) => a.indicador - b.indicador);
  }, [data, activeTableTab]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { label: string, sol: number, rea: number, nre: number, ind: number, count: number }> = {};
    
    data.forEach(item => {
      let key = '';
      if (activeChartTab === 'mes') key = item.mes;
      else if (activeChartTab === 'ano') key = String(item.ano);
      else if (activeChartTab === 'matr') key = item.matr;

      if (!grouped[key]) {
        grouped[key] = { label: key, sol: 0, rea: 0, nre: 0, ind: 0, count: 0 };
      }
      grouped[key].sol += item.solicitadas;
      grouped[key].rea += item.realizadas;
      grouped[key].nre += item.nao_realizadas;
      grouped[key].count += 1;
    });

    return Object.values(grouped)
      .map(g => ({
        ...g,
        ind: g.sol > 0 ? (g.rea / g.sol) * 100 : 0
      }))
      .sort((a, b) => {
        if (activeChartTab === 'mes') return (MONTH_ORDER[a.label] || 0) - (MONTH_ORDER[b.label] || 0);
        if (activeChartTab === 'matr') return b.ind - a.ind;
        return Number(b.label) - Number(a.label);
      })
      .slice(0, 15);
  }, [data, activeChartTab]);

  const totalRecords = currentSourceData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ITEMS_PER_PAGE));
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentSourceData.slice(start, start + ITEMS_PER_PAGE);
  }, [currentSourceData, currentPage]);

  const getIndicatorColor = (indicador: number) => {
    if (indicador >= 90) return 'bg-[#166534] text-white';
    if (indicador >= 70) return 'bg-[#854d0e] text-white';
    return 'bg-[#991b1b] text-white';
  };

  return (
    <div className={`space-y-10 pb-20 ${isFullScreen ? 'fixed inset-0 z-[100] bg-[#f8fafc] overflow-y-auto p-10' : 'relative'}`}>
      
      {(connectionError || validationError) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 text-[11px] font-bold uppercase">
          <AlertCircle size={18} /> {connectionError || validationError}
        </div>
      )}

      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20"><Filter size={20} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Selecione os dados a serem Analisados</h2>
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
              <span className="truncate">{filterMeses.length === 0 ? "Selecionar" : `${filterMeses.length} Selecionados`}</span>
              <ChevronDown size={18} />
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute z-[60] top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2 custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
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
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">TÉCNICO</label>
            <select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all">
              <option value="">Todos</option>
              {options.matriculas.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL DE:</label>
            <input 
              type="text" 
              value={filterUlDe} 
              maxLength={8}
              placeholder="Ex: 1000"
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL PARA:</label>
            <input 
              type="text" 
              value={filterUlPara} 
              maxLength={8}
              placeholder="Ex: 2000"
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold focus:border-indigo-600 outline-none transition-all" 
            />
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

          {loading && (
             <div className="flex flex-col items-center">
               <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] animate-pulse">
                 <Loader2 size={16} className="animate-spin"/> {fetchProgress.toLocaleString()} REGISTROS RECUPERADOS
               </div>
             </div>
          )}
        </div>
      </section>

      {hasGenerated && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <IndicatorCard label="Solicitadas" value={totals.sol.toLocaleString()} icon={<FileText size={20}/>} color="blue" />
          <IndicatorCard label="Realizadas (OK)" value={totals.rea.toLocaleString()} icon={<Check size={20}/>} color="green" />
          <IndicatorCard label="Não Realizadas (N-OK)" value={totals.nre.toLocaleString()} icon={<AlertCircle size={20}/>} color="red" />
          <IndicatorCard label="Eficiência de Campo" value={totals.ind.toFixed(2).replace('.',',')} suffix="%" icon={<TrendingUp size={20}/>} color="amber" />
        </div>
      )}

      {hasGenerated && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
               <div className="flex flex-wrap items-center gap-6">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border"><Camera size={24} className="text-indigo-600" /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 tracking-tighter italic">Relação Quantitativa de Dados</h3>
                  </div>
                  
                  <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm ml-4">
                      <button onClick={() => { setActiveTableTab('completo'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTableTab === 'completo' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Geral</button>
                      <button onClick={() => { setActiveTableTab('razao'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTableTab === 'razao' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Por Razão</button>
                   </div>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => { 
                    const source = activeTableTab === 'completo' ? data : currentSourceData;
                    const dataToExport = source.map(d => ({
                      "RAZÃO": d.rz,
                      "MATR": d.matr,
                      "SOLICITADAS": d.solicitadas,
                      "REALIZADAS": d.realizadas,
                      "NÃO REALIZADAS": d.nao_realizadas,
                      "EFICIÊNCIA (%)": d.indicador.toFixed(2)
                    }));
                    const ws = XLSX.utils.json_to_sheet(dataToExport); 
                    const wb = XLSX.utils.book_new(); 
                    XLSX.utils.book_append_sheet(wb, ws, "Auditoria_Export"); 
                    XLSX.writeFile(wb, `SAL_Auditoria_Integral.xlsx`); 
                  }} className="px-6 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-100 transition-all">Exportar Excel</button>
                  
                  <button onClick={exportToPDF} className="px-6 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-2">
                    <FileDown size={14} /> Exportar PDF
                  </button>
               </div>
            </div>
            
            <div className="overflow-x-auto p-10 max-h-[600px] custom-scrollbar">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4 text-left">RAZÃO</th>
                    <th className="px-6 py-4 text-center">MATR</th>
                    <th className="px-6 py-4 text-center">SOLICITADAS</th>
                    <th className="px-6 py-4 text-center">REALIZADAS</th>
                    <th className="px-6 py-4 text-center">NÃO REALIZADAS</th>
                    <th className="px-6 py-4 text-right font-black">EFICIÊNCIA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getIndicatorColor(row.indicador)} transition-all hover:brightness-110`}>
                      <td className="px-6 py-4 text-left font-black uppercase truncate max-w-[250px]">{row.rz}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.matr}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.solicitadas.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.realizadas.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.nao_realizadas.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-black italic">{row.indicador.toFixed(2).replace('.', ',')}%</td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr><td colSpan={6} className="py-20 text-center font-bold text-slate-400 uppercase tracking-widest">Dataset Vazio</td></tr>
                  )}
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
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
                <div className="flex items-center gap-5">
                   <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm"><BarChart3 size={24} /></div>
                   <div>
                      <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight italic leading-none">Análise Gráfica de Performance</h3>
                   </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                   <button onClick={() => setActiveChartTab('mes')} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChartTab === 'mes' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}>Mês</button>
                   <button onClick={() => setActiveChartTab('ano')} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChartTab === 'ano' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}>Ano</button>
                   <button onClick={() => setActiveChartTab('matr')} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChartTab === 'matr' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}>Matr</button>
                </div>
             </div>

             <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip content={<CustomChartTooltip />} cursor={{fill: '#f8fafc', radius: 15}} />
                      <Bar dataKey="ind" name="Eficiência (%)" barSize={50} radius={[15, 15, 0, 0]}>
                         {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.ind >= 90 ? '#166534' : entry.ind >= 70 ? '#b45309' : '#991b1b'} />
                         ))}
                         <LabelList 
                            dataKey="ind" 
                            position="top" 
                            content={(props: any) => {
                                const { x, y, value } = props;
                                return (
                                    <text x={x + 25} y={y - 12} fill="#1e293b" fontSize="11px" fontWeight="900" textAnchor="middle">
                                        {value.toFixed(1)}%
                                    </text>
                                );
                            }}
                         />
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
             
             <div className="mt-10 pt-10 border-t border-slate-100 flex flex-wrap justify-center gap-10">
                <div className="flex items-center gap-3">
                   <div className="h-4 w-4 rounded-full bg-[#166534]"></div>
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Excelente (&gt;90%)</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-4 w-4 rounded-full bg-[#b45309]"></div>
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Atenção (70-90%)</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-4 w-4 rounded-full bg-[#991b1b]"></div>
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Crítico (&lt;70%)</span>
                </div>
             </div>
          </section>
        </div>
      )}

      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-200 rounded-[3rem] bg-white text-center">
          <Activity className="text-slate-100 mb-6" size={80} />
          <h3 className="text-lg font-black text-slate-300 uppercase tracking-[0.4em] italic">Análise Pendente</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 px-20">Aguardando parametrização para materializar o Dataset de Auditoria.</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-16 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8 border border-slate-100">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-50 border-t-indigo-600 animate-spin"></div>
                <Activity size={32} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
             </div>
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Sincronização de Matriz</h2>
               <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.5em] mt-3 animate-pulse">Sincronizando Core v9.0...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
