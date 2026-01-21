
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_FILTRO_RZ,
  RPC_CE_FILTRO_MATRICULA,
  RPC_CE_TIPO_V9
} from '../constants';
import { 
  Filter, Play, RotateCcw, AlertCircle, 
  Loader2, ImageIcon, Database, 
  TrendingUp, Activity, Layout, ListFilter, Calendar, AlertTriangle, X,
  Users, ChevronLeft, ChevronRight, FileSpreadsheet, FileText
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, Cell, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ITEMS_PER_PAGE = 25;

// Mapeamento para normalização e ordenação de meses
const MONTH_MAP: Record<string, number> = {
  "JANEIRO": 1, "FEVEREIRO": 2, "MARÇO": 3, "ABRIL": 4, "MAIO": 5, "JUNHO": 6,
  "JULHO": 7, "AGOSTO": 8, "SETEMBRO": 9, "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12
};

const EvidenceControl: React.FC = () => {
  // --- Estado dos Filtros (Seleção do Usuário) ---
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  // --- Metadados das Opções (População dos Selects) ---
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as { label: string, value: string }[],
    razoes: [] as string[],
    matriculas: [] as string[]
  });

  // --- Controle de Estado do Dataset ---
  const [dataset, setDataset] = useState<any[] | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- UI Layout ---
  const [activeTab, setActiveTab] = useState<'leiturista' | 'razao'>('leiturista');
  const [currentPage, setCurrentPage] = useState(1);
  const [chartDimension, setChartDimension] = useState<'mes' | 'matr' | 'razao'>('matr');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // 1. CARREGAMENTO DE METADADOS (EFEITO ÚNICO NA MONTAGEM)
  useEffect(() => {
    const fetchAllMetadata = async () => {
      try {
        const [resAnos, resMeses, resRazoes, resMatriculas] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES),
          supabase.rpc(RPC_CE_FILTRO_RZ),
          supabase.rpc(RPC_CE_FILTRO_MATRICULA)
        ]);

        const anos = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));

        const mesesRaw = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase());
        const mesesUnicos = Array.from(new Set(mesesRaw))
          .filter((m: string) => !!MONTH_MAP[m])
          .sort((a: string, b: string) => (MONTH_MAP[a] || 0) - (MONTH_MAP[b] || 0))
          .map(m => ({ label: m, value: m }));

        const razoes = Array.from(new Set((resRazoes.data || []).map((r: any) => String(r.rz || r || ''))))
          .filter(r => r !== '')
          .sort();

        const matriculas = Array.from(new Set((resMatriculas.data || []).map((m: any) => String(m.matr || m || ''))))
          .filter(m => m !== '')
          .sort();

        setOptions({ anos, meses: mesesUnicos, razoes, matriculas });
      } catch (err) {
        console.error("Erro ao carregar metadados:", err);
      }
    };
    fetchAllMetadata();
  }, []);

  // 2. BUSCA DE DADOS
  const handleGerarRelatorio = async () => {
    setLoading(true);
    setErrorMsg(null);
    setDataset(null);
    setReportReady(false);
    setCurrentPage(1);

    try {
      const p_ano = filterAno ? Number(filterAno) : null;
      const p_mes = filterMes || "Todos";

      const { data, error } = await supabase.rpc(RPC_CE_TIPO_V9, { p_ano, p_mes });

      if (error) throw error;

      const finalData = data || [];
      setDataset(finalData);
      setReportReady(true);
    } catch (err: any) {
      setErrorMsg("Falha na sincronização. Tente novamente em instantes.");
      setDataset([]);
      setReportReady(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilterAno('');
    setFilterMes('');
    setFilterMatr('');
    setFilterRazao('');
    setDataset(null);
    setReportReady(false);
    setErrorMsg(null);
    setIsAlertModalOpen(false);
  };

  // 3. PROCESSAMENTO DOS DADOS (CLIENT-SIDE)
  const processedData = useMemo(() => {
    if (!dataset) return [];
    
    return dataset.filter(item => {
      const rzVal = String(item.rz || item.razao || '');
      const matchRz = filterRazao ? (rzVal === filterRazao) : true;
      const matchMatr = filterMatr ? (String(item.matr) === filterMatr) : true;
      return matchRz && matchMatr;
    }).map(item => {
      const sol = Number(item.solicitadas) || 0;
      const rea = Number(item.realizadas) || 0;
      return { ...item, indicador: sol > 0 ? (rea / sol) * 100 : 0 };
    }).sort((a, b) => a.indicador - b.indicador);
  }, [dataset, filterRazao, filterMatr]);

  const alertItems = useMemo(() => {
    return processedData
      .filter(i => i.indicador < 50)
      .sort((a, b) => a.indicador - b.indicador);
  }, [processedData]);

  useEffect(() => {
    if (reportReady && alertItems.length > 0) {
      setIsAlertModalOpen(true);
    }
  }, [reportReady, alertItems.length]);

  const groupedByRazao = useMemo(() => {
    if (!dataset) return [];
    const map: Record<string, any> = {};
    dataset.filter(item => {
      const matchMatr = filterMatr ? (String(item.matr) === filterMatr) : true;
      const matchRz = filterRazao ? (String(item.rz || item.razao || '') === filterRazao) : true;
      return matchMatr && matchRz;
    }).forEach(item => {
      const rz = item.rz || item.razao || 'N/A';
      if (!map[rz]) map[rz] = { ano: item.ano, razao: rz, solicitadas: 0, realizadas: 0, mes: item.mes };
      map[rz].solicitadas += Number(item.solicitadas) || 0;
      map[rz].realizadas += Number(item.realizadas) || 0;
    });
    return Object.values(map).map((item: any) => ({
      ...item,
      indicador: item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0
    })).sort((a: any, b: any) => String(a.razao).localeCompare(String(b.razao)));
  }, [dataset, filterMatr, filterRazao]);

  const activeViewData = activeTab === 'leiturista' ? processedData : groupedByRazao;

  const totals = useMemo(() => {
    const sol = activeViewData.reduce((acc, c) => acc + (Number(c.solicitadas) || 0), 0);
    const rea = activeViewData.reduce((acc, c) => acc + (Number(c.realizadas) || 0), 0);
    return { sol, rea, pnd: Math.max(0, sol - rea), ind: sol > 0 ? (rea / sol) * 100 : 0 };
  }, [activeViewData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeViewData.slice(start, start + ITEMS_PER_PAGE);
  }, [activeViewData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(activeViewData.length / ITEMS_PER_PAGE));

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    processedData.forEach(item => {
      let key = '';
      if (chartDimension === 'mes') key = String(item.mes).toUpperCase();
      else if (chartDimension === 'matr') key = String(item.matr);
      else key = String(item.rz || item.razao);

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

  const getStatusStyle = (ind: number) => {
    if (ind <= 40) return 'bg-[#991b1b] text-white font-black';
    if (ind < 50) return 'bg-[#b45309] text-white font-bold';
    return 'bg-[#166534] text-white font-medium';
  };

  // EXPORT FUNCTIONS
  const exportToExcel = () => {
    if (activeViewData.length === 0) return;
    const exportRows = activeViewData.map(r => ({
      'Mês': r.mes,
      'Ano': r.ano,
      'Razão': r.razao || r.rz,
      ...(activeTab === 'leiturista' ? { 'Matrícula': r.matr } : {}),
      'Solicitadas': r.solicitadas,
      'Realizadas': r.realizadas,
      'Não Realizadas': Math.max(0, r.solicitadas - r.realizadas),
      'Indicador (%)': r.indicador.toFixed(2).replace('.', ',') + '%'
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Auditoria");
    XLSX.writeFile(wb, `SAL_Auditoria_${activeTab}_${Date.now()}.xlsx`);
  };

  const exportToPDF = () => {
    if (activeViewData.length === 0) return;
    const doc = new jsPDF('landscape');
    const headers = [
      'Mês', 'Ano', 'Razão', 
      ...(activeTab === 'leiturista' ? ['Matrícula'] : []), 
      'Solicitadas', 'Realizadas', 'Pnd.', 'Ind. (%)'
    ];
    const data = activeViewData.map(r => [
      r.mes, r.ano, r.razao || r.rz,
      ...(activeTab === 'leiturista' ? [r.matr] : []),
      r.solicitadas, r.realizadas, Math.max(0, r.solicitadas - r.realizadas),
      r.indicador.toFixed(2).replace('.', ',') + '%'
    ]);

    autoTable(doc, {
      head: [headers],
      body: data,
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
    });
    doc.save(`SAL_Auditoria_${activeTab}_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-10 pb-40">
      {/* SUMMARY PANEL (REAL-TIME) */}
      <section className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl">
        <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
           <Activity size={18} className="text-blue-400" />
           <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Filtros Selecionados em Tempo Real</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
           <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ano</span>
              <span className="text-sm font-black text-blue-400 italic">{filterAno || 'Todos'}</span>
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mês</span>
              <span className="text-sm font-black text-blue-400 italic uppercase">{filterMes || 'Todos'}</span>
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Razão</span>
              <span className="text-sm font-black text-blue-400 italic truncate max-w-xs" title={filterRazao}>{filterRazao || 'Todas'}</span>
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Matrícula</span>
              <span className="text-sm font-black text-blue-400 italic">{filterMatr || 'Todas'}</span>
           </div>
        </div>
      </section>

      {/* SEÇÃO DE FILTROS */}
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><Filter size={20} /></div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tighter italic">Filtros de Auditoria</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Selecione o Ano</label>
            <select value={filterAno} onChange={(e) => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
              <option value="">Todos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Selecione o Mês</label>
            <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
              <option value="">Todos</option>
              {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Selecione a Razão</label>
            <select value={filterRazao} onChange={(e) => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
              <option value="">Todas</option>
              {options.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Selecione a Matrícula</label>
            <select value={filterMatr} onChange={(e) => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all">
              <option value="">Todas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
          <button onClick={handleGerarRelatorio} disabled={loading} className="px-16 py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-3">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />}
            PROCESSAR AUDITORIA
          </button>
          <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
            <RotateCcw size={14} />
            LIMPAR
          </button>
        </div>

        {errorMsg && (
          <div className="mt-8 p-5 bg-red-50 border-l-4 border-red-600 rounded-xl flex items-center gap-3 text-red-700 text-xs font-bold uppercase">
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}
      </section>

      {/* RESULTADOS */}
      {reportReady && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          {/* CARDS INDICADORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-blue-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Solicitadas (Geral)</p>
              <h3 className="text-4xl font-black text-slate-900">{totals.sol.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-green-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Realizadas (Geral)</p>
              <h3 className="text-4xl font-black text-green-700">{totals.rea.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-red-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Não Realizadas (Geral)</p>
              <h3 className="text-4xl font-black text-red-700">{totals.pnd.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="bg-white p-8 rounded-3xl border-l-[6px] border-amber-600 shadow-sm border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Indicador (Geral)</p>
              <h3 className="text-4xl font-black text-amber-700">{totals.ind.toFixed(2).replace('.', ',')}%</h3>
            </div>
          </div>

          {/* TABELA DE DADOS */}
          <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-8">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  Relação Analítica
                </h3>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button onClick={() => { setActiveTab('leiturista'); setCurrentPage(1); }} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'leiturista' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Leiturista</button>
                  <button onClick={() => { setActiveTab('razao'); setCurrentPage(1); }} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'razao' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Razão</button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <button onClick={exportToExcel} className="p-3 bg-green-50 text-green-600 border border-green-100 rounded-xl hover:bg-green-100 transition-all"><FileSpreadsheet size={20}/></button>
                 <button onClick={exportToPDF} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"><FileText size={20}/></button>
                 <button onClick={() => setIsAlertModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20">
                    <AlertTriangle size={14} />
                    Audit Alert
                 </button>
              </div>
            </div>

            <div className="overflow-x-auto p-10">
              {activeViewData.length > 0 ? (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 border border-slate-200">Mês</th>
                      <th className="px-6 py-4 border border-slate-200">Ano</th>
                      <th className="px-6 py-4 border border-slate-200">Razão</th>
                      {activeTab === 'leiturista' && <th className="px-6 py-4 border border-slate-200">Matrícula</th>}
                      <th className="px-6 py-4 border border-slate-200 text-center">Solicitadas</th>
                      <th className="px-6 py-4 border border-slate-200 text-center">Realizadas</th>
                      <th className="px-6 py-4 border border-slate-200 text-center">Não Realizadas</th>
                      <th className="px-6 py-4 border border-slate-200 text-center font-black">Indicador (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className={`${getStatusStyle(row.indicador)} transition-colors`}>
                        <td className="px-6 py-4 border border-black/5 uppercase">{row.mes}</td>
                        <td className="px-6 py-4 border border-black/5 uppercase">{row.ano}</td>
                        <td className="px-6 py-4 border border-black/5 whitespace-nowrap">{row.razao || row.rz}</td>
                        {activeTab === 'leiturista' && <td className="px-6 py-4 border border-black/5 font-mono">{row.matr}</td>}
                        <td className="px-6 py-4 border border-black/5 text-center">{(Number(row.solicitadas)).toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-4 border border-black/5 text-center">{(Number(row.realizadas)).toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-4 border border-black/5 text-center">{Math.max(0, row.solicitadas - row.realizadas).toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-4 border border-black/5 text-center font-black">{row.indicador.toFixed(2).replace('.', ',')}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-24 text-center">
                  <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Nenhum dado encontrado para os filtros selecionados.</p>
                </div>
              )}
            </div>

            {activeViewData.length > 0 && (
              <div className="px-10 py-6 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm transition-all"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm transition-all"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </section>

          {/* GRÁFICO */}
          {activeViewData.length > 0 && (
            <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <TrendingUp size={22} className="text-blue-600" />
                  Análise de Desempenho
                </h3>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                   {[
                     { id: 'mes', label: 'Mês', icon: <Calendar size={12}/> },
                     { id: 'matr', label: 'Matrícula', icon: <Users size={12}/> },
                     { id: 'razao', label: 'Razão', icon: <ListFilter size={12}/> }
                   ].map((dim) => (
                     <button key={dim.id} onClick={() => setChartDimension(dim.id as any)} className={`flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${chartDimension === dim.id ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{dim.icon}{dim.label}</button>
                   ))}
                </div>
              </div>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip 
                        cursor={{fill: '#f8fafc', radius: 10}} 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
                      <Bar dataKey="solicitadas" name="Solicitadas" fill="#2563eb" barSize={30} radius={[4, 4, 0, 0]}>
                         <LabelList dataKey="indicador" position="top" formatter={(val: number) => val.toFixed(2) + '%'} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#1e293b' }} />
                      </Bar>
                      <Bar dataKey="realizadas" name="Realizadas" fill="#16a34a" barSize={30} radius={[4, 4, 0, 0]}>
                         <LabelList dataKey="indicador" position="top" formatter={(val: number) => val.toFixed(2) + '%'} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#1e293b' }} />
                      </Bar>
                      <Bar dataKey="pendentes" name="Não Realizadas" fill="#dc2626" barSize={30} radius={[4, 4, 0, 0]}>
                         <LabelList dataKey="indicador" position="top" formatter={(val: number) => val.toFixed(2) + '%'} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#1e293b' }} />
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ESTADO INICIAL */}
      {!reportReady && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[60px] border-2 border-dashed border-slate-200 text-center mx-auto max-w-4xl shadow-inner">
          <div className="p-8 bg-slate-50 rounded-full mb-8"><ImageIcon size={60} className="text-slate-200" /></div>
          <h3 className="text-slate-950 font-black text-2xl mb-4 tracking-tighter uppercase italic">Módulo de Auditoria</h3>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.4em] px-20 leading-loose">Configure os parâmetros e inicie o processamento do dataset para Auditoria.</p>
        </div>
      )}

      {/* MODAL DE ALERTA CRÍTICO (Audit Alert Pop-up) */}
      {isAlertModalOpen && reportReady && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden border border-red-100 animate-in zoom-in-95 duration-300">
              <div className="bg-[#991b1b] p-6 flex items-center justify-between text-white">
                 <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="animate-bounce" />
                    <h2 className="text-lg font-black uppercase tracking-tighter">Atenção ao Rendimento: Rendimento Abaixo da Meta</h2>
                 </div>
                 <button onClick={() => setIsAlertModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="p-8">
                 {alertItems.length > 0 ? (
                    <div className="overflow-y-auto max-h-[450px] border border-slate-100 rounded-2xl">
                       <table className="w-full text-left">
                          <thead className="bg-slate-50 sticky top-0 text-[10px] font-black uppercase text-slate-400">
                             <tr>
                               <th className="px-6 py-4">Razão</th>
                               <th className="px-6 py-4">Matrícula</th>
                               <th className="px-6 py-4 text-center">Solicitadas</th>
                               <th className="px-6 py-4 text-center">Realizadas</th>
                               <th className="px-6 py-4 text-center">Pendentes</th>
                               <th className="px-6 py-4 text-center">Indicador (%)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y text-xs text-black">
                             {alertItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-red-50 transition-colors">
                                   <td className="px-6 py-4 font-bold">{item.rz || item.razao || 'N/A'}</td>
                                   <td className="px-6 py-4 font-bold">{item.matr}</td>
                                   <td className="px-6 py-4 text-center">{(Number(item.solicitadas)).toLocaleString('pt-BR')}</td>
                                   <td className="px-6 py-4 text-center">{(Number(item.realizadas)).toLocaleString('pt-BR')}</td>
                                   <td className="px-6 py-4 text-center">{(Math.max(0, (item.solicitadas - item.realizadas))).toLocaleString('pt-BR')}</td>
                                   <td className="px-6 py-4 text-center font-black">
                                      {item.indicador.toFixed(2).replace('.', ',')}%
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    <div className="py-20 text-center text-black">
                       <p className="font-black uppercase text-xs tracking-widest">Nenhum colaborador abaixo da meta para os filtros selecionados.</p>
                    </div>
                 )}
                 <div className="mt-8 flex justify-end">
                    <button onClick={() => setIsAlertModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">FECHAR ALERTA</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* OVERLAY DE LOADING */}
      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-10 text-center animate-in zoom-in-95 duration-500">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-100 border-t-blue-600 animate-spin"></div>
                <Database size={30} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Processando Dados</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Sincronizando modelos de auditoria...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceControl;
