
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FINAL, 
  RPC_CE_V4,
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_FILTRO_MATR,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, AlertCircle, FileSpreadsheet, FileText, 
  ChevronLeft, ChevronRight, ChevronDown, Check, TrendingUp,
  Image as ImageIcon, Loader2, LayoutList, Calendar, Users, Database, Search, X, AlertTriangle, ShieldCheck, ClipboardCheck, Info, ArrowLeftRight, Eye, EyeOff
} from 'lucide-react';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, BarChart, Cell, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';

interface RawEvidenceData {
  Mes: string;
  Ano: number;
  rz: string;
  rz_ul_lv: string | number;
  matr: string;
  solicitadas: number;    
  realizadas: number;     
  nao_realizadas: number; 
  indicador?: number;
  foto?: string;
  instalacao?: string;
  tipo?: string;
  digitacao?: string | number;
}

const CustomTooltip = ({ active, payload, label, chartDimension, rawData }: any) => {
  if (active && payload && payload.length) {
    const details = rawData.filter((r: any) => {
      if (chartDimension === 'mes') return r.Mes === label;
      if (chartDimension === 'ano') return String(r.Ano) === label;
      if (chartDimension === 'matr') return r.matr === label;
      return false;
    });

    const subGroupKey = chartDimension === 'mes' ? 'rz' : 'Mes';
    const subLabel = chartDimension === 'mes' ? 'Razão' : 'Mês';

    const groupedDetails: Record<string, any> = {};
    details.forEach((d: any) => {
      const key = d[subGroupKey] || 'N/A';
      if (!groupedDetails[key]) {
        groupedDetails[key] = { solicitadas: 0, realizadas: 0, nao_realizadas: 0 };
      }
      groupedDetails[key].solicitadas += Number(d.solicitadas) || 0;
      groupedDetails[key].realizadas += Number(d.realizadas) || 0;
      groupedDetails[key].nao_realizadas += Number(d.nao_realizadas) || 0;
    });

    return (
      <div className="bg-white p-5 rounded-[24px] shadow-2xl border border-slate-100 text-[10px] animate-in fade-in zoom-in-95 duration-200 max-w-[320px] max-h-[450px] overflow-y-auto">
        <p className="font-black text-slate-900 mb-3 border-b border-slate-100 pb-2 uppercase tracking-tighter sticky top-0 bg-white z-10">
          {chartDimension === 'mes' ? 'Mês' : chartDimension === 'ano' ? 'Ano' : 'Matrícula'}: {label}
        </p>
        
        <div className="space-y-3">
          {Object.entries(groupedDetails).map(([key, stats]: [string, any]) => {
            const ind = stats.solicitadas > 0 ? (stats.realizadas / stats.solicitadas) * 100 : 0;
            return (
              <div key={key} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-blue-600 uppercase mb-2 truncate" title={key}>{subLabel}: {key}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-slate-400 font-bold uppercase">Solicitadas:</span>
                  <span className="text-right font-black">{stats.solicitadas.toLocaleString()}</span>
                  <span className="text-slate-400 font-bold uppercase">Realizadas:</span>
                  <span className="text-right font-black">{stats.realizadas.toLocaleString()}</span>
                  <span className="text-slate-400 font-bold uppercase">Não-Realiz:</span>
                  <span className="text-right font-black">{stats.nao_realizadas.toLocaleString()}</span>
                  <span className="text-red-700 font-bold uppercase border-t border-slate-200 mt-1 pt-1">Indicador:</span>
                  <span className="text-right font-black text-red-700 border-t border-slate-200 mt-1 pt-1">{ind.toFixed(2).replace('.', ',')}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const EvidenceControl: React.FC = () => {
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string[]>([]);
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>(''); 
  const [filterUlDe, setFilterUlDe] = useState<string>('');
  const [filterUlPara, setFilterUlPara] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState<number>(30);
  const [chartDimension, setChartDimension] = useState<'mes' | 'ano' | 'matr'>('matr');
  const [viewMode, setViewMode] = useState<'leiturista' | 'razao'>('leiturista'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  const [options, setOptions] = useState<{ anos: string[], meses: string[], matriculas: string[], razoes: string[] }>({
    anos: [], meses: [], matriculas: [], razoes: []
  });

  const [openDropdown, setOpenDropdown] = useState<'mes' | 'razao' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [rawDataV2, setRawDataV2] = useState<RawEvidenceData[]>([]);
  const [rawDataV4, setRawDataV4] = useState<RawEvidenceData[]>([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [criticalResults, setCriticalResults] = useState<any[]>([]);
  const [showCrossValidation, setShowCrossValidation] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [resAno, resMes, resMatr, resRazao] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES), 
          supabase.rpc(RPC_CE_FILTRO_MATR),
          supabase.from('v_razoes').select('rz') 
        ]);

        const anos = Array.from(new Set((resAno.data || []).map((i: any) => String(i.ano || '').trim()))).filter(Boolean).sort();
        const mesesRaw: string[] = Array.from(new Set((resMes.data || []).map((i: any) => String(i.mes || '').trim()))).filter(Boolean) as string[];
        const mesesSorted = mesesRaw.sort((a: string, b: string) => (MONTH_ORDER[a.toUpperCase()] || 0) - (MONTH_ORDER[b.toUpperCase()] || 0));
        const matrs = Array.from(new Set((resMatr.data || []).map((i: any) => String(i.matr || '').trim()))).filter(Boolean).sort();
        const razoes = Array.from(new Set((resRazao.data || []).map((i: any) => String(i.rz || '').trim())))
          .filter(Boolean)
          .sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true }));

        setOptions({ anos, meses: mesesSorted, matriculas: matrs, razoes });
      } catch (err) {
        console.warn("Erro ao carregar metadados.");
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const aggregateData = (data: RawEvidenceData[], keyField: 'matr' | 'rz') => {
    const grouped: Record<string, any> = {};
    data.forEach(r => {
      const key = r[keyField] || 'N/A';
      if (!grouped[key]) {
        grouped[key] = { 
          Ano: r.Ano, 
          Mes: r.Mes, 
          rz: r.rz, 
          matr: r.matr, 
          rz_ul_lv: r.rz_ul_lv, 
          tipo: r.tipo,
          solicitadas: 0, 
          realizadas: 0, 
          nao_realizadas: 0 
        };
      }
      
      // REGRAS DE CONTAGEM OBRIGATÓRIAS (Reforçadas no Agrupamento)
      // Baseado na VIEW ou nos dados brutos da RPC
      if (r.instalacao) {
          const isSolicitada = (Number(r.digitacao) || 0) > 2;
          if (isSolicitada) {
            grouped[key].solicitadas += 1;
            if (r.foto === 'OK') grouped[key].realizadas += 1;
            if (r.foto === 'N-OK') grouped[key].nao_realizadas += 1;
          }
      } else {
          // Se vier pré-agregado da RPC V4
          grouped[key].solicitadas += Number(r.solicitadas) || 0;
          grouped[key].realizadas += Number(r.realizadas) || 0;
          grouped[key].nao_realizadas += Number(r.nao_realizadas) || 0;
      }
    });

    return Object.values(grouped).map((r: any) => ({
      ...r,
      indicador: r.solicitadas > 0 ? (r.realizadas / r.solicitadas) * 100 : 0
    }));
  };

  const handleGenerate = async () => {
    if (!filterAno || filterMes.length === 0) {
      setErrorMsg("Para gerar o relatório, selecione obrigatoriamente o ANO e o MÊS.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setHasGenerated(false);
    
    try {
      const params: any = {};
      params.p_ano = Number(filterAno);
      params.p_mes = filterMes;
      if (filterMatr.trim() !== '') params.p_matr = filterMatr;
      if (filterRazao.trim() !== '') params.p_rz = filterRazao;
      if (filterUlDe.trim() !== '') params.p_ul_de = parseInt(filterUlDe);
      if (filterUlPara.trim() !== '') params.p_ul_para = parseInt(filterUlPara);

      // Validação Cruzada: V2 vs V4
      const [resV2, resV4] = await Promise.all([
        supabase.rpc(RPC_CE_FINAL, params),
        supabase.rpc(RPC_CE_V4, params)
      ]);

      if (resV2.error) throw resV2.error;
      if (resV4.error) throw resV4.error;
      
      const processedResultsV2 = (resV2.data as any[] || []).map(r => ({
          ...r,
          Ano: r.Ano !== undefined ? r.Ano : (r.ano || 0),
          Mes: r.Mes !== undefined ? r.Mes : (r.mes || ''),
          rz: r.rz !== undefined ? r.rz : (r.razao || ''),
          rz_ul_lv: r.rz_ul_lv !== undefined ? r.rz_ul_lv : (r.ul || ''),
          matr: r.matr !== undefined ? r.matr : (r.matricula || ''),
          solicitadas: Number(r.solicitadas || 0),
          realizadas: Number(r.realizadas || 0),
          nao_realizadas: Number(r.nao_realizadas || 0)
      }));
      
      const processedResultsV4 = (resV4.data as any[] || []).map(r => ({
        ...r,
        Ano: r.Ano !== undefined ? r.Ano : (r.ano || 0),
        Mes: r.Mes !== undefined ? r.Mes : (r.mes || ''),
        rz: r.rz !== undefined ? r.rz : (r.razao || ''),
        rz_ul_lv: r.rz_ul_lv !== undefined ? r.rz_ul_lv : (r.ul || ''),
        matr: r.matr !== undefined ? r.matr : (r.matricula || ''),
        tipo: r.tipo || (r.leit_urb > 0 ? 'Urbano' : r.leit_povoado > 0 ? 'Povoado' : 'Rural'),
        solicitadas: Number(r.solicitadas || 0),
        realizadas: Number(r.realizadas || 0),
        nao_realizadas: Number(r.nao_realizadas || 0)
      }));

      setRawDataV2(processedResultsV2 as RawEvidenceData[]);
      setRawDataV4(processedResultsV4 as RawEvidenceData[]);
      setHasGenerated(true);
      setCurrentPage(1);

      // Alerta crítico baseado na Nova Regra (V4)
      const leituristaAgregado = aggregateData(processedResultsV4, 'matr');
      const critical = leituristaAgregado
        .filter(r => (r.indicador || 0) < 50)
        .sort((a, b) => (a.indicador || 0) - (b.indicador || 0));
      
      setCriticalResults(critical);
      setIsModalOpen(true);

      if (processedResultsV4.length === 0) {
        setErrorMsg("Nenhum dado encontrado para os filtros selecionados.");
      }
    } catch (err: any) {
      setErrorMsg("Erro na comunicação com a base de dados.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRawData = useMemo(() => {
    return rawDataV4.filter(r => {
      const matchesSearch = searchTerm === '' || String(r.matr).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo = filterTipo === '' || r.tipo === filterTipo;
      return matchesSearch && matchesTipo;
    });
  }, [rawDataV4, searchTerm, filterTipo]);

  const leituristaDataSorted = useMemo(() => {
    return aggregateData(filteredRawData, 'matr').sort((a, b) => (a.indicador || 0) - (b.indicador || 0));
  }, [filteredRawData]);

  const razaoDataSorted = useMemo(() => {
    return aggregateData(filteredRawData, 'rz').sort((a, b) => String(a.rz).localeCompare(String(b.rz)));
  }, [filteredRawData]);

  const displayData = viewMode === 'leiturista' ? leituristaDataSorted : razaoDataSorted;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayData.slice(start, start + itemsPerPage);
  }, [displayData, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => Math.ceil(displayData.length / itemsPerPage), [displayData, itemsPerPage]);

  const validationStats = useMemo(() => {
    // Totais Antigos (V2)
    const v2Solic = rawDataV2.reduce((acc, r) => acc + (Number(r.solicitadas) || 0), 0);
    const v2Realiz = rawDataV2.reduce((acc, r) => acc + (Number(r.realizadas) || 0), 0);
    const v2NRealiz = rawDataV2.reduce((acc, r) => acc + (Number(r.nao_realizadas) || 0), 0);
    const v2Ind = v2Solic > 0 ? (v2Realiz / v2Solic) * 100 : 0;

    // Totais Novos (V4) - Dataset oficial em exibição
    const finalSolic = displayData.reduce((acc, r) => acc + (Number(r.solicitadas) || 0), 0);
    const finalRealiz = displayData.reduce((acc, r) => acc + (Number(r.realizadas) || 0), 0);
    const finalNRealiz = displayData.reduce((acc, r) => acc + (Number(r.nao_realizadas) || 0), 0);
    const finalInd = finalSolic > 0 ? (finalRealiz / finalSolic) * 100 : 0;

    const totalRegistros = rawDataV4.length;

    return { 
      totalRegistros, 
      finalSolic, finalRealiz, finalNRealiz, finalInd,
      v2Solic, v2Realiz, v2NRealiz, v2Ind,
      hasInconsistency: Math.abs(finalSolic - v2Solic) > 0.1 || Math.abs(finalRealiz - v2Realiz) > 0.1
    };
  }, [rawDataV2, rawDataV4, displayData]);

  const getRowStyle = (indicador: number) => {
    if (indicador < 41) return 'bg-[#991b1b] text-white'; 
    if (indicador < 50) return 'bg-[#b45309] text-white'; 
    return 'bg-[#166534] text-white font-black'; 
  };

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    filteredRawData.forEach(r => {
      let key = '';
      if (chartDimension === 'mes') key = r.Mes;
      else if (chartDimension === 'ano') key = String(r.Ano);
      else if (chartDimension === 'matr') key = String(r.matr || 'N/A');

      if (!grouped[key]) {
        grouped[key] = { label: key, solicitadas: 0, realizadas: 0, nao_realizadas: 0 };
      }
      
      grouped[key].solicitadas += Number(r.solicitadas) || 0;
      grouped[key].realizadas += Number(r.realizadas) || 0;
      grouped[key].nao_realizadas += Number(r.nao_realizadas) || 0;
    });

    let result = Object.values(grouped).map(g => ({
      ...g,
      indicador: g.solicitadas > 0 ? (g.realizadas / g.solicitadas * 100) : 0
    }));

    if (chartDimension === 'mes') {
      result.sort((a, b) => (MONTH_ORDER[a.label.toUpperCase()] || 0) - (MONTH_ORDER[b.label.toUpperCase()] || 0));
    } else if (chartDimension === 'ano') {
      result.sort((a, b) => Number(a.label) - Number(b.label));
    } else if (chartDimension === 'matr') {
      result.sort((a, b) => (a.indicador || 0) - (b.indicador || 0));
    }

    return result;
  }, [filteredRawData, chartDimension]);

  const handleReset = () => {
    setFilterAno('');
    setFilterMes([]);
    setFilterMatr('');
    setFilterRazao('');
    setFilterTipo('');
    setFilterUlDe('');
    setFilterUlPara('');
    setRawDataV2([]);
    setRawDataV4([]);
    setHasGenerated(false);
    setErrorMsg(null);
    setSearchTerm('');
  };

  const exportExcel = () => {
    if (displayData.length === 0) return;
    const exportRows = displayData.map((r: any) => ({
      'ANO': r.Ano,
      'MÊS': String(r.Mes).toUpperCase(),
      'RAZÃO': r.rz,
      ...(viewMode === 'leiturista' ? { 'MATRÍCULA': r.matr } : {}),
      'SOLICITADAS': r.solicitadas,
      'REALIZADAS': r.realizadas,
      'NÃO-REALIZADAS': r.nao_realizadas,
      'INDICADOR (%)': (r.indicador || 0).toFixed(2).replace('.', ',') + '%'
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Indicadores_v4");
    XLSX.writeFile(wb, `SAL_Evidencias_v4_${Date.now()}.xlsx`);
  };

  const validateUlInput = (val: string) => val.replace(/\D/g, '').slice(0, 8);

  const getValidationFieldStyle = (v2: number, v4: number) => {
    return Math.abs(v2 - v4) < 0.01 ? 'text-slate-400' : 'text-amber-500 font-black';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      
      {/* POP-UP CRÍTICO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-red-100 animate-in zoom-in-95 duration-300">
            <div className="bg-[#991b1b] p-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="animate-bounce" />
                <h2 className="text-lg font-black uppercase tracking-tighter">⚠️ Alerta de Baixo Desempenho (v4)</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8">
              {criticalResults.length > 0 ? (
                <div className="overflow-y-auto max-h-[400px] border border-slate-100 rounded-2xl">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-[10px] font-black uppercase text-slate-400">
                        <th className="px-6 py-4 border-r border-slate-200">Matrícula</th>
                        <th className="px-6 py-4 border-r border-slate-200">Razão</th>
                        <th className="px-6 py-4 text-center">Indicador (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {criticalResults.map((item, idx) => (
                        <tr key={idx} className="text-xs">
                          <td className="px-6 py-4 font-bold text-black border-r border-slate-200">{item.matr}</td>
                          <td className="px-6 py-4 text-slate-600 border-r border-slate-200">{item.rz}</td>
                          <td className="px-6 py-4 text-center font-black text-red-700">{item.indicador.toFixed(2).replace('.', ',')}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                   <Check className="mx-auto text-green-500 mb-4" size={48} />
                   <p className="text-slate-900 font-black uppercase tracking-tight">Qualidade dentro dos padrões estabelecidos.</p>
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <button onClick={() => setIsModalOpen(false)} className="px-10 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-black/10">Prosseguir para Relatório</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE FILTROS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-black text-white rounded-lg"><Filter size={18} /></div>
          <h2 className="text-sm font-bold text-black uppercase tracking-tight">Filtros de Evidência (v4)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">ANO</label>
            <select value={filterAno} onChange={(e) => setFilterAno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black">
              <option value="">Selecione</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-2 relative" ref={openDropdown === 'mes' ? dropdownRef : null}>
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">MÊS</label>
            <button onClick={() => setOpenDropdown(openDropdown === 'mes' ? null : 'mes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-left text-sm text-black flex justify-between items-center"><span className="truncate">{filterMes.length === 0 ? 'Selecionar' : `${filterMes.length} Meses`}</span><ChevronDown size={16} /></button>
            {openDropdown === 'mes' && (
              <div className="absolute z-[110] mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-h-64 overflow-y-auto p-2">
                <button onClick={() => filterMes.length === options.meses.length ? setFilterMes([]) : setFilterMes([...options.meses])} className="w-full text-left px-3 py-2 text-[10px] font-black uppercase text-blue-600 hover:bg-slate-50 mb-1">Selecionar Todos</button>
                {options.meses.map(m => (
                  <label key={m} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${filterMes.includes(m) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filterMes.includes(m) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-slate-50'}`}>{filterMes.includes(m) && <Check size={10} strokeWidth={4} />}</div>
                    <input type="checkbox" className="hidden" checked={filterMes.includes(m)} onChange={() => setFilterMes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} />
                    <span className="text-xs font-semibold uppercase">{m}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">Matrícula</label>
            <select value={filterMatr} onChange={(e) => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black"><option value="">Todas</option>{options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">Razão</label>
            <select value={filterRazao} onChange={(e) => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black"><option value="">Todas</option>{options.razoes.map(r => <option key={r} value={r}>{r}</option>)}</select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">Tipo</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black">
              <option value="">Todos</option>
              <option value="Urbano">Urbano</option>
              <option value="Rural">Rural</option>
              <option value="Povoado">Povoado</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">UL DE</label>
            <input type="text" maxLength={8} value={filterUlDe} onChange={(e) => setFilterUlDe(validateUlInput(e.target.value))} placeholder="00000000" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-black uppercase tracking-wider">UL PARA</label>
            <input type="text" maxLength={8} value={filterUlPara} onChange={(e) => setFilterUlPara(validateUlInput(e.target.value))} placeholder="99999999" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm text-black" />
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-3 px-16 py-4 bg-black text-white rounded-xl font-bold text-sm shadow-xl active:scale-95 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={16} fill="currentColor" />} GERAR RELATÓRIO V4</button>
          <button onClick={handleReset} className="flex items-center gap-2 px-8 py-4 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"><RotateCcw size={14} /> Limpar Filtros</button>
        </div>

        {errorMsg && <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-[11px] font-bold uppercase"><AlertCircle size={20} /><p>{errorMsg}</p></div>}
      </div>

      {hasGenerated && !loading && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
          
          {/* PAINEL DE VALIDAÇÃO CRUZADA (RPC V2 vs V4) */}
          <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-500">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><ArrowLeftRight size={20} /></div>
                   <div>
                      <h3 className="text-sm font-black uppercase tracking-tight">Validação Cruzada de Indicadores</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comparação Visual: RPC v2 (Antiga) vs RPC v4 (Nova Regra Quantitativa)</p>
                   </div>
                </div>
                <button 
                  onClick={() => setShowCrossValidation(!showCrossValidation)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                >
                  {showCrossValidation ? <><EyeOff size={14}/> Ocultar Painel</> : <><Eye size={14}/> Exibir Painel</>}
                </button>
             </div>

             {showCrossValidation && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in zoom-in-95 duration-300">
                   {[
                      { label: 'SOLICITADAS', v2: validationStats.v2Solic, v4: validationStats.finalSolic },
                      { label: 'REALIZADAS', v2: validationStats.v2Realiz, v4: validationStats.finalRealiz },
                      { label: 'NÃO-REALIZADAS', v2: validationStats.v2NRealiz, v4: validationStats.finalNRealiz },
                      { label: 'INDICADOR (%)', v2: validationStats.v2Ind, v4: validationStats.finalInd, isPerc: true }
                   ].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-4">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">{item.label}</p>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">RPC v2 (Legada)</p>
                               <p className="text-xl font-black text-slate-900">
                                  {item.isPerc ? `${item.v2.toFixed(2).replace('.', ',')}%` : item.v2.toLocaleString()}
                               </p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">RPC v4 (Quantitativa)</p>
                               <p className={`text-xl font-black ${getValidationFieldStyle(item.v2, item.v4)}`}>
                                  {item.isPerc ? `${item.v4.toFixed(2).replace('.', ',')}%` : item.v4.toLocaleString()}
                               </p>
                            </div>
                         </div>

                         <div className="mt-2 pt-3 border-t border-slate-200 flex items-center justify-between">
                            {Math.abs(item.v2 - item.v4) < 0.01 ? (
                               <span className="flex items-center gap-1.5 text-[9px] font-black text-green-600 uppercase">
                                  <Check size={12} strokeWidth={4} /> Valores Compatíveis
                               </span>
                            ) : (
                               <div className="flex flex-col gap-1">
                                  <span className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase">
                                     <AlertTriangle size={12} strokeWidth={4} /> Divergência por Regra
                                  </span>
                                  <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase cursor-help group relative">
                                     <Info size={10} /> 
                                     Ver Motivo
                                     <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none normal-case font-medium shadow-xl">
                                        Diferença esperada na RPC v4 devido à nova condição: digitacao > 2.
                                     </div>
                                  </div>
                               </div>
                            )}
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </section>

          {/* STATUS DA CONFERÊNCIA (V4) */}
          <section className="bg-slate-900 text-white p-8 rounded-[32px] shadow-2xl border border-slate-800 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5">
                <ShieldCheck size={120} />
             </div>
             
             <div className="flex items-center gap-3 mb-10 border-b border-white/10 pb-6 relative z-10">
                <div className="p-2 bg-blue-600 rounded-xl"><ClipboardCheck size={20} /></div>
                <div>
                   <h3 className="text-sm font-black uppercase tracking-tight">Status da Nova RPC (v4)</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Conformidade com Regras de Negócio Estabelecidas</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Métricas Dataset v4</p>
                   <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-bold border-b border-white/5 pb-1">
                         <span className="text-slate-400">Registros Processados:</span>
                         <span className="text-white">{validationStats.totalRegistros.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold border-b border-white/5 pb-1">
                         <span className="text-slate-400">Total Solicitadas (v4):</span>
                         <span className="text-blue-400">{validationStats.finalSolic.toLocaleString()}</span>
                      </div>
                   </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Indicadores Finais (Tabelas/Gráficos)</p>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Solicitadas</p>
                         <p className="text-lg font-black">{validationStats.finalSolic.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Realizadas</p>
                         <p className="text-lg font-black text-green-400">{validationStats.finalRealiz.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Não-Realiz.</p>
                         <p className="text-lg font-black text-red-400">{validationStats.finalNRealiz.toLocaleString()}</p>
                      </div>
                      <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-600/20">
                         <p className="text-[9px] font-black text-blue-100 uppercase tracking-tighter mb-1">Indicador (%)</p>
                         <p className="text-lg font-black">{validationStats.finalInd.toFixed(2).replace('.', ',')}%</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Consistência v2/v4</p>
                   {!validationStats.hasInconsistency ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3">
                         <div className="p-2 bg-green-500 rounded-full"><Check size={14} /></div>
                         <p className="text-[11px] font-black text-green-400 uppercase">Dados Idênticos</p>
                      </div>
                   ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                         <Info size={20} className="text-amber-500" />
                         <p className="text-[11px] font-black text-amber-500 uppercase">Divergência Nominal</p>
                      </div>
                   )}
                </div>
             </div>
          </section>

          {/* TABELA DE RESULTADOS (OFICIAL V4) */}
          <section className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 no-print">
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => { setViewMode('leiturista'); setCurrentPage(1); }} className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === 'leiturista' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Users size={14} /> Por Leiturista</button>
                  <button onClick={() => { setViewMode('razao'); setCurrentPage(1); }} className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${viewMode === 'razao' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Database size={14} /> Por Razão</button>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar Matrícula..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold outline-none" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportExcel} className="p-3 bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-100 transition-colors shadow-sm"><FileSpreadsheet size={18} /></button>
              </div>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-[10px] text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-black uppercase font-black tracking-wider border border-slate-200">
                  <tr>
                    <th className="px-6 py-4 border border-slate-200">ANO</th>
                    <th className="px-6 py-4 border border-slate-200">MÊS</th>
                    <th className="px-6 py-4 border border-slate-200">RAZÃO</th>
                    {viewMode === 'leiturista' && <th className="px-6 py-4 border border-slate-200">MATRÍCULA</th>}
                    <th className="px-6 py-4 text-center border border-slate-200">SOLICITADAS</th>
                    <th className="px-6 py-4 text-center border border-slate-200">REALIZADAS</th>
                    <th className="px-6 py-4 text-center border border-slate-200">NÃO-REALIZADAS</th>
                    <th className="px-6 py-4 text-center border border-slate-200 bg-black text-white">INDICADOR (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, idx) => {
                    const style = getRowStyle(row.indicador || 0);
                    return (
                      <tr key={idx} className={`${style} border border-slate-200`}>
                        <td className="px-6 py-3 border border-slate-200">{row.Ano}</td>
                        <td className="px-6 py-3 uppercase border border-slate-200">{row.Mes}</td>
                        <td className="px-6 py-3 border border-slate-200 whitespace-nowrap">{row.rz}</td>
                        {viewMode === 'leiturista' && <td className="px-6 py-3 border border-slate-200 font-bold">{row.matr}</td>}
                        <td className="px-6 py-3 text-center border border-slate-200">{row.solicitadas.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.realizadas.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center border border-slate-200">{row.nao_realizadas.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center border border-slate-200 font-black">{(row.indicador || 0).toFixed(2).replace('.', ',')}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Página {currentPage} de {totalPages || 1}</p>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2.5 rounded-lg bg-black text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2.5 rounded-lg bg-black text-white disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>

          {/* ANÁLISE GRÁFICA (BASEADA EM V4) */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 no-print">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-black" />
                <h3 className="text-sm font-black text-black uppercase tracking-tight">Análise Gráfica Evolutiva (v4)</h3>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter px-3">Agrupar Por:</span>
                <button onClick={() => setChartDimension('mes')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${chartDimension === 'mes' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Mês</button>
                <button onClick={() => setChartDimension('ano')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${chartDimension === 'ano' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Ano</button>
                <button onClick={() => setChartDimension('matr')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${chartDimension === 'matr' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Matrícula</button>
              </div>
            </div>

            <div className="h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} unit="%" />
                  <Tooltip cursor={{fill: '#f8fafc', opacity: 0.4}} content={<CustomTooltip chartDimension={chartDimension} rawData={filteredRawData} />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="indicador" name="Indicador (%)" radius={[4, 4, 0, 0]} barSize={32}>
                    <LabelList dataKey="indicador" position="top" formatter={(v: number) => `${v.toFixed(1).replace('.', ',')}%`} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#000' }} offset={10} />
                    {chartData.map((entry, index) => {
                      const ind = entry.indicador;
                      let fill = '#166534';
                      if (ind < 41) fill = '#991b1b';
                      else if (ind < 50) fill = '#b45309';
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 text-center border border-white/20">
             <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-[6px] border-slate-50 border-t-black animate-spin"></div>
                <Database size={24} className="absolute inset-0 m-auto text-black animate-pulse" />
             </div>
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Processando Indicadores v4</h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceControl;
