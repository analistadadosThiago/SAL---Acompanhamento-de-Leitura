
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  TABLE_NAME,
  RPC_GET_ANOS_SIMPLES,
  RPC_GET_MATRICULAS_SIMPLES,
  RPC_GET_MESES,
  MONTH_ORDER,
  FALLBACK_MONTHS
} from '../constants';
import { 
  Filter, ChevronLeft, ChevronRight, 
  Activity, Check, ChevronDown, 
  Zap, Camera, Loader2, AlertCircle, RefreshCw,
  Maximize2, Minimize2, FileText, TrendingUp, LayoutList, BarChart3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
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

const EvidenceAuditControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');

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
  const [activeChartTab, setActiveChartTab] = useState<'razao' | 'mes' | 'matr'>('razao');

  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalizeOptions = (raw: any[]) => {
    if (!raw) return [];
    const list = raw.map(i => {
      if (!i) return null;
      const val = typeof i === 'object' 
        ? (i.valor || i.Ano || i.mes || i.rz || i.matr || i.label || i.ano || i.nome || '') 
        : String(i);
      return String(val).trim();
    }).filter(v => v && v !== 'null' && v !== 'undefined');
    
    return Array.from(new Set(list)).map(val => ({ valor: val, label: val }));
  };

  useEffect(() => {
    const loadFilters = async () => {
      setLoadingFilters(true);
      const cached = localStorage.getItem('sal_evidence_filters_cache_v3');
      if (cached) {
        setOptions(JSON.parse(cached));
        setLoadingFilters(false);
      }

      try {
        const [anosRes, matrRes, mesesRes] = await Promise.allSettled([
          supabase.rpc(RPC_GET_ANOS_SIMPLES),
          supabase.rpc(RPC_GET_MATRICULAS_SIMPLES),
          supabase.rpc(RPC_GET_MESES)
        ]);

        let finalAnos: any[] = [];
        let finalMatriculas: any[] = [];
        let finalMeses: any[] = [];

        if (anosRes.status === 'fulfilled' && !anosRes.value.error) finalAnos = normalizeOptions(anosRes.value.data);
        if (matrRes.status === 'fulfilled' && !matrRes.value.error) finalMatriculas = normalizeOptions(matrRes.value.data);
        if (mesesRes.status === 'fulfilled' && !mesesRes.value.error) finalMeses = normalizeOptions(mesesRes.value.data);
        else finalMeses = FALLBACK_MONTHS.map(m => ({ valor: m, label: m }));

        const newOptions = {
          anos: finalAnos.sort((a, b) => Number(b.valor) - Number(a.valor)),
          matriculas: finalMatriculas.sort((a, b) => a.label.localeCompare(b.label)),
          meses: finalMeses.sort((a, b) => (MONTH_ORDER[a.valor] || 0) - (MONTH_ORDER[b.valor] || 0))
        };
        
        setOptions(newOptions);
        localStorage.setItem('sal_evidence_filters_cache_v3', JSON.stringify(newOptions));
      } catch (err) {
        setConnectionError("Falha na carga de filtros.");
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      const step = 1000; // Step reduzido para compatibilidade total com limites de servidor
      let hasMore = true;

      // BUSCA INTEGRAL: Sem limites, até que o servidor retorne 0 registros
      while (hasMore) {
        let query = supabase
          .from(TABLE_NAME)
          .select('Ano, Mes, rz, matr, digitacao, foto, instalacao, rz_ul_lv') 
          .eq('Ano', parseInt(filterAno, 10))
          .in('Mes', filterMeses);
        
        if (filterMatr) query = query.eq('matr', filterMatr);

        query = query.range(from, from + step - 1);

        const { data: batch, error } = await query;
        if (error) throw error;
        
        if (batch && batch.length > 0) {
          allRecords.push(...batch);
          setFetchProgress(allRecords.length);
          
          // Incrementa baseado no que foi efetivamente retornado para não pular dados
          from += batch.length;
          
          // Se o servidor retornou menos do que pedimos, ele PODE ter chegado ao fim,
          // mas para garantir 100%, só paramos quando o retorno for vazio.
        } else {
          hasMore = false;
        }
        
        // Proteção técnica para evitar loops infinitos em caso de erro de rede massivo
        if (from > 5000000) break; 
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
              realizadas: 0,
              uniqueInstalsNaoRealizadas: new Set<string>() 
            };
          }

          if (item.digitacao && Number(item.digitacao) >= 2) {
            groupedMap[key].solicitadas++;
          }
          if (item.foto === 'OK') {
            groupedMap[key].realizadas++;
          }
          if (item.foto === 'N-OK') {
            groupedMap[key].uniqueInstalsNaoRealizadas.add(item.instalacao);
          }
        });

        const formatted: EvidenciaRecord[] = Object.values(groupedMap).map((g: any) => ({
          ...g,
          nao_realizadas: g.uniqueInstalsNaoRealizadas.size,
          indicador: g.solicitadas > 0 ? (g.realizadas / g.solicitadas) * 100 : 0
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
              <h2 className="text-xl font-black text-slate-900 uppercase italic">AUDITORIA DE EVIDÊNCIAS v9.2</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle Integral de Campo - Sem limites de registros</p>
            </div>
          </div>
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all">
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

        <div className="mt-10 flex flex-col md:flex-row justify-center items-center gap-6">
          <button onClick={handleGenerate} disabled={loading} className="px-20 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30 min-w-[320px]">
            {loading ? <RefreshCw className="animate-spin" /> : <Zap size={20} fill="currentColor" />}
            {loading ? 'SINCRONIZANDO...' : 'PROCESSAR AUDITORIA'}
          </button>
          {loading && (
             <div className="flex flex-col items-center">
               <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] animate-pulse">
                 <Loader2 size={16} className="animate-spin"/> {fetchProgress.toLocaleString()} REGISTROS RECUPERADOS
               </div>
               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Sincronizando 100% da base selecionada</p>
             </div>
          )}
        </div>
      </section>

      {hasGenerated && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <IndicatorCard label="Solicitadas" value={totals.sol.toLocaleString()} icon={<FileText size={20}/>} color="blue" />
          <IndicatorCard label="Realizadas" value={totals.rea.toLocaleString()} icon={<Check size={20}/>} color="green" />
          <IndicatorCard label="Não Realizadas (N-OK)" value={totals.nre.toLocaleString()} icon={<AlertCircle size={20}/>} color="red" />
          <IndicatorCard label="Taxa de Desvio" value={totals.ind.toFixed(2).replace('.',',')} suffix="%" icon={<TrendingUp size={20}/>} color="amber" />
        </div>
      )}

      {hasGenerated && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b flex flex-wrap items-center justify-between gap-6 bg-slate-50/30">
               <div className="flex flex-wrap items-center gap-6">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border"><Camera size={24} className="text-indigo-600" /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 tracking-tighter italic">Auditoria Operacional SAL v9.2</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dataset Integral Materializado</p>
                  </div>
                  
                  <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm ml-4">
                      <button onClick={() => { setActiveTableTab('completo'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTableTab === 'completo' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Geral</button>
                      <button onClick={() => { setActiveTableTab('razao'); setCurrentPage(1); }} className={`px-6 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTableTab === 'razao' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Por Razão</button>
                   </div>
               </div>
               <button onClick={() => { 
                  const source = activeTableTab === 'completo' ? data : currentSourceData;
                  const dataToExport = source.map(d => ({
                    "RAZÃO": d.rz,
                    "UL": d.ul,
                    "MATR": d.matr,
                    "SOLICITADAS": d.solicitadas,
                    "REALIZADAS": d.realizadas,
                    "NÃO REALIZADAS": d.nao_realizadas,
                    "TAXA DESVIO (%)": d.indicador.toFixed(2)
                  }));
                  const ws = XLSX.utils.json_to_sheet(dataToExport); 
                  const wb = XLSX.utils.book_new(); 
                  XLSX.utils.book_append_sheet(wb, ws, "Auditoria_Export"); 
                  XLSX.writeFile(wb, `SAL_Auditoria_Integral.xlsx`); 
                }} className="px-6 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-100 transition-all">EXPORTAR EXCEL</button>
            </div>
            
            <div className="overflow-x-auto p-10 max-h-[700px] custom-scrollbar">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4 text-left">RAZÃO</th>
                    <th className="px-6 py-4 text-center">UL</th>
                    <th className="px-6 py-4 text-center">MATR</th>
                    <th className="px-6 py-4 text-center">SOLICITADAS</th>
                    <th className="px-6 py-4 text-center">REALIZADAS</th>
                    <th className="px-6 py-4 text-center">NÃO REALIZADAS</th>
                    <th className="px-6 py-4 text-right font-black">TAXA DESVIO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getIndicatorColor(row.indicador)} transition-all hover:brightness-110`}>
                      <td className="px-6 py-4 text-left font-black uppercase truncate max-w-[250px]">{row.rz}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.ul}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.matr}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.solicitadas.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.realizadas.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center font-bold">{row.nao_realizadas.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-black italic">{row.indicador.toFixed(2).replace('.', ',')}%</td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr><td colSpan={7} className="py-20 text-center font-bold text-slate-400 uppercase tracking-widest">Aguardando processamento integral...</td></tr>
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
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
