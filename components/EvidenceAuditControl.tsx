import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRADO, 
  RPC_GET_ANOS_SIMPLES,
  RPC_GET_MESES_DISTINCT,
  RPC_GET_MATRICULAS_SIMPLES
} from '../constants';
import { 
  Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, 
  Database, Activity, Check, ChevronDown, AlertTriangle, 
  Zap, RotateCcw, Camera,
  ShieldCheck, Calendar, MapPin, Loader2
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
  CorIndicador?: string;
}

interface SimpleOption {
  valor: string;
  label: string;
}

const EvidenceAuditControl: React.FC = () => {
  // --- Estados dos Filtros ---
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  // --- Estados das Opções ---
  const [options, setOptions] = useState<{ anos: SimpleOption[], meses: SimpleOption[], matriculas: SimpleOption[] }>({
    anos: [], meses: [], matriculas: []
  });

  // --- Estados de Dados e UI ---
  const [data, setData] = useState<EvidenciaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Carregamento de Metadados via RPCs ---
  useEffect(() => {
    const fetchFilters = async () => {
      setLoadingFilters(true);
      try {
        const [resAnos, resMeses, resMatr] = await Promise.all([
          supabase.rpc(RPC_GET_ANOS_SIMPLES),
          supabase.rpc(RPC_GET_MESES_DISTINCT),
          supabase.rpc(RPC_GET_MATRICULAS_SIMPLES)
        ]);

        setOptions({
          anos: (resAnos.data || []).filter((o: any) => o.valor && o.valor !== '#N/D'),
          meses: (resMeses.data || []).filter((o: any) => o.valor && o.valor !== '#N/D'),
          matriculas: (resMatr.data || []).filter((o: any) => o.valor && o.valor !== '#N/D')
        });
      } catch (err) {
        console.error("Erro ao carregar filtros:", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFilters();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Validação Operacional ---
  const ulDeVal = filterUlDe !== '' ? Number(filterUlDe) : null;
  const ulParaVal = filterUlPara !== '' ? Number(filterUlPara) : null;
  const isUlIntervalValid = !(ulDeVal !== null && ulParaVal !== null && ulDeVal > ulParaVal);
  
  const isFiltersValid = 
    filterAno !== '' && 
    filterMeses.length > 0 && 
    isUlIntervalValid;

  const handleGenerate = async () => {
    if (!isFiltersValid) return;

    setLoading(true);
    setCurrentPage(1);

    try {
      const payload = {
        p_ano_inicial: Number(filterAno),
        p_ano_final: Number(filterAno),
        p_meses: filterMeses.join(','), 
        p_matr: filterMatr || null,
        p_ul_de: ulDeVal,
        p_ul_para: ulParaVal
      };

      const { data: resData, error } = await supabase.rpc(RPC_CE_FILTRADO, payload);

      if (error) throw error;

      setData((resData || []).sort((a: any, b: any) => b.indicador - a.indicador));
      setHasGenerated(true);
    } catch (err: any) {
      console.error("Erro ao gerar auditoria:", err);
      alert(`Falha no processamento: ${err.message || 'Erro de conexão com o banco de dados'}`);
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

  const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;

  const totals = useMemo(() => {
    return data.reduce((acc, curr) => ({
      sol: acc.sol + (Number(curr.solicitadas) || 0),
      rea: acc.rea + (Number(curr.realizadas) || 0),
      nre: acc.nre + (Number(curr.nao_realizadas) || 0)
    }), { sol: 0, rea: 0, nre: 0 });
  }, [data]);

  const getRowStyle = (row: EvidenciaRecord) => {
    const ind = row.indicador;
    if (ind >= 50 || row.CorIndicador === 'vermelho-escuro') return "bg-[#991b1b] text-white";
    if (ind >= 41 || row.CorIndicador === 'amarelo-escuro') return "bg-[#d97706] text-white";
    return "bg-[#166534] text-white";
  };

  const exportExcel = () => {
    const dataToExport = data.map(r => ({
      "MÊS": r.mes.toUpperCase(),
      "ANO": r.ano,
      "RAZÃO SOCIAL": r.rz,
      "UL": r.ul,
      "SOLICITADAS": r.solicitadas,
      "REALIZADAS": r.realizadas,
      "NÃO REALIZADAS": r.nao_realizadas,
      "MATRÍCULA": r.matr,
      "CÓDIGO": r.nl,
      "LEITURA": r.l_atual,
      "INDICADOR (%)": `${r.indicador.toFixed(2).replace('.', ',')}%`
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ControleEvidencias");
    XLSX.writeFile(wb, `SAL_Controle_Evidencias_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {/* --- SEÇÃO DE FILTROS --- */}
      <section className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-900/10">
            <Filter size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Filtros de Auditoria</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Dataset V9.0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {/* ANO (OBRIGATÓRIO) */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Calendar size={12} className="text-blue-600" /> ANO <span className="text-red-500">*</span>
            </label>
            <select 
              value={filterAno} 
              onChange={e => setFilterAno(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer hover:bg-white"
            >
              <option value="">Selecione</option>
              {options.anos.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          {/* MÊS (MULTI - OBRIGATÓRIO) */}
          <div className="space-y-2.5 relative" ref={dropdownRef}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Calendar size={12} className="text-blue-600" /> MÊS (MÚLTIPLO) <span className="text-red-500">*</span>
            </label>
            <button 
              type="button"
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold flex items-center justify-between hover:border-blue-600 hover:bg-white transition-all"
            >
              <span className="truncate">{filterMeses.length === 0 ? "Selecionar" : `${filterMeses.length} Selecionados`}</span>
              <ChevronDown size={18} className={`transition-transform ${isMonthDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2 animate-in fade-in slide-in-from-top-1 duration-200">
                {options.meses.map(o => {
                  const isSelected = filterMeses.includes(o.valor);
                  return (
                    <div 
                      key={o.valor} 
                      onClick={() => setFilterMeses(prev => isSelected ? prev.filter(v => v !== o.valor) : [...prev, o.valor])}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-0.5 ${isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <span className="text-xs uppercase font-bold">{o.label}</span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
                        {isSelected && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* MATRÍCULA (OPCIONAL) */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <ShieldCheck size={12} className="text-blue-600" /> MATRÍCULA
            </label>
            <select 
              value={filterMatr} 
              onChange={e => setFilterMatr(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all cursor-pointer hover:bg-white"
            >
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          {/* UL DE (OPCIONAL) */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <MapPin size={12} className="text-blue-600" /> UL DE
            </label>
            <input 
              type="text" 
              maxLength={8}
              placeholder="Opcional"
              value={filterUlDe}
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-black focus:border-blue-600 outline-none transition-all hover:bg-white"
            />
          </div>

          {/* UL PARA (OPCIONAL) */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <MapPin size={12} className="text-blue-600" /> UL PARA
            </label>
            <input 
              type="text" 
              maxLength={8}
              placeholder="Opcional"
              value={filterUlPara}
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className={`w-full bg-slate-50 border-2 rounded-2xl py-4 px-5 text-sm font-black focus:border-blue-600 outline-none transition-all hover:bg-white ${!isUlIntervalValid ? 'border-red-500' : 'border-slate-100'}`}
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-6">
          {!isUlIntervalValid && (
            <p className="text-red-500 text-[10px] font-bold uppercase flex items-center gap-2">
              <AlertTriangle size={14} /> Erro: UL DE não pode ser maior que UL PARA
            </p>
          )}
          
          <div className="flex gap-4">
            <button 
              onClick={handleGenerate} 
              disabled={loading || !isFiltersValid}
              className="px-20 py-5 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-950/20 disabled:opacity-20"
            >
              {loading ? <Activity className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />}
              GERAR RELATÓRIO
            </button>
            <button 
              onClick={handleReset} 
              className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              <RotateCcw size={16} /> RESET
            </button>
          </div>
        </div>
      </section>

      {/* --- RESULTADOS --- */}
      {hasGenerated && (
        <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Solicitadas" value={totals.sol.toLocaleString()} color="blue" />
            <IndicatorCard label="Realizadas" value={totals.rea.toLocaleString()} color="green" />
            <IndicatorCard label="Não Realizadas" value={totals.nre.toLocaleString()} color="red" />
            <IndicatorCard label="Eficiência" value={(totals.sol > 0 ? (totals.rea / totals.sol) * 100 : 0).toFixed(2).replace('.', ',')} suffix="%" color="amber" />
          </div>

          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-3">
                <Camera size={20} className="text-blue-600" /> Detalhamento de Evidências
              </h3>
              <div className="flex gap-3">
                <button onClick={exportExcel} className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all">
                  <FileSpreadsheet size={16}/> EXPORTAR EXCEL
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all shadow-lg">
                  <FileText size={16}/> IMPRIMIR PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto p-10">
              <table className="w-full text-[10.5px] border-collapse">
                <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-wider text-[9px] border-b">
                  <tr>
                    <th className="px-6 py-5 text-center border-r border-slate-200">MÊS</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">ANO</th>
                    <th className="px-6 py-5 text-left border-r border-slate-200">RAZÃO SOCIAL</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">UL</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">SOL.</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">REA.</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">N.REA.</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">MATRÍCULA</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">CÓD.</th>
                    <th className="px-6 py-5 text-center border-r border-slate-200">LEITURA</th>
                    <th className="px-6 py-5 text-right font-black">INDICADOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getRowStyle(row)} transition-colors hover:brightness-110`}>
                      <td className="px-6 py-4 text-center border-r border-white/10 uppercase font-bold">{row.mes}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10">{row.ano}</td>
                      <td className="px-6 py-4 text-left border-r border-white/10 uppercase font-black truncate max-w-[200px]">{row.rz}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-mono font-bold">{row.ul}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-bold">{row.solicitadas}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-bold">{row.realizadas}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 opacity-80">{row.nao_realizadas}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-mono">{row.matr}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-bold">{row.nl}</td>
                      <td className="px-6 py-4 text-center border-r border-white/10 font-black">{row.l_atual}</td>
                      <td className="px-6 py-4 text-right font-black text-[12px]">{row.indicador.toFixed(2).replace('.', ',')}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-10 py-6 border-t flex items-center justify-between bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
              <div className="flex gap-3">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-600 disabled:opacity-30 transition-all">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-600 disabled:opacity-30 transition-all">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ESTADO VAZIO */}
      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white border-2 border-dashed border-slate-200 rounded-[4rem] text-center">
          <Database size={80} className="text-slate-100 mb-8" />
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Sincronização Requerida</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-4 max-w-sm">Configure o Ano e o(s) Mês(es) para processar o dataset de evidências.</p>
        </div>
      )}

      {/* OVERLAY DE CARREGAMENTO */}
      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-20 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8">
             <Loader2 className="animate-spin text-blue-600" size={48} />
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Materializando Dataset</h2>
               <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.5em] mt-3 animate-pulse">Consultando Matriz de Dados V9...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;