import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { RPC_CL_RELATORIO, MONTH_ORDER, TABLE_NAME } from '../constants';
import { 
  Users, Play, FileSpreadsheet, Database, Search, Hash, 
  Activity, PieChart, ClipboardCheck, AlertCircle, Percent, Monitor,
  LayoutList, Filter, ChevronDown, Check, TrendingUp, BarChart3, 
  ArrowUpRight, RefreshCw, Zap
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LabelList, Cell
} from 'recharts';
import * as XLSX from 'xlsx';

// Definição da interface conforme retorno da RPC exclusiva
interface LeituristaReportRow {
  ano: number;
  mes: string;
  rz: string;
  rz_ul_lv: string | number;
  tipo: string;
  matr: string;
  total_leituras: number;      // Correspondente ao "Leitura a Executar" (COUNT DISTINCT)
  leituras_executadas: number; // Leituras Realizadas
  total_impedimentos: number;  // COUNT(nl) em lista
  indicador_execucao: number;  // INFM %
}

interface FilterOptions {
  anos: string[];
  meses: string[];
  matriculas: string[];
}

const LeituristaControl: React.FC = () => {
  // Estado dos Filtros (Independentes)
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatricula, setFilterMatricula] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  // Estados da Engine de Dados
  const [results, setResults] = useState<LeituristaReportRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>({ anos: [], meses: [], matriculas: [] });
  const [loading, setLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // Formatação Profissional
  const safeLocale = (val: number | undefined | null) => {
    return (val ?? 0).toLocaleString('pt-BR');
  };

  const formatPercent = (val: number | undefined | null) => {
    return (val ?? 0).toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + '%';
  };

  // Cálculo de Indicadores Conforme Regra de Negócio
  const stats = useMemo(() => {
    const aggregates = results.reduce((acc, curr) => ({
      executar: acc.executar + (Number(curr.total_leituras) || 0),
      impedimentos: acc.impedimentos + (Number(curr.total_impedimentos) || 0),
      executadas: acc.executadas + (Number(curr.leituras_executadas) || 0)
    }), { executar: 0, impedimentos: 0, executadas: 0 });

    // Regra: Total Geral = Leitura a Executar - Impedimentos
    const totalGeral = aggregates.executar - aggregates.impedimentos;
    
    // Regra: INFM = (Total Geral / Leitura a Executar) * 100
    const infm = aggregates.executar > 0 ? (totalGeral / aggregates.executar) * 100 : 0;

    return { ...aggregates, totalGeral, infm };
  }, [results]);

  // Consultas Auxiliares Exclusivas para Populacão de Filtros
  const fetchFilterMetadata = useCallback(async () => {
    setFetchingMetadata(true);
    try {
      // 1. DISTINCT Ano
      const { data: anosData } = await supabase
        .from(TABLE_NAME)
        .select('Ano')
        .not('Ano', 'is', null)
        .order('Ano', { ascending: false });
      
      const uniqueAnos = Array.from(new Set((anosData || []).map(r => String(r.Ano))));

      // 2. DISTINCT Mes
      const { data: mesesData } = await supabase
        .from(TABLE_NAME)
        .select('Mes')
        .not('Mes', 'is', null);
      
      // Explicitly typing a and b as strings to avoid "unknown" type error
      const uniqueMeses = Array.from(new Set((mesesData || []).map(r => String(r.Mes))))
        .sort((a: string, b: string) => (MONTH_ORDER[a.toUpperCase()] || 0) - (MONTH_ORDER[b.toUpperCase()] || 0));

      // 3. DISTINCT Matrícula
      const { data: matrsData } = await supabase
        .from(TABLE_NAME)
        .select('matr')
        .not('matr', 'is', null)
        .order('matr', { ascending: true });
      
      const uniqueMatrs = Array.from(new Set((matrsData || []).map(r => String(r.matr))));

      // 4. MIN/MAX UL (rz_ul_lv)
      const { data: minUlData } = await supabase
        .from(TABLE_NAME)
        .select('rz_ul_lv')
        .not('rz_ul_lv', 'is', null)
        .order('rz_ul_lv', { ascending: true })
        .limit(1);

      const { data: maxUlData } = await supabase
        .from(TABLE_NAME)
        .select('rz_ul_lv')
        .not('rz_ul_lv', 'is', null)
        .order('rz_ul_lv', { ascending: false })
        .limit(1);

      setOptions({
        anos: uniqueAnos,
        meses: uniqueMeses,
        matriculas: uniqueMatrs
      });

      if (minUlData && minUlData.length > 0) setFilterUlDe(String(minUlData[0].rz_ul_lv));
      if (maxUlData && maxUlData.length > 0) setFilterUlPara(String(maxUlData[0].rz_ul_lv));

    } catch (err) {
      console.error("ERRO_AO_CARREGAR_METADADOS_FILTROS:", err);
    } finally {
      setFetchingMetadata(false);
    }
  }, []);

  // Motor PostgreSQL: Execução da RPC rpc_cl_controle_leiturista_dashboard
  const handleProcess = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(RPC_CL_RELATORIO, {
        p_ano: filterAno ? parseInt(filterAno) : null,
        p_mes: filterMes || null,
        p_matr: filterMatricula || null,
        p_ul_de: filterUlDe ? parseInt(filterUlDe) : null,
        p_ul_para: filterUlPara ? parseInt(filterUlPara) : null
      });

      if (error) throw error;
      
      const sanitized = ((data as LeituristaReportRow[]) || []).map(row => ({
        ...row,
        ano: row.ano ?? 0,
        mes: row.mes ?? 'N/A',
        rz: row.rz ?? 'N/A',
        rz_ul_lv: row.rz_ul_lv ?? 0,
        tipo: row.tipo ?? 'N/A',
        matr: row.matr ?? 'N/A',
        total_leituras: row.total_leituras ?? 0,
        leituras_executadas: row.leituras_executadas ?? 0,
        total_impedimentos: row.total_impedimentos ?? 0,
        indicador_execucao: row.indicador_execucao ?? 0
      }));

      setResults(sanitized);
      setIsGenerated(true);
    } catch (err: any) {
      console.error("ERRO_RPC_CONTROLE_LEITURISTA:", err);
    } finally {
      setLoading(false);
    }
  }, [filterAno, filterMes, filterMatricula, filterUlDe, filterUlPara]);

  // Carga Inicial de Metadados e Processamento Geral
  useEffect(() => {
    fetchFilterMetadata().then(() => {
        handleProcess();
    });
  }, []);

  const exportData = () => {
    if (results.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle_Leiturista");
    XLSX.writeFile(wb, "SAL_Controle_Leiturista.xlsx");
  };

  const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* SEÇÃO DE FILTROS OBRIGATÓRIOS */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Filter size={18} /></div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Filtros de Gestão</h2>
          </div>
          <div className="flex items-center gap-4">
             {fetchingMetadata && <div className="flex items-center gap-2 text-[9px] font-black text-blue-500 animate-pulse uppercase tracking-widest"><RefreshCw size={12} className="animate-spin" /> Carregando Filtros...</div>}
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={12} className="text-amber-500" /> PostgreSQL Integration
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ano:</label>
            <select 
              value={filterAno} 
              onChange={e => setFilterAno(e.target.value)}
              disabled={fetchingMetadata}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none disabled:opacity-50"
            >
              <option value="">Todos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mês:</label>
            <select 
              value={filterMes} 
              onChange={e => setFilterMes(e.target.value)}
              disabled={fetchingMetadata}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none uppercase disabled:opacity-50"
            >
              <option value="">Todos</option>
              {options.meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Matrícula:</label>
            <select 
              value={filterMatricula} 
              onChange={e => setFilterMatricula(e.target.value)}
              disabled={fetchingMetadata}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none disabled:opacity-50"
            >
              <option value="">Todas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UL De:</label>
            <div className="relative">
              <input 
                type="number" 
                value={filterUlDe} 
                onChange={e => setFilterUlDe(e.target.value)}
                placeholder="0"
                disabled={fetchingMetadata}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 pl-9 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
              />
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UL Para:</label>
            <div className="relative">
              <input 
                type="number" 
                value={filterUlPara} 
                onChange={e => setFilterUlPara(e.target.value)}
                placeholder="999999"
                disabled={fetchingMetadata}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 pl-9 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
              />
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center border-t border-slate-50 pt-8">
          <button 
            onClick={handleProcess} 
            disabled={loading || fetchingMetadata}
            className="flex items-center gap-3 px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-xl shadow-slate-200 transition-all disabled:opacity-50 uppercase tracking-widest"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
            Processar Dados
          </button>
        </div>
      </section>

      {/* PAINEL DE INDICADORES (KPIs) */}
      {isGenerated && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Leitura a Executar</p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{safeLocale(stats.executar)}</p>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Activity size={18} /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Impedimentos</p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-2xl font-black text-red-600 tracking-tighter">{safeLocale(stats.impedimentos)}</p>
              <div className="p-2 bg-red-50 text-red-600 rounded-xl"><AlertCircle size={18} /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Leituras Executadas</p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{safeLocale(stats.executadas)}</p>
              <div className="p-2 bg-slate-50 text-slate-500 rounded-xl"><ClipboardCheck size={18} /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all border-b-4 border-b-blue-600">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Geral Leituras</p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-2xl font-black text-blue-700 tracking-tighter">{safeLocale(stats.totalGeral)}</p>
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Zap size={18} fill="currentColor" /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all bg-gradient-to-br from-blue-50 to-white">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Indicador INFM (%)</p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-2xl font-black text-blue-700 tracking-tighter">{formatPercent(stats.infm)}</p>
              <div className="p-2 bg-blue-700 text-white rounded-xl"><Percent size={18} /></div>
            </div>
          </div>
        </div>
      )}

      {/* DETALHAMENTO ANALÍTICO */}
      {isGenerated && (
        <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
          <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <LayoutList size={22} />
                </div>
                <div>
                   <h3 className="text-base font-bold text-slate-900 tracking-tight">Dataset de Performance</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base rpc_cl_controle_leiturista_dashboard</p>
                </div>
             </div>
             <button onClick={exportData} className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm">
                <FileSpreadsheet size={16} className="text-green-600" /> Exportar Planilha
             </button>
          </div>
          
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white text-slate-400 uppercase font-black text-[9px] tracking-[0.2em] border-b border-slate-100 sticky top-0 z-20">
                <tr>
                  <th className="px-10 py-6">Ano/Mês</th>
                  <th className="px-8 py-6">Matrícula</th>
                  <th className="px-8 py-6">Razão</th>
                  <th className="px-8 py-6">UL</th>
                  <th className="px-8 py-6">Tipo</th>
                  <th className="px-8 py-6 text-right">Executar</th>
                  <th className="px-8 py-6 text-right">Imped.</th>
                  <th className="px-8 py-6 text-right">Executadas</th>
                  <th className="px-10 py-6 text-right">INFM %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[11px] font-medium text-slate-600">
                {results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-10 py-5">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-bold">{r.mes}</span>
                        <span className="text-[9px] text-slate-400">{r.ano}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{r.matr}</span>
                    </td>
                    <td className="px-8 py-5 uppercase font-bold text-[10px]">{r.rz}</td>
                    <td className="px-8 py-5 font-mono text-slate-400">{r.rz_ul_lv}</td>
                    <td className="px-8 py-5">
                      <span className="bg-slate-100 px-2 py-1 rounded-md text-[9px] font-black uppercase text-slate-500">{r.tipo}</span>
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-slate-900">{safeLocale(r.total_leituras)}</td>
                    <td className="px-8 py-5 text-right font-bold text-red-500">{safeLocale(r.total_impedimentos)}</td>
                    <td className="px-8 py-5 text-right font-bold text-slate-700">{safeLocale(r.leituras_executadas)}</td>
                    <td className="px-10 py-5 text-right font-black text-blue-700 group-hover:text-blue-600">
                      {formatPercent(r.indicador_execucao)}
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-10 py-24 text-center">
                       <div className="flex flex-col items-center gap-4 opacity-30">
                          <Search size={48} className="text-slate-400" />
                          <p className="text-slate-500 font-black text-xs uppercase tracking-[0.3em]">Dataset Integralmente Vazio</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-10 py-6 bg-slate-900 flex items-center justify-between border-t border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">
              Processamento de {safeLocale(results.length)} Registros em Lote
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                 <span className="text-[9px] font-black text-white uppercase tracking-widest">PostgreSQL Engine Active</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* OVERLAY DE CARREGAMENTO SISTÊMICO */}
      {loading && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center">
          <div className="bg-slate-900 p-16 rounded-[60px] shadow-2xl flex flex-col items-center gap-8 text-center max-w-sm border border-slate-800">
             <div className="relative h-28 w-28">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-800 border-t-blue-500 animate-spin"></div>
                <Database size={40} className="absolute inset-0 m-auto text-blue-500 animate-pulse" />
             </div>
             <div className="space-y-3">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Analytical Engine</h2>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.3em]">Querying rpc_cl_dashboard</p>
                  <p className="text-[10px] text-blue-400 font-black animate-pulse uppercase tracking-widest">Calculando Agregados SQL...</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeituristaControl;