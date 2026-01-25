
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, MONTH_ORDER } from '../constants';
import { 
  Filter, Play, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, 
  Database, Activity, Check, ChevronDown, BarChart3, AlertTriangle, 
  TrendingUp, Calendar, Users, Camera
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import IndicatorCard from './IndicatorCard';

const ITEMS_PER_PAGE = 20;

const MonthMultiSelect: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  onToggleAll: () => void;
}> = ({ options, selected, onToggle, onToggleAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = selected.length === options.length && options.length > 0;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 flex items-center justify-between text-sm text-slate-700 transition-all hover:border-blue-300"
      >
        <span className="truncate">{selected.length === 0 ? "Selecionar Mês(es)" : `${selected.length} mês(es) selecionado(s)`}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          <div className="p-2 space-y-1">
            <button 
              onClick={onToggleAll}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-black uppercase text-blue-600 hover:bg-slate-50"
            >
              {allSelected ? "Desmarcar Todos" : "Selecionar Todos"}
            </button>
            <div className="h-px bg-slate-100 my-1" />
            {options.map((opt) => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${isSel ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="uppercase">{opt}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}>
                    {isSel && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface AuditData {
  mes: string;
  ano: number;
  razao: string;
  ul: string;
  solicitadas: number;
  realizadas: number;
  nao_realizadas: number;
  matr: string;
  cod: string;
  leitura: number;
  dig: string;
  indicador: number;
}

const EvidenceAuditControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  const [options, setOptions] = useState<{ anos: string[], meses: string[], matriculas: string[] }>({
    anos: [], meses: [], matriculas: []
  });

  const [rawResults, setRawResults] = useState<AuditData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<'completo' | 'razao'>('completo');
  const [currentPage, setCurrentPage] = useState(1);
  const [chartMode, setChartMode] = useState<'mes' | 'ano' | 'matr'>('mes');

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [anoRes, mesRes, matrRes] = await Promise.all([
          supabase.from(TABLE_NAME).select('Ano').order('Ano', { ascending: false }),
          supabase.from(TABLE_NAME).select('Mes').order('Mes', { ascending: true }),
          supabase.from(TABLE_NAME).select('matr').order('matr', { ascending: true })
        ]);
        
        // Add explicit types to fix "Type 'unknown' cannot be used as an index type" error
        setOptions({
          anos: Array.from(new Set((anoRes.data || []).map((r: any) => String(r.Ano)))),
          meses: Array.from(new Set((mesRes.data || []).map((r: any) => String(r.Mes)))).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)),
          matriculas: Array.from(new Set((matrRes.data || []).map((r: any) => String(r.matr))))
        });
      } catch (err) { console.error(err); }
    };
    fetchFilters();
  }, []);

  const handleGenerate = async () => {
    if (!filterAno || filterMeses.length === 0) return;
    
    setLoading(true);
    try {
      let query = supabase.from(TABLE_NAME).select('Mes, Ano, rz, rz_ul_lv, matr, nl, l_atual, digitacao, foto, instalacao');
      
      query = query.eq('Ano', Number(filterAno)).in('Mes', filterMeses);
      if (filterMatr) query = query.eq('matr', filterMatr);
      
      // Lógica UL DE/PARA
      // Como rz_ul_lv costuma ser string, mas o usuário quer numérico >= <=
      // Vamos tentar converter o campo na query ou filtrar no frontend para maior precisão se o volume permitir
      const { data, error } = await query;
      if (error) throw error;

      let filtered = data as any[];
      
      // Aplicar filtro UL manual se preenchido
      if (filterUlDe || filterUlPara) {
        filtered = filtered.filter(row => {
          const ulVal = parseInt(String(row.rz_ul_lv).replace(/\D/g, '')) || 0;
          const deVal = filterUlDe ? parseInt(filterUlDe) : 0;
          const paraVal = filterUlPara ? parseInt(filterUlPara) : 99999999;
          return ulVal >= deVal && ulVal <= paraVal;
        });
      }

      // Processar dados para a tabela
      // Agrupar por UL para o relatório completo conforme solicitado (SOLICITADAS where digitacao > 1)
      const auditMap: Record<string, AuditData> = {};
      
      filtered.forEach(row => {
        const key = `${row.Mes}|${row.Ano}|${row.rz_ul_lv}|${row.matr}`;
        const isSolicitada = parseInt(row.digitacao) > 1;
        const isRealizada = String(row.foto).toUpperCase() === 'OK';
        const isNaoRealizada = String(row.foto).toUpperCase() === 'N-OK';

        if (!auditMap[key]) {
          auditMap[key] = {
            mes: row.Mes,
            ano: row.Ano,
            razao: row.rz,
            ul: row.rz_ul_lv,
            solicitadas: isSolicitada ? 1 : 0,
            realizadas: isRealizada ? 1 : 0,
            nao_realizadas: isNaoRealizada ? 1 : 0,
            matr: row.matr,
            cod: row.nl,
            leitura: row.l_atual,
            dig: row.digitacao,
            indicador: 0
          };
        } else {
          if (isSolicitada) auditMap[key].solicitadas += 1;
          if (isRealizada) auditMap[key].realizadas += 1;
          if (isNaoRealizada) auditMap[key].nao_realizadas += 1;
        }
      });

      const finalData = Object.values(auditMap).map(item => ({
        ...item,
        indicador: item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0
      })).sort((a, b) => b.indicador - a.indicador);

      setRawResults(finalData);
      setHasGenerated(true);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentTableData = useMemo(() => {
    if (activeTab === 'completo') return rawResults;
    
    // Aba por Razão
    const grouped: Record<string, AuditData> = {};
    rawResults.forEach(item => {
      const key = item.razao;
      if (!grouped[key]) {
        grouped[key] = { ...item, ul: 'AGRUPADO', solicitadas: item.solicitadas, realizadas: item.realizadas, nao_realizadas: item.nao_realizadas };
      } else {
        grouped[key].solicitadas += item.solicitadas;
        grouped[key].realizadas += item.realizadas;
        grouped[key].nao_realizadas += item.nao_realizadas;
      }
    });

    return Object.values(grouped).map(item => ({
      ...item,
      indicador: item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0
    })).sort((a,b) => b.indicador - a.indicador);
  }, [activeTab, rawResults]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTableData.slice(start, start + ITEMS_PER_PAGE);
  }, [currentTableData, currentPage]);

  const totalPages = Math.ceil(currentTableData.length / ITEMS_PER_PAGE) || 1;

  const getRowColor = (ind: number) => {
    if (ind >= 0.50) return 'bg-[#991b1b] text-white font-bold';
    if (ind >= 0.41) return 'bg-[#b45309] text-white';
    return 'bg-[#166534] text-white';
  };

  const totals = useMemo(() => {
    return rawResults.reduce((acc, curr) => ({
      sol: acc.sol + curr.solicitadas,
      rea: acc.rea + curr.realizadas,
      nre: acc.nre + curr.nao_realizadas
    }), { sol: 0, rea: 0, nre: 0 });
  }, [rawResults]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { label: string, indicador: number, count: number }> = {};
    rawResults.forEach(item => {
      const key = chartMode === 'mes' ? item.mes : chartMode === 'ano' ? String(item.ano) : item.matr;
      if (!grouped[key]) {
        grouped[key] = { label: key, indicador: item.indicador, count: 1 };
      } else {
        grouped[key].indicador += item.indicador;
        grouped[key].count += 1;
      }
    });
    return Object.values(grouped).map(g => ({
      name: g.label,
      indicador: Number((g.indicador / g.count).toFixed(2))
    })).sort((a,b) => b.indicador - a.indicador).slice(0, 15);
  }, [rawResults, chartMode]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(currentTableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `SAL_Auditoria_${activeTab}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const head = [["MES", "ANO", "RAZÃO", "UL", "SOLIC", "REALIZ", "N-REALIZ", "MATR", "COD", "INDICADOR"]];
    const body = currentTableData.map(r => [
      r.mes, r.ano, r.razao, r.ul, r.solicitadas, r.realizadas, r.nao_realizadas, r.matr, r.cod, `${r.indicador.toFixed(2)}%`
    ]);
    autoTable(doc, { head, body, theme: 'grid', styles: { fontSize: 7 } });
    doc.save(`SAL_Auditoria_${activeTab}.pdf`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* SEÇÃO DE FILTROS */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-black text-white rounded-2xl"><Filter size={20} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Selecione os dados desejados:</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parâmetros de Auditoria de Campo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano</label>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 font-bold">
              <option value="">Selecione</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês (Múltiplo)</label>
            <MonthMultiSelect 
              options={options.meses} 
              selected={filterMeses} 
              onToggle={v => setFilterMeses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
              onToggleAll={() => setFilterMeses(p => p.length === options.meses.length ? [] : [...options.meses])}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
            <select value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 font-bold">
              <option value="">Todas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UL DE</label>
            <input 
              type="text" 
              value={filterUlDe} 
              maxLength={8}
              onChange={e => setFilterUlDe(e.target.value.replace(/\D/g, ''))}
              placeholder="00000000"
              className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UL PARA</label>
            <input 
              type="text" 
              value={filterUlPara} 
              maxLength={8}
              onChange={e => setFilterUlPara(e.target.value.replace(/\D/g, ''))}
              placeholder="99999999"
              className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 font-bold"
            />
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button 
            onClick={handleGenerate} 
            disabled={loading || !filterAno || filterMeses.length === 0}
            className="px-20 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 transition-all hover:scale-105 disabled:opacity-20"
          >
            {loading ? <Activity className="animate-spin" size={20}/> : <Play size={20} fill="currentColor"/>}
            GERAR
          </button>
        </div>
      </section>

      {hasGenerated && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          {/* INDICADORES RÁPIDOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard label="Solicitadas" value={totals.sol.toLocaleString()} color="blue" icon={<Calendar size={20}/>} />
            <IndicatorCard label="Realizadas" value={totals.rea.toLocaleString()} color="green" icon={<Check size={20}/>} />
            <IndicatorCard label="Não-Realizadas" value={totals.nre.toLocaleString()} color="red" icon={<AlertTriangle size={20}/>} />
            <IndicatorCard label="Indicador Global" value={totals.sol > 0 ? (totals.rea / totals.sol * 100).toFixed(2) : '0,00'} suffix="%" color="amber" icon={<TrendingUp size={20}/>} />
          </div>

          {/* TABELA COM ABAS */}
          <section className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button 
                  onClick={() => setActiveTab('completo')}
                  className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'completo' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Relatório Completo
                </button>
                <button 
                  onClick={() => setActiveTab('razao')}
                  className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'razao' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Por Razão
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100">
                  <FileSpreadsheet size={16}/> EXCEL
                </button>
                <button onClick={exportToPDF} className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100">
                  <FileText size={16}/> PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-left">
                  <tr>
                    <th className="px-6 py-4">MES</th>
                    <th className="px-6 py-4">ANO</th>
                    <th className="px-6 py-4">RAZÃO</th>
                    <th className="px-6 py-4">UL</th>
                    <th className="px-6 py-4 text-center">SOLIC</th>
                    <th className="px-6 py-4 text-center">REALIZ</th>
                    <th className="px-6 py-4 text-center">N-REALIZ</th>
                    <th className="px-6 py-4">MATR</th>
                    <th className="px-6 py-4">COD</th>
                    <th className="px-6 py-4 text-right">INDICADOR</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className={`${getRowColor(row.indicador)} border-b border-white/10 transition-colors`}>
                      <td className="px-6 py-4 uppercase">{row.mes}</td>
                      <td className="px-6 py-4">{row.ano}</td>
                      <td className="px-6 py-4 font-bold">{row.razao}</td>
                      <td className="px-6 py-4">{row.ul}</td>
                      <td className="px-6 py-4 text-center">{row.solicitadas}</td>
                      <td className="px-6 py-4 text-center">{row.realizadas}</td>
                      <td className="px-6 py-4 text-center">{row.nao_realizadas}</td>
                      <td className="px-6 py-4">{row.matr}</td>
                      <td className="px-6 py-4">{row.cod}</td>
                      <td className="px-6 py-4 text-right font-black">{row.indicador.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 border-t flex items-center justify-between bg-slate-50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white border rounded-lg shadow-sm disabled:opacity-30"><ChevronLeft size={16}/></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-2 bg-white border rounded-lg shadow-sm disabled:opacity-30"><ChevronRight size={16}/></button>
              </div>
            </div>
          </section>

          {/* GRÁFICO ANALÍTICO */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BarChart3 size={20}/></div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gráfico Analítico de Desempenho</h3>
              </div>
              <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                {(['mes', 'ano', 'matr'] as const).map(m => (
                  <button 
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${chartMode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    {m === 'matr' ? 'Matrícula' : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} unit="%" />
                  <Tooltip 
                    cursor={{fill: '#f8fafc', radius: 12}}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px', fontSize: '11px', fontWeight: 'bold' }} 
                  />
                  <Bar dataKey="indicador" name="Indicador (%)" barSize={40} radius={[12, 12, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.indicador >= 0.50 ? '#991b1b' : entry.indicador >= 0.41 ? '#b45309' : '#166534'} />
                    ))}
                    <LabelList dataKey="indicador" position="top" style={{ fill: '#0f172a', fontSize: '12px', fontWeight: '900' }} offset={10} formatter={(v: number) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-200 rounded-[3.5rem] bg-white text-center">
          <div className="p-10 bg-slate-50 rounded-full mb-6 text-slate-200"><Camera size={80} /></div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Relatório de Evidências v9</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em] mt-4 max-w-md">Configure os filtros acima e clique em GERAR para materializar a análise de fotos e digitização</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center">
           <div className="bg-white p-20 rounded-[4rem] shadow-2xl flex flex-col items-center gap-10">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Database size={40} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Cruzando Matrizes de Fotos...</h2>
           </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceAuditControl;
