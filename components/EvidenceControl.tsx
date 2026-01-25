
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_TIPO_V9
} from '../constants';
import { 
  Filter, RotateCcw, Loader2, Database, 
  Layout, Calendar, ChevronLeft, ChevronRight, Zap,
  Activity, CheckCircle2
} from 'lucide-react';
// Import IndicatorCard to fix "Cannot find name 'IndicatorCard'" error
import IndicatorCard from './IndicatorCard';

const ITEMS_PER_PAGE = 20;

const MONTH_MAP: Record<string, number> = {
  "JANEIRO": 1, "FEVEREIRO": 2, "MARÇO": 3, "ABRIL": 4, "MAIO": 5, "JUNHO": 6,
  "JULHO": 7, "AGOSTO": 8, "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12
};

const EvidenceControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as { label: string, value: string }[]
  });

  // Tabela Técnica (Materialização do Dataset Base)
  const [technicalBase, setTechnicalBase] = useState<any[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  // Extração robusta (Case-Insensitive)
  const safeGet = (obj: any, keys: string[]) => {
    if (!obj) return '';
    const foundKey = Object.keys(obj).find(k => keys.includes(k.toLowerCase()));
    return foundKey ? String(obj[foundKey]).trim() : '';
  };

  useEffect(() => {
    const fetchInitialMetadata = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        const anos = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));
        const mesesRaw = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase());
        const mesesUnicos = Array.from(new Set(mesesRaw))
          .filter((m: string) => !!MONTH_MAP[m])
          .sort((a: string, b: string) => (MONTH_MAP[a] || 0) - (MONTH_MAP[b] || 0))
          .map(m => ({ label: m, value: m }));
        setOptions({ anos, meses: mesesUnicos });
      } catch (err) {
        console.error("Erro metadados:", err);
      }
    };
    fetchInitialMetadata();
  }, []);

  // Materialização da Tabela Técnica após seleção de Mês/Ano
  const handleSincronizarBaseTecnica = async () => {
    if (!filterAno || !filterMes) return;
    setLoadingBase(true);
    try {
      const { data, error } = await supabase.rpc(RPC_CE_TIPO_V9, { 
        p_ano: Number(filterAno), 
        p_mes: filterMes 
      });
      if (error) throw error;
      setTechnicalBase(data || []);
      setReportReady(false); // Reset do relatório visível
    } catch (err) {
      setTechnicalBase([]);
    } finally {
      setLoadingBase(false);
    }
  };

  useEffect(() => {
    if (filterAno && filterMes) {
      handleSincronizarBaseTecnica();
    }
  }, [filterAno, filterMes]);

  // Filtros dinâmicos derivados da Tabela Técnica Materializada
  const dynamicOptions = useMemo(() => {
    const rzKeys = ['rz', 'razao', 'razao_social'];
    const mtKeys = ['matr', 'matricula'];
    const razoes = Array.from(new Set(technicalBase.map(i => safeGet(i, rzKeys)))).filter(Boolean).sort();
    const matriculas = Array.from(new Set(technicalBase.map(i => safeGet(i, mtKeys)))).filter(Boolean).sort();
    return { razoes, matriculas };
  }, [technicalBase]);

  const handleGerarRelatorio = () => {
    if (technicalBase.length === 0) return;
    setLoadingReport(true);
    setTimeout(() => {
      setReportReady(true);
      setCurrentPage(1);
      setLoadingReport(false);
    }, 400);
  };

  const handleReset = () => {
    setFilterAno('');
    setFilterMes('');
    setFilterMatr('');
    setFilterRazao('');
    setTechnicalBase([]);
    setReportReady(false);
    setCurrentPage(1);
  };

  const processedData = useMemo(() => {
    const rzKeys = ['rz', 'razao', 'razao_social'];
    const mtKeys = ['matr', 'matricula'];
    return technicalBase.filter(item => {
      const matchRz = !filterRazao || safeGet(item, rzKeys) === filterRazao;
      const matchMatr = !filterMatr || safeGet(item, mtKeys) === filterMatr;
      return matchRz && matchMatr;
    }).map(item => {
      const sol = Number(item.solicitadas) || 0;
      const rea = Number(item.realizadas) || 0;
      return { 
        ...item, 
        indicador: sol > 0 ? (rea / sol) * 100 : 0,
        razao_display: safeGet(item, rzKeys) || 'N/A',
        matr_display: safeGet(item, mtKeys) || 'N/A'
      };
    }).sort((a, b) => a.indicador - b.indicador);
  }, [technicalBase, filterRazao, filterMatr]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedData.slice(start, start + ITEMS_PER_PAGE);
  }, [processedData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE));

  const totals = useMemo(() => {
    const sol = processedData.reduce((acc, c) => acc + (Number(c.solicitadas) || 0), 0);
    const rea = processedData.reduce((acc, c) => acc + (Number(c.realizadas) || 0), 0);
    return { sol, rea, pnd: Math.max(0, sol - rea), ind: sol > 0 ? (rea / sol) * 100 : 0 };
  }, [processedData]);

  return (
    <div className="space-y-10 pb-40">
      {/* 1. TABELA TÉCNICA (OCULTA) - Suporte à Materialização de Filtros */}
      <div id="technical-base-materialization" aria-hidden="true" className="hidden sr-only">
        <table>
          <thead><tr><th>RZ</th><th>MATR</th></tr></thead>
          <tbody>
            {technicalBase.map((row, i) => (
              <tr key={i}>
                <td>{safeGet(row, ['rz', 'razao'])}</td>
                <td>{safeGet(row, ['matr', 'matricula'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. FILTROS DE AUDITORIA */}
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Filter size={20} /></div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tighter italic">Filtros de Auditoria v9</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Base Técnica</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">1. Ano</label>
            <select value={filterAno} onChange={(e) => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all">
              <option value="">Selecione</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">2. Mês</label>
            <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all">
              <option value="">Selecione</option>
              {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">3. Razão Social</label>
            <select 
              value={filterRazao} 
              onChange={(e) => setFilterRazao(e.target.value)} 
              disabled={loadingBase || technicalBase.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all disabled:opacity-30"
            >
              <option value="">{loadingBase ? "Sincronizando..." : technicalBase.length > 0 ? "Todas as Razões" : "Aguardando Mês/Ano..."}</option>
              {dynamicOptions.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">4. Matrícula</label>
            <select 
              value={filterMatr} 
              onChange={(e) => setFilterMatr(e.target.value)} 
              disabled={loadingBase || technicalBase.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold focus:border-blue-600 outline-none transition-all disabled:opacity-30"
            >
              <option value="">{loadingBase ? "Sincronizando..." : technicalBase.length > 0 ? "Todas as Matrículas" : "Aguardando Mês/Ano..."}</option>
              {dynamicOptions.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          {loadingBase && (
            <div className="flex items-center gap-2 text-blue-600 font-black text-[9px] uppercase animate-pulse">
              <Activity size={14} className="animate-spin" /> Materializando Dataset Técnico...
            </div>
          )}
          {!loadingBase && technicalBase.length > 0 && (
            <div className="flex items-center gap-2 text-green-600 font-black text-[9px] uppercase">
              <CheckCircle2 size={14} /> Base Técnica Sincronizada ({technicalBase.length} registros)
            </div>
          )}
          <div className="flex justify-center gap-6">
            <button 
              onClick={handleGerarRelatorio} 
              disabled={loadingBase || technicalBase.length === 0} 
              className="px-20 py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-20"
            >
              {loadingReport ? <Loader2 className="animate-spin" size={18} /> : <Zap size={16} fill="currentColor" />}
              PROCESSAR AUDITORIA
            </button>
            <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all">
              <RotateCcw size={14} /> LIMPAR
            </button>
          </div>
        </div>
      </section>

      {/* 3. RELATÓRIO VISÍVEL */}
      {reportReady && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Solicitadas" value={totals.sol.toLocaleString('pt-BR')} color="blue" />
            <IndicatorCard label="Realizadas" value={totals.rea.toLocaleString('pt-BR')} color="green" />
            <IndicatorCard label="Não Realizadas" value={totals.pnd.toLocaleString('pt-BR')} color="red" />
            <IndicatorCard label="Eficiência" value={totals.ind.toFixed(2).replace('.', ',')} suffix="%" color="amber" />
          </div>

          <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  Relação Analítica Materializada
                </h3>
                <span className="text-[9px] font-black bg-slate-100 px-4 py-2 rounded-full uppercase text-slate-500 tracking-widest">Visualizando {processedData.length} registros</span>
             </div>
             <div className="overflow-x-auto p-10">
                <table className="w-full text-left text-[11px] border-collapse">
                   <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                      <tr>
                         <th className="px-6 py-4 border border-slate-200">Mês</th>
                         <th className="px-6 py-4 border border-slate-200">Ano</th>
                         <th className="px-6 py-4 border border-slate-200">Razão</th>
                         <th className="px-6 py-4 border border-slate-200">Matrícula</th>
                         <th className="px-6 py-4 border border-slate-200 text-center">Solicitadas</th>
                         <th className="px-6 py-4 border border-slate-200 text-center">Realizadas</th>
                         <th className="px-6 py-4 border border-slate-200 text-center font-black">Indicador (%)</th>
                      </tr>
                   </thead>
                   <tbody>
                      {paginatedData.map((row, idx) => (
                         <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 border border-slate-200 uppercase">{row.mes}</td>
                            <td className="px-6 py-4 border border-slate-200">{row.ano}</td>
                            <td className="px-6 py-4 border border-slate-200 font-bold">{row.razao_display}</td>
                            <td className="px-6 py-4 border border-slate-200 font-mono">{row.matr_display}</td>
                            <td className="px-6 py-4 border border-slate-200 text-center">{Number(row.solicitadas).toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 border border-slate-200 text-center">{Number(row.realizadas).toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 border border-slate-200 text-center font-black">{row.indicador.toFixed(2).replace('.', ',')}%</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             <div className="px-10 py-6 bg-slate-50 flex items-center justify-between border-t">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-2">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border rounded-xl shadow-sm disabled:opacity-30"><ChevronLeft size={16} /></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-3 bg-white border rounded-xl shadow-sm disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
             </div>
          </section>
        </div>
      )}

      {!reportReady && !loadingBase && (
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-200 rounded-[3rem] bg-white text-center">
          <Database className="text-slate-100 mb-6" size={80} />
          <h3 className="text-lg font-black text-slate-300 uppercase tracking-[0.4em] italic">Materialização Pendente</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4">Selecione Mês/Ano para sincronizar a Tabela Técnica de Filtros</p>
        </div>
      )}

      {(loadingBase || loadingReport) && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-6">
             <Loader2 className="animate-spin text-blue-600" size={40} />
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Processamento Estrutural</h2>
               <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.5em] mt-3 animate-pulse">Sincronizando Matriz de Dados v9...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceControl;
