
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { RPC_CONTROLE_EVIDENCIAS, TABLE_NAME, MONTH_ORDER } from '../constants';
import { 
  Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, 
  Database, Activity, Check, ChevronDown, BarChart3, AlertTriangle, 
  TrendingUp, Zap, RotateCcw, LayoutList, ClipboardList, Search, ListFilter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import IndicatorCard from './IndicatorCard';

const ITEMS_PER_PAGE = 20;

const EvidenceAuditControl: React.FC = () => {
  // Estados de Filtro
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  // Opções para Selects
  const [options, setOptions] = useState<{ anos: string[], meses: string[], matriculas: string[], razoes: string[] }>({
    anos: [], meses: [], matriculas: [], razoes: []
  });

  // Controle de UI
  const [rawResults, setRawResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'detalhado' | 'razao'>('detalhado');
  const [chartMode, setChartMode] = useState<'mes' | 'ano' | 'matr'>('mes');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  // Carregar metadados para os filtros
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [anoRes, mesRes, matrRes, rzRes] = await Promise.all([
          supabase.from(TABLE_NAME).select('Ano').order('Ano', { ascending: false }),
          supabase.from(TABLE_NAME).select('Mes').order('Mes', { ascending: true }),
          supabase.from(TABLE_NAME).select('matr').order('matr', { ascending: true }),
          supabase.from(TABLE_NAME).select('rz').order('rz', { ascending: true })
        ]);
        
        setOptions({
          anos: Array.from(new Set((anoRes.data || []).map((r: any) => String(r.Ano)))),
          meses: Array.from(new Set((mesRes.data || []).map((r: any) => String(r.Mes)))),
          matriculas: Array.from(new Set((matrRes.data || []).map((r: any) => String(r.matr)))).sort(),
          razoes: Array.from(new Set((rzRes.data || []).map((r: any) => String(r.rz)))).sort()
        });
      } catch (err) {
        console.error("Erro ao carregar opções de filtros:", err);
      }
    };
    fetchFilterOptions();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setHasGenerated(false);
    try {
      // Regra v9: Conversão de tipos para RPC
      const params = {
        p_ano: filterAno ? Number(filterAno) : null,
        p_mes: filterMeses.length > 0 ? filterMeses : null,
        p_rz: filterRazao || null,
        p_matr: filterMatr || null,
        p_ul_de: filterUlDe ? Number(filterUlDe) : null,
        p_ul_para: filterUlPara ? Number(filterUlPara) : null
      };

      const { data, error } = await supabase.rpc(RPC_CONTROLE_EVIDENCIAS, params);

      if (error) throw error;
      
      setRawResults(data || []);
      setHasGenerated(true);
      setCurrentPage(1);
    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
      setRawResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilterAno('');
    setFilterMeses([]);
    setFilterMatr('');
    setFilterRazao('');
    setFilterUlDe('');
    setFilterUlPara('');
    setRawResults([]);
    setHasGenerated(false);
    setCurrentPage(1);
  };

  // Processamento de dados v9 - Detalhado
  const processedData = useMemo(() => {
    return rawResults.map(row => {
      const dig = parseInt(row.digitacao || row.DIG || '0');
      const fotoStatus = String(row.foto || '').toUpperCase();
      
      const solicitada = dig >= 2 ? 1 : 0;
      const realizada = fotoStatus === 'OK' ? 1 : 0;
      const nao_realizada = fotoStatus === 'N-OK' ? 1 : 0;
      const indicador = solicitada > 0 ? (realizada / solicitada) * 100 : 0;

      return {
        ...row,
        mes: row.Mes || row.MES || 'N/A',
        ano: row.Ano || row.ANO || 0,
        razao: row.rz || row.RAZAO || 'N/A',
        ul: row.rz_ul_lv || row.UL || 'N/A',
        solicitadas: solicitada,
        realizadas: realizada,
        nao_realizadas: nao_realizada,
        matr: row.matr || row.MATR || 'N/A',
        cod: row.nl || row.COD || 'N/A',
        leitura: row.l_atual || row.LEITURA || 0,
        indicador: indicador
      };
    }).sort((a, b) => b.indicador - a.indicador);
  }, [rawResults]);

  // Processamento de dados v9 - Agrupado por Razão
  const aggregatedByRazao = useMemo(() => {
    const grouped: Record<string, any> = {};
    processedData.forEach(item => {
      const key = item.razao;
      if (!grouped[key]) {
        grouped[key] = {
          razao: key,
          solicitadas: 0,
          realizadas: 0,
          nao_realizadas: 0,
          mes: item.mes,
          ano: item.ano
        };
      }
      grouped[key].solicitadas += item.solicitadas;
      grouped[key].realizadas += item.realizadas;
      grouped[key].nao_realizadas += item.nao_realizadas;
    });

    return Object.values(grouped).map(g => ({
      ...g,
      indicador: g.solicitadas > 0 ? (g.realizadas / g.solicitadas) * 100 : 0
    })).sort((a, b) => b.indicador - a.indicador);
  }, [processedData]);

  const currentDisplayData = activeTab === 'detalhado' ? processedData : aggregatedByRazao;
  const paginatedData = currentDisplayData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(currentDisplayData.length / ITEMS_PER_PAGE) || 1;

  const totals = useMemo(() => {
    return processedData.reduce((acc, curr) => ({
      sol: acc.sol + curr.solicitadas,
      rea: acc.rea + curr.realizadas,
      nre: acc.nre + curr.nao_realizadas
    }), { sol: 0, rea: 0, nre: 0 });
  }, [processedData]);

  // Regras de Cores Estritas v9.0
  const getRowStyle = (ind: number) => {
    if (ind >= 50.0) return 'bg-[#991b1b] text-white font-black'; // Vermelho Escuro + Negrito
    if (ind >= 41.0) return 'bg-[#b45309] text-white'; // Amarelo Escuro
    return 'bg-[#166534] text-white'; // Verde Escuro
  };

  const chartData = useMemo(() => {
    const grouped: Record<string, { label: string, sum: number, count: number }> = {};
    processedData.forEach(item => {
      const key = chartMode === 'mes' ? item.mes : chartMode === 'ano' ? String(item.ano) : item.matr;
      if (!grouped[key]) {
        grouped[key] = { label: key, sum: item.indicador, count: 1 };
      } else {
        grouped[key].sum += item.indicador;
        grouped[key].count += 1;
      }
    });
    return Object.values(grouped).map(g => ({
      name: g.label,
      indicador: Number((g.sum / g.count).toFixed(2))
    })).sort((a, b) => b.indicador - a.indicador).slice(0, 15);
  }, [processedData, chartMode]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* SEÇÃO DE FILTROS */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Filter size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Parâmetros de Auditoria v9.0</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Evidências em Campo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {/* Ano */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano</label>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-xs focus:border-blue-500 outline-none">
              <option value="">Todos</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Mês Multi-select */}
          <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês (Múltiplos)</label>
            <button 
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-xs flex items-center justify-between text-left"
            >
              <span className="truncate">{filterMeses.length === 0 ? "Todos" : `${filterMeses.length} Selecionados`}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto p-2">
                {options.meses.map(m => (
                  <label key={m} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={filterMeses.includes(m)}
                      onChange={() => {
                        setFilterMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-bold text-slate-600 uppercase">{m}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Razão Social */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão Social</label>
            <select value={filterRazao} onChange={e => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-xs focus:border-blue-500 outline-none">
              <option value="">Todas</option>
              {options.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Matrícula */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
            <select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-xs focus:border-blue-500 outline-none">
              <option value="">Todas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* UL Inicial */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UL Inicial</label>
            <input 
              type="text" 
              value={filterUlDe} 
              maxLength={8}
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))}
              placeholder="00000000"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-xs focus:border-blue-500 outline-none"
            />
          </div>

          {/* UL Final */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UL Final</label>
            <input 
              type="text" 
              value={filterUlPara} 
              maxLength={8}
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))}
              placeholder="99999999"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-xs focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
          <button 
            onClick={handleGenerate} 
            disabled={loading}
            className="px-24 py-5 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 transition-all hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? <Activity className="animate-spin" size={20}/> : <Zap size={20} fill="currentColor"/>}
            GERAR DADOS
          </button>
          <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all">
            <RotateCcw size={16} /> REINICIAR
          </button>
        </div>
      </section>

      {hasGenerated ? (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          {/* CARDS INDICADORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Solicitadas" value={totals.sol.toLocaleString()} color="blue" icon={<ClipboardList size={24}/>} />
            <IndicatorCard label="Realizadas (OK)" value={totals.rea.toLocaleString()} color="green" icon={<Check size={24}/>} />
            <IndicatorCard label="Não Realizadas" value={totals.nre.toLocaleString()} color="red" icon={<AlertTriangle size={24}/>} />
            <IndicatorCard label="Eficiência Geral" value={totals.sol > 0 ? (totals.rea / totals.sol * 100).toFixed(2).replace('.',',') : '0,00'} suffix="%" color="amber" icon={<TrendingUp size={24}/>} />
          </div>

          {/* TABELA COM ABAS */}
          <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 bg-slate-50/50">
              <div className="flex items-center gap-8">
                <div className="flex bg-slate-200 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => { setActiveTab('detalhado'); setCurrentPage(1); }}
                    className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'detalhado' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Relatório Detalhado
                  </button>
                  <button 
                    onClick={() => { setActiveTab('razao'); setCurrentPage(1); }}
                    className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'razao' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Agrupado por Razão
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(currentDisplayData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
                  XLSX.writeFile(wb, `SAL_Auditoria_${activeTab}.xlsx`);
                }} className="flex items-center gap-3 px-6 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all">
                  <FileSpreadsheet size={18}/> EXCEL
                </button>
                <button onClick={() => {
                  const doc = new jsPDF({ orientation: 'landscape' });
                  const body = paginatedData.map(r => activeTab === 'detalhado' ? 
                    [r.mes, r.ano, r.razao, r.ul, r.solicitadas, r.realizadas, r.nao_realizadas, r.matr, r.cod, `${r.indicador.toFixed(2)}%`] :
                    [r.mes, r.ano, r.razao, r.solicitadas, r.realizadas, r.nao_realizadas, `${r.indicador.toFixed(2)}%`]
                  );
                  autoTable(doc, { 
                    head: [activeTab === 'detalhado' ? 
                      ["MES", "ANO", "RAZÃO", "UL", "SOLIC", "REALIZ", "N-REALIZ", "MATR", "COD", "INDICADOR (%)"] :
                      ["MES", "ANO", "RAZÃO", "SOLIC", "REALIZ", "N-REALIZ", "INDICADOR (%)"]
                    ], 
                    body, theme: 'grid', styles: { fontSize: 7 } 
                  });
                  doc.save(`SAL_Auditoria_${activeTab}.pdf`);
                }} className="flex items-center gap-3 px-6 py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all">
                  <FileText size={18}/> PDF
                </button>
                <span className="text-[10px] font-black bg-white border border-slate-200 px-4 py-2 rounded-full text-slate-500 uppercase">
                  {currentDisplayData.length} Registros
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse text-left">
                <thead className="bg-white text-slate-400 font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-8 py-6">Mês</th>
                    <th className="px-8 py-6">Ano</th>
                    <th className="px-8 py-6">Razão Social</th>
                    {activeTab === 'detalhado' && (
                      <>
                        <th className="px-8 py-6">UL</th>
                        <th className="px-8 py-6">Matrícula</th>
                        <th className="px-8 py-6 text-center">Cód.</th>
                      </>
                    )}
                    <th className="px-8 py-6 text-center">Solicitadas</th>
                    <th className="px-8 py-6 text-center">Realizadas</th>
                    <th className="px-8 py-6 text-center">N-Realizadas</th>
                    <th className="px-8 py-6 text-right">Indicador (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getRowStyle(row.indicador)} border-b border-white/10 transition-all hover:brightness-110`}>
                      <td className="px-8 py-4 uppercase font-bold">{row.mes}</td>
                      <td className="px-8 py-4">{row.ano}</td>
                      <td className="px-8 py-4 font-bold">{row.razao}</td>
                      {activeTab === 'detalhado' && (
                        <>
                          <td className="px-8 py-4 font-mono">{row.ul}</td>
                          <td className="px-8 py-4 font-mono">{row.matr}</td>
                          <td className="px-8 py-4 text-center">{row.cod}</td>
                        </>
                      )}
                      <td className="px-8 py-4 text-center">{row.solicitadas}</td>
                      <td className="px-8 py-4 text-center">{row.realizadas}</td>
                      <td className="px-8 py-4 text-center">{row.nao_realizadas}</td>
                      <td className="px-8 py-4 text-right font-black text-sm">{row.indicador.toFixed(2).replace('.',',')}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-10 py-6 bg-slate-50 border-t flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
              <div className="flex gap-3">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 disabled:opacity-30">
                  <ChevronLeft size={20} className="text-slate-600"/>
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 disabled:opacity-30">
                  <ChevronRight size={20} className="text-slate-600"/>
                </button>
              </div>
            </div>
          </section>

          {/* DIAGNÓSTICO GRÁFICO */}
          <section className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
                  <BarChart3 size={24}/>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Análise Visual do Lote</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Indicadores Médios por {chartMode === 'matr' ? 'Matrícula' : chartMode}</p>
                </div>
              </div>
              <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                {(['mes', 'ano', 'matr'] as const).map(m => (
                  <button 
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartMode === m ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {m === 'matr' ? 'Matrícula' : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} unit="%" />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="indicador" name="Indicador (%)" barSize={40} radius={[12, 12, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.indicador >= 50.0 ? '#991b1b' : entry.indicador >= 41.0 ? '#b45309' : '#166534'} />
                    ))}
                    <LabelList dataKey="indicador" position="top" style={{ fill: '#0f172a', fontSize: '11px', fontWeight: '900' }} offset={10} formatter={(v: number) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      ) : (
        /* PLACEHOLDER INICIAL */
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-200 rounded-[3.5rem] bg-white text-center">
          {loading ? (
             <div className="flex flex-col items-center gap-8">
                <div className="relative">
                  <div className="h-24 w-24 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <Database size={30} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Processando Dataset v9.0</p>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse">Cruzando Matrizes de Evidências...</p>
                </div>
             </div>
          ) : (
            <>
              <div className="p-12 bg-slate-50 rounded-full mb-10 text-slate-200 shadow-inner">
                <Search size={80} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Pronto para Analisar</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-6 max-w-sm leading-loose">
                Selecione os filtros acima e clique em Gerar Dados para materializar os indicadores de auditoria.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
