
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRADO, 
  RPC_GET_ANOS_SIMPLES,
  RPC_GET_MATRICULAS_SIMPLES,
  RPC_GET_MESES_POR_ANO,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, FileSpreadsheet, ChevronLeft, ChevronRight, 
  Activity, Check, ChevronDown, 
  Zap, Camera, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
}

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
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initial Load: Years and Matriculas
  useEffect(() => {
    const loadInitialFilters = async () => {
      try {
        const [anosRes, matrRes] = await Promise.all([
          supabase.rpc(RPC_GET_ANOS_SIMPLES),
          supabase.rpc(RPC_GET_MATRICULAS_SIMPLES)
        ]);

        const normalize = (raw: any[]) => (raw || []).map(i => {
          const val = typeof i === 'object' ? (i.valor || i.Ano || i.mes || i.rz || i.matr || '') : String(i);
          return { valor: String(val), label: String(val) };
        }).filter(o => o.valor && o.valor !== 'null');

        setOptions(prev => ({ 
          ...prev, 
          anos: normalize(anosRes.data).sort((a, b) => Number(b.valor) - Number(a.valor)),
          matriculas: normalize(matrRes.data).sort((a, b) => a.label.localeCompare(b.label))
        }));
      } catch (err) {
        console.error("Erro ao carregar filtros iniciais:", err);
      }
    };
    loadInitialFilters();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dynamic Months logic: Fetch months based on selected Year
  useEffect(() => {
    const fetchMeses = async () => {
      if (!filterAno) {
        setOptions(prev => ({ ...prev, meses: [] }));
        setFilterMeses([]);
        return;
      }

      setLoadingMonths(true);
      try {
        const { data: res, error } = await supabase.rpc(RPC_GET_MESES_POR_ANO, { p_ano: Number(filterAno) });
        if (error) throw error;

        // Ensure we only show months that actually exist in the DB for that year (RPC usually handles this)
        const months = (res || []).map((i: any) => {
          const val = typeof i === 'object' ? (i.valor || i.label || i.mes || '') : String(i);
          return { valor: String(val), label: String(val) };
        }).filter((o: any) => o.valor)
        .sort((a: any, b: any) => (MONTH_ORDER[a.valor] || 0) - (MONTH_ORDER[b.valor] || 0));

        setOptions(prev => ({ ...prev, meses: months }));
        // Clean up selected months that might not exist for the new year
        setFilterMeses(prev => prev.filter(m => months.some((opt: any) => opt.valor === m)));
      } catch (err) {
        console.error("Erro ao carregar meses dinâmicos:", err);
        setOptions(prev => ({ ...prev, meses: [] }));
      } finally {
        setLoadingMonths(false);
      }
    };
    fetchMeses();
  }, [filterAno]);

  const handleGenerate = async () => {
    if (!filterAno || filterMeses.length === 0) return;

    // Validation: UL DE <= UL PARA (If both are filled)
    if (filterUlDe && filterUlPara && Number(filterUlDe) > Number(filterUlPara)) {
      alert("Erro: O campo 'UL DE' não pode ser maior que o campo 'UL PARA'.");
      return;
    }

    setLoading(true);
    setHasGenerated(false);
    setData([]);

    try {
      const { data: res, error } = await supabase.rpc(RPC_CE_FILTRADO, {
        p_ano_inicial: Number(filterAno),
        p_ano_final: Number(filterAno),
        p_meses: filterMeses.join(','),
        p_matr: filterMatr || null,
        p_ul_de: filterUlDe ? Number(filterUlDe) : null,
        p_ul_para: filterUlPara ? Number(filterUlPara) : null
      });

      if (error) throw error;

      const formattedData = (res || []).map((item: any) => ({
        ...item,
        indicador: Number(item.indicador) || 0
      })).sort((a: any, b: any) => b.indicador - a.indicador);

      setData(formattedData);
      setHasGenerated(true);
      setCurrentPage(1);
    } catch (err: any) {
      console.error("Erro na auditoria:", err);
      alert(`Erro ao processar auditoria: ${err.message}`);
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
    setData([]);
    setHasGenerated(false);
    setCurrentPage(1);
  };

  const totals = useMemo(() => {
    return data.reduce((acc, c) => ({
      sol: acc.sol + (Number(c.solicitadas) || 0),
      rea: acc.rea + (Number(c.realizadas) || 0),
      nre: acc.nre + (Number(c.nao_realizadas) || 0)
    }), { sol: 0, rea: 0, nre: 0 });
  }, [data]);

  const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;

  const getIndicatorColor = (indicador: number) => {
    if (indicador >= 50) return 'bg-[#991b1b] text-white'; // Red
    if (indicador >= 41) return 'bg-[#d97706] text-white'; // Amber/Orange
    return 'bg-[#166534] text-white'; // Green
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Search Section */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20"><Filter size={20} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">CONTROLE DE EVIDÊNCIAS v9.0</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Dataset Estrutural</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ANO</label>
            <select 
              value={filterAno} 
              onChange={e => setFilterAno(e.target.value)} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all"
            >
              <option value="">Selecione o Ano</option>
              {options.anos.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-2.5 relative" ref={dropdownRef}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MÊS (MULTI)</label>
            <button 
              type="button" 
              disabled={!filterAno || loadingMonths}
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} 
              className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold flex items-center justify-between hover:border-indigo-600 transition-all ${!filterAno ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="truncate">
                {loadingMonths ? "Carregando..." : filterMeses.length === 0 ? "Selecionar Mês" : `${filterMeses.length} Selecionados`}
              </span>
              {loadingMonths ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <ChevronDown size={18} />}
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2 custom-scrollbar">
                {options.meses.length > 0 ? (
                  <>
                    <div 
                      onClick={() => {
                        if (filterMeses.length === options.meses.length) setFilterMeses([]);
                        else setFilterMeses(options.meses.map(o => o.valor));
                      }}
                      className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest"
                    >
                      {filterMeses.length === options.meses.length ? "Desmarcar Todos" : "Selecionar Todos"}
                    </div>
                    <div className="h-px bg-slate-100 my-1 mx-2" />
                    {options.meses.map(o => {
                      const isSel = filterMeses.includes(o.valor);
                      return (
                        <div key={o.valor} onClick={() => setFilterMeses(p => isSel ? p.filter(v => v !== o.valor) : [...p, o.valor])} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-0.5 ${isSel ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                          <span className="text-xs uppercase font-bold">{o.label}</span>
                          {isSel && <Check size={14} className="text-indigo-600" />}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-400">
                    <AlertCircle size={24} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum mês disponível</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MATRÍCULA</label>
            <select 
              value={filterMatr} 
              onChange={e => setFilterMatr(e.target.value)} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all"
            >
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL DE</label>
            <input 
              type="text" 
              value={filterUlDe} 
              maxLength={8}
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-black focus:border-indigo-600 outline-none" 
              placeholder="0"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">UL PARA</label>
            <input 
              type="text" 
              value={filterUlPara} 
              maxLength={8}
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-black focus:border-indigo-600 outline-none" 
              placeholder="99999"
            />
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-4">
          <button 
            onClick={handleGenerate} 
            disabled={loading || !filterAno || filterMeses.length === 0} 
            className={`px-24 py-5 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-20 ${filterAno && filterMeses.length > 0 ? 'bg-indigo-600' : 'bg-slate-900'}`}
          >
            {loading ? <Activity className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />}
            PROCESSAR AUDITORIA
          </button>
          <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
            <RefreshCw size={14} /> RESET
          </button>
        </div>
      </section>

      {/* Results Section */}
      {hasGenerated && data.length > 0 && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Dataset Auditado" value={totals.sol.toLocaleString()} color="blue" />
            <IndicatorCard label="Evidências Confirmadas" value={totals.rea.toLocaleString()} color="green" />
            <IndicatorCard label="Distorções Críticas" value={totals.nre.toLocaleString()} color="red" />
            <IndicatorCard label="Performance Final" value={(totals.sol > 0 ? (totals.rea / totals.sol) * 100 : 0).toFixed(2).replace('.', ',')} suffix="%" color="amber" />
          </div>

          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3">
                <Camera size={20} className="text-indigo-600" />
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight italic">Relatório Analítico de Evidências</h3>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(data);
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
                  XLSX.writeFile(wb, `SAL_Auditoria_${filterAno}.xlsx`);
                }} className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all">
                  <FileSpreadsheet size={16}/> EXCEL
                </button>
                <span className="text-[10px] font-black bg-slate-100 px-4 py-2 rounded-full uppercase text-slate-500 tracking-widest">
                  {data.length} registros
                </span>
              </div>
            </div>
            <div className="overflow-x-auto p-10">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[9px] border-b">
                  <tr>
                    <th className="px-6 py-5 text-center border-r border-slate-200">MÊS/ANO</th>
                    <th className="px-6 py-5 text-left border-r border-slate-200">RAZÃO SOCIAL</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">UL</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">SOL.</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">REA.</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">MATRÍCULA</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">CÓD.</th>
                    <th className="px-6 py-5 text-right font-black">INDICADOR (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getIndicatorColor(row.indicador)} hover:brightness-110 transition-all`}>
                      <td className="px-6 py-4 text-center border-r border-white/10 uppercase font-bold">{row.mes}/{row.ano}</td>
                      <td className="px-6 py-4 text-left border-r border-white/10 uppercase font-black truncate max-w-[200px]">{row.rz}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-mono">{row.ul}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-bold">{row.solicitadas}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-bold">{row.realizadas}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10">{row.matr}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-bold">{row.nl}</td>
                      <td className="px-6 py-4 text-right font-black text-[13px] italic">{row.indicador.toFixed(2).replace('.', ',')}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-10 py-6 border-t flex items-center justify-between bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
              <div className="flex gap-3">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-600 disabled:opacity-30 transition-all"><ChevronLeft size={18} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-600 disabled:opacity-30 transition-all"><ChevronRight size={18} /></button>
              </div>
            </div>
          </section>
        </div>
      )}

      {hasGenerated && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 bg-white border-2 border-dashed border-slate-200 rounded-[3rem] text-center">
          <AlertCircle className="text-slate-200 mb-6" size={80} />
          <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest italic">Nenhum Registro Localizado</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Tente ajustar os parâmetros de busca para o período selecionado.</p>
        </div>
      )}

      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-200 rounded-[3rem] bg-white text-center">
          <Activity className="text-slate-100 mb-6" size={80} />
          <h3 className="text-lg font-black text-slate-300 uppercase tracking-[0.4em] italic">Auditoria Aguardando Parâmetros</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Selecione Ano e Mês para materializar a matriz de auditoria</p>
        </div>
      )}

      {(loading || loadingMonths) && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 border border-slate-100">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-indigo-600 animate-spin"></div>
                 <Loader2 size={44} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Materializando Auditoria</h2>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.5em] mt-4 animate-pulse">Sincronizando Dataset v9.0...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
