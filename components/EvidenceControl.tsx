
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_TIPO_V9
} from '../constants';
import { 
  Filter, Play, RotateCcw, AlertCircle, 
  Loader2, ImageIcon, Database, 
  TrendingUp, Layout, ListFilter, Calendar, AlertTriangle, X,
  Users, ChevronLeft, ChevronRight, FileSpreadsheet, FileText
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ITEMS_PER_PAGE = 25;

const MONTH_MAP: Record<string, number> = {
  "JANEIRO": 1, "FEVEREIRO": 2, "MARÇO": 3, "ABRIL": 4, "MAIO": 5, "JUNHO": 6,
  "JULHO": 7, "AGOSTO": 8, "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12
};

const EvidenceControl: React.FC = () => {
  // --- Estados de Filtro ---
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  // --- Metadados das Opções (Dropdowns) ---
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as { label: string, value: string }[],
    razoes: [] as string[],
    matriculas: [] as string[]
  });

  // --- Dataset Principal ---
  const [dataset, setDataset] = useState<any[] | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- UI Layout ---
  const [activeTab, setActiveTab] = useState<'leiturista' | 'razao'>('leiturista');
  const [currentPage, setCurrentPage] = useState(1);
  const [chartDimension, setChartDimension] = useState<'mes' | 'matr' | 'razao'>('matr');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

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

        setOptions(prev => ({ ...prev, anos, meses: mesesUnicos }));
        handleGerarRelatorio(true);
      } catch (err) {
        console.error("Erro no fetch inicial:", err);
      }
    };
    fetchInitialMetadata();
  }, []);

  const handleGerarRelatorio = async (isInitial = false) => {
    setLoading(true);
    setErrorMsg(null);
    setCurrentPage(1);

    try {
      const p_ano = isInitial ? null : (filterAno ? Number(filterAno) : null);
      const p_mes = isInitial ? "Todos" : (filterMes || "Todos");

      const { data, error } = await supabase.rpc(RPC_CE_TIPO_V9, { p_ano, p_mes });
      if (error) throw error;

      setDataset(data || []);
      setReportReady(true);
    } catch (err: any) {
      setErrorMsg("Erro ao sincronizar auditoria geral.");
      setDataset([]);
      setReportReady(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataset && dataset.length > 0 && options.razoes.length === 0) {
      const razoesUnicas = Array.from(new Set(dataset.map(item => String(item.RZ || item.rz || item.razao || '')))).filter(r => r !== '').sort();
      const matriculasUnicas = Array.from(new Set(dataset.map(item => String(item.MATR || item.matr || '')))).filter(m => m !== '').sort();
      setOptions(prev => ({ ...prev, razoes: razoesUnicas, matriculas: matriculasUnicas }));
    }
  }, [dataset]);

  const handleReset = () => {
    setFilterAno('');
    setFilterMes('');
    setFilterMatr('');
    setFilterRazao('');
    setDataset(null);
    setReportReady(false);
    handleGerarRelatorio(true);
  };

  const processedData = useMemo(() => {
    if (!dataset) return [];
    return dataset.filter(item => {
      const rzVal = String(item.RZ || item.rz || item.razao || '');
      const matrVal = String(item.MATR || item.matr || '');
      const matchRz = filterRazao ? (rzVal === filterRazao) : true;
      const matchMatr = filterMatr ? (matrVal === filterMatr) : true;
      return matchRz && matchMatr;
    }).map(item => {
      const sol = Number(item.solicitadas) || 0;
      const rea = Number(item.realizadas) || 0;
      return { 
        ...item, 
        indicador: sol > 0 ? (rea / sol) * 100 : 0,
        razao_display: item.RZ || item.rz || item.razao || 'N/A',
        matr_display: item.MATR || item.matr || 'N/A'
      };
    }).sort((a, b) => a.indicador - b.indicador);
  }, [dataset, filterRazao, filterMatr]);

  const totals = useMemo(() => {
    const sol = processedData.reduce((acc, c) => acc + (Number(c.solicitadas) || 0), 0);
    const rea = processedData.reduce((acc, c) => acc + (Number(c.realizadas) || 0), 0);
    return { sol, rea, pnd: Math.max(0, sol - rea), ind: sol > 0 ? (rea / sol) * 100 : 0 };
  }, [processedData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedData.slice(start, start + ITEMS_PER_PAGE);
  }, [processedData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE));

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    processedData.forEach(item => {
      let key = chartDimension === 'mes' ? String(item.mes).toUpperCase() : chartDimension === 'matr' ? item.matr_display : item.razao_display;
      if (!grouped[key]) grouped[key] = { label: key, solicitadas: 0, realizadas: 0, indicador: 0 };
      grouped[key].solicitadas += Number(item.solicitadas) || 0;
      grouped[key].realizadas += Number(item.realizadas) || 0;
    });
    return Object.values(grouped).map(item => ({
      ...item,
      indicador: item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0,
      pendentes: Math.max(0, item.solicitadas - item.realizadas)
    })).sort((a, b) => b.solicitadas - a.solicitadas).slice(0, 15);
  }, [processedData, chartDimension]);

  return (
    <div className="space-y-10 pb-40">
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Filter size={20} /></div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tighter italic">Filtros de Auditoria:</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Ano</label>
            <select value={filterAno} onChange={(e) => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold">
              <option value="">Todos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mês</label>
            <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold">
              <option value="">Todos</option>
              {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Razão</label>
            <select value={filterRazao} onChange={(e) => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold">
              <option value="">Todas</option>
              {options.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Matrícula</label>
            <select value={filterMatr} onChange={(e) => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold">
              <option value="">Todas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-12 flex justify-center gap-6">
          <button onClick={() => handleGerarRelatorio(false)} disabled={loading} className="px-16 py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
            PROCESSAR AUDITORIA
          </button>
          <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <RotateCcw size={14} /> LIMPAR
          </button>
        </div>
      </section>

      {reportReady && dataset && (
        <div className="space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-blue-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Solicitadas</p>
              <h3 className="text-4xl font-black text-slate-900">{totals.sol.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-green-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Realizadas</p>
              <h3 className="text-4xl font-black text-green-700">{totals.rea.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-red-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Não Realizadas</p>
              <h3 className="text-4xl font-black text-red-700">{totals.pnd.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-amber-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Eficiência</p>
              <h3 className="text-4xl font-black text-amber-700">{totals.ind.toFixed(2).replace('.', ',')}%</h3>
            </div>
          </div>

          <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  Relação Analítica de Evidências
                </h3>
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
                            <td className="px-6 py-4 border border-slate-200">{row.razao_display}</td>
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
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border rounded-xl disabled:opacity-30"><ChevronLeft size={16} /></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 bg-white border rounded-xl disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
             </div>
          </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-6">
             <Loader2 className="animate-spin text-blue-600" size={40} />
             <h2 className="text-xl font-black uppercase text-slate-900">Sincronizando Auditoria...</h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceControl;
