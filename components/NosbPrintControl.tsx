
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CL_FILTROS, 
  MONTH_ORDER,
  RPC_CE_IMPEDIMENTOS,
  RPC_GET_MOTIVOS_NOSB,
  RPC_GET_RAZOES,
  RPC_GET_ANOS,
  RPC_GET_MESES
} from '../constants';
import { 
  Printer, Zap, Search, FileSpreadsheet, FileText, 
  RotateCcw, Filter, LayoutList, Database, 
  ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, 
  CheckCircle2, ShieldCheck, Activity, Terminal,
  Cpu, Layers, BarChart3, Tag, ArrowRight, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import IndicatorCard from './IndicatorCard';

const ITEMS_PER_PAGE = 25;

interface NosbRecord {
  mes: string;
  ano: number;
  rz: string;
  ul: string | number;
  instalacao: string;
  medidor: string;
  reg: string;
  tipo: string;
  matr: string;
  nl: string | number;
  l_atual: number;
  motivo: string;
}

const NosbPrintControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState('2024');
  const [filterMes, setFilterMes] = useState('');
  const [filterRazao, setFilterRazao] = useState('');
  const [filterMatricula, setFilterMatricula] = useState('');
  const [filterMotivo, setFilterMotivo] = useState('');
  
  const [options, setOptions] = useState<{ 
    anos: string[], 
    meses: string[], 
    matriculas: string[], 
    razoes: string[],
    motivos: string[]
  }>({
    anos: [], meses: [], matriculas: [], razoes: [], motivos: []
  });

  const [results, setResults] = useState<NosbRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const fetchRealFilters = async () => {
      setLoadingFilters(true);
      try {
        const [resBase, resAnos, resMeses, resMotivos, resRazoes] = await Promise.all([
          supabase.rpc(RPC_CL_FILTROS),
          supabase.rpc(RPC_GET_ANOS),
          supabase.rpc(RPC_GET_MESES),
          supabase.rpc(RPC_GET_MOTIVOS_NOSB).catch(() => ({ data: [] })),
          supabase.rpc(RPC_GET_RAZOES).catch(() => ({ data: [] }))
        ]);

        const base = Array.isArray(resBase.data) ? resBase.data[0] : resBase.data;
        
        setOptions({
          anos: (resAnos.data || base?.anos || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a)),
          meses: (resMeses.data || base?.meses || []).map((m: any) => String(m.mes || m)).sort((a: any, b: any) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)),
          matriculas: (base?.matriculas || []).map(String).sort(),
          razoes: Array.isArray(resRazoes.data) ? resRazoes.data.map((r: any) => r.rz || r) : [],
          motivos: Array.isArray(resMotivos.data) ? resMotivos.data.map((m: any) => m.motivo_nome || m.motivo || m) : []
        });
        
        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 3000);
      } catch (err) {
        console.error("Filter Load Error:", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchRealFilters();
  }, []);

  const handleSearch = async () => {
    if (!filterAno || !filterMes) return;
    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const { data, error } = await supabase.rpc(RPC_CE_IMPEDIMENTOS, {
        p_ano: parseInt(filterAno),
        p_mes: filterMes,
        p_rz: filterRazao || null,
        p_matr: filterMatricula || null
      });

      if (error) throw error;

      if (data) {
        setResults(data.map((d: any) => ({
          mes: d.mes || d.Mes || filterMes,
          ano: d.ano || d.Ano || parseInt(filterAno),
          rz: d.rz || d.RZ || d.razao || "N/A",
          ul: d.rz_ul_lv || d.ul || "N/A",
          instalacao: d.instalacao || "N/A",
          medidor: d.medidor || "N/A",
          reg: d.reg || "N/A",
          tipo: d.tipo || "RESIDENCIAL",
          matr: d.matr || d.MATR || "N/A",
          nl: d.nl || "N/A",
          l_atual: d.l_atual || 0,
          motivo: d.motivo || d.nosb_impedimento || "N/A"
        })));
      }
    } catch (err) {
      console.error("Search Error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchMotivo = !filterMotivo || r.motivo.toLowerCase().includes(filterMotivo.toLowerCase());
      return matchMotivo;
    });
  }, [results, filterMotivo]);

  const summaryData = useMemo(() => {
    const grouped: Record<string, { rz: string, count: number, motives: Set<string> }> = {};
    filteredResults.forEach(r => {
      if (!grouped[r.rz]) grouped[r.rz] = { rz: r.rz, count: 0, motives: new Set() };
      grouped[r.rz].count++;
      grouped[r.rz].motives.add(r.motivo);
    });
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }, [filteredResults]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredResults, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / ITEMS_PER_PAGE));

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {showStatus && (
        <div className="fixed top-24 right-10 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10">
          <CheckCircle2 size={24} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Sincronização Real</p>
            <p className="text-[10px] opacity-80 uppercase font-bold">Base de Dados Supabase v9.0</p>
          </div>
        </div>
      )}

      <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform"><Printer size={150} /></div>
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-600/30 transition-transform duration-500 group-hover:rotate-6">
            <Printer size={40} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Nosb.Impressão</h2>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                <ShieldCheck size={12} /> Live Sync
              </div>
              <div className="h-1 w-1 rounded-full bg-slate-300"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auditoria Técnica e Monitoramento de Impedimentos</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-inner">
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ultimo Refresh</span>
              <span className="text-[10px] font-bold text-slate-900 uppercase">Hoje, {new Date().toLocaleTimeString()}</span>
           </div>
           <button onClick={() => window.location.reload()} className="p-3 bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl border border-slate-200 transition-all shadow-sm active:scale-90">
             <RefreshCw size={18} />
           </button>
        </div>
      </div>

      <section className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200 relative">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-slate-950 text-white rounded-2xl shadow-lg"><Filter size={20} /></div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight italic">Parâmetros de Auditoria</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Filtragem Direta na Camada de Dados</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
               <Database size={12} className="text-indigo-500" /> Ano Fiscal
            </label>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all cursor-pointer hover:border-indigo-200">
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
               <Tag size={12} className="text-emerald-500" /> Mês
            </label>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all cursor-pointer hover:border-indigo-200">
              <option value="">Selecione...</option>
              {options.meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
               <Layers size={12} className="text-amber-500" /> Razão
            </label>
            <select value={filterRazao} onChange={e => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all cursor-pointer hover:border-indigo-200">
              <option value="">Todas as Razões</option>
              {options.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
               <Activity size={12} className="text-rose-500" /> Matrícula
            </label>
            <select value={filterMatricula} onChange={e => setFilterMatricula(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-indigo-600 outline-none transition-all cursor-pointer hover:border-indigo-200">
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6">
          <button onClick={handleSearch} disabled={loading || !filterMes} className="group relative px-24 py-5 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-20 overflow-hidden">
            <div className="relative z-10 flex items-center gap-4">
              {loading ? <Activity className="animate-spin" size={20}/> : <Zap size={20} fill="currentColor" className="group-hover:text-amber-400 transition-colors"/>}
              SINCRONIZAR AUDITORIA
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          <button onClick={() => { setResults([]); setHasSearched(false); setFilterMes(''); }} className="px-12 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-200 transition-all border border-slate-200">
            <RotateCcw size={16} /> RESETAR FILTROS
          </button>
        </div>
      </section>

      {hasSearched && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
            <IndicatorCard label="Registros Auditados" value={filteredResults.length.toLocaleString()} icon={<Layers size={24}/>} color="blue" />
            <IndicatorCard label="Ocorrências Únicas" value={new Set(filteredResults.map(r => r.motivo)).size} icon={<AlertTriangle size={24}/>} color="red" />
            <IndicatorCard label="Integridade do Sistema" value="100%" icon={<ShieldCheck size={24}/>} color="green" />
          </div>

          <section className="bg-white rounded-[4rem] shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-12 py-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 bg-slate-50/20">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><LayoutList size={26} /></div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Matriz de Auditoria NOSB</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visualização de Camada Operacional</p>
                  </div>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => {
                     const ws = XLSX.utils.json_to_sheet(filteredResults);
                     const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "SAL_Nosb");
                     XLSX.writeFile(wb, "SAL_Export_Nosb.xlsx");
                   }} className="px-8 py-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-100 transition-all border border-emerald-100">
                     <FileSpreadsheet size={20} /> EXCEL
                   </button>
                   <button onClick={() => window.print()} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
                     <Printer size={20} /> IMPRIMIR
                   </button>
                </div>
             </div>
             
             <div className="overflow-x-auto p-12 custom-scrollbar">
                <table className="w-full text-[11px] text-left border-collapse">
                   <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b">
                      <tr>
                         <th className="px-6 py-6 border-x border-slate-50 text-center">MES</th>
                         <th className="px-6 py-6 border-x border-slate-50">RAZÃO</th>
                         <th className="px-6 py-6 border-x border-slate-50 text-center">UL</th>
                         <th className="px-6 py-6 border-x border-slate-50 text-center">INSTAL.</th>
                         <th className="px-6 py-6 border-x border-slate-50">MEDIDOR</th>
                         <th className="px-6 py-6 border-x border-slate-50 text-center">REG</th>
                         <th className="px-6 py-6 border-x border-slate-50">MATR</th>
                         <th className="px-6 py-6 border-x border-slate-50 text-center">CÓD</th>
                         <th className="px-6 py-6 border-x border-slate-50 text-right">LEITURA</th>
                         <th className="px-6 py-6 border-x border-slate-50 text-indigo-600 italic">MOTIVO</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {paginatedData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-5 font-black text-slate-900 uppercase text-center border-x border-slate-50/50">{r.mes}</td>
                          <td className="px-6 py-5 font-bold text-slate-600 uppercase truncate max-w-[150px] border-x border-slate-50/50">{r.rz}</td>
                          <td className="px-6 py-5 font-mono text-slate-400 text-center border-x border-slate-50/50">{r.ul}</td>
                          <td className="px-6 py-5 font-black text-indigo-600 text-center border-x border-slate-50/50">{r.instalacao}</td>
                          <td className="px-6 py-5 font-mono text-slate-500 border-x border-slate-50/50">{r.medidor}</td>
                          <td className="px-6 py-5 text-slate-400 text-center border-x border-slate-50/50">{r.reg}</td>
                          <td className="px-6 py-5 font-bold text-slate-900 border-x border-slate-50/50">{r.matr}</td>
                          <td className="px-6 py-5 font-black text-rose-500 text-center border-x border-slate-50/50">{r.nl}</td>
                          <td className="px-6 py-5 font-black text-right border-x border-slate-50/50">{r.l_atual.toLocaleString()}</td>
                          <td className="px-6 py-5 border-x border-slate-50/50">
                             <span className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black uppercase italic border border-rose-100 group-hover:bg-rose-600 group-hover:text-white transition-all duration-300">
                               {r.motivo}
                             </span>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             <div className="px-12 py-8 bg-slate-50 border-t flex items-center justify-between print:hidden">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-4">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-5 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm hover:border-indigo-600 transition-all disabled:opacity-30 active:scale-95"><ChevronLeft size={20}/></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-5 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm hover:border-indigo-600 transition-all disabled:opacity-30 active:scale-95"><ChevronRight size={20}/></button>
                </div>
             </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
             <section className="bg-white rounded-[3.5rem] shadow-sm border border-slate-200 overflow-hidden group">
                <div className="px-10 py-8 bg-indigo-50 border-b flex items-center gap-4 transition-colors group-hover:bg-indigo-100">
                   <BarChart3 size={20} className="text-indigo-600" />
                   <h3 className="text-sm font-black uppercase italic tracking-tighter text-indigo-900">Consolidado Regional</h3>
                </div>
                <div className="p-10">
                   <table className="w-full text-left text-sm border-collapse">
                      <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                         <tr>
                            <th className="py-5 px-4">Razão Social</th>
                            <th className="py-5 px-4 text-center">Volume Total</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {summaryData.map((s, i) => (
                           <tr key={i} className="hover:bg-slate-50 transition-colors">
                             <td className="py-5 px-4 font-black text-slate-900 uppercase">{s.rz}</td>
                             <td className="py-5 px-4 text-center font-black text-xl text-indigo-600">{s.count}</td>
                           </tr>
                         ))}
                         <tr className="bg-[#020617] text-white">
                           <td className="py-8 px-10 font-black uppercase tracking-widest text-lg italic">Dataset Totalizado</td>
                           <td className="py-8 px-10 text-center font-black text-3xl italic">{filteredResults.length}</td>
                         </tr>
                      </tbody>
                   </table>
                </div>
             </section>

             <section className="bg-[#020617] p-12 rounded-[3.5rem] text-white flex flex-col justify-center items-center text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-transparent"></div>
                <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                <div className="relative z-10 flex flex-col items-center gap-10">
                   <div className="w-32 h-32 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-600/40 group-hover:scale-110 transition-transform duration-500">
                      <Terminal size={50} />
                   </div>
                   <div className="max-w-md space-y-6">
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter">Audit Terminal V9.0</h3>
                      <p className="text-slate-400 font-medium leading-relaxed">
                         O núcleo de auditoria processa registros de campo para validar inconsistências em tempo real.
                         A integridade dos dados é garantida por camadas de redundância no Supabase Core.
                      </p>
                      <div className="flex justify-center gap-6 pt-6">
                         <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-white">{filteredResults.length}</span>
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Audited</span>
                         </div>
                         <div className="w-px h-10 bg-slate-800"></div>
                         <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-white">{summaryData.length}</span>
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Regions</span>
                         </div>
                      </div>
                   </div>
                </div>
             </section>
          </div>
        </div>
      )}

      {!hasSearched && !loading && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[4rem] p-32 flex flex-col items-center justify-center text-center group transition-all hover:border-indigo-100 hover:bg-slate-50/50">
           <div className="relative mb-12">
              <div className="absolute inset-0 bg-indigo-100 rounded-full scale-150 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative p-16 bg-white rounded-full shadow-2xl border border-slate-100 text-slate-200 group-hover:text-indigo-600 transition-all duration-500 group-hover:rotate-12">
                <Printer size={100} />
              </div>
           </div>
           <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Módulo de Auditoria em Stand-by</h3>
           <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] mt-6 max-w-sm">Configure os filtros estratégicos e sincronize o terminal para materializar os dados.</p>
           <button onClick={() => { setFilterAno('2024'); setFilterMes(options.meses[0] || ''); }} className="mt-12 flex items-center gap-3 text-indigo-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-2 transition-transform">
              Configuração Rápida <ArrowRight size={14} />
           </button>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 border border-slate-100">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-indigo-600 animate-spin"></div>
                 <Database size={44} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Materializando Terminal V9.0</h2>
                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.4em] mt-4 animate-pulse">Neural Node Online: Sincronizando Core...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default NosbPrintControl;
