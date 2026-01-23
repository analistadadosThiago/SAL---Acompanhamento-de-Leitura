
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  TABLE_NAME,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, Loader2, Database, 
  TrendingUp, Layout, 
  ChevronLeft, ChevronRight,
  ShieldAlert, ScanLine, 
  Printer, AlertCircle, FileSpreadsheet, FileText, BarChart3, Info,
  Search, CheckCircle2, ChevronDown, Activity
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LabelList, Legend, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import IndicatorCard from './IndicatorCard';

const ITEMS_PER_PAGE = 25;

enum PrintSubMenu {
  NOSB_IMPEDIMENTO = 'NOSB_IMPEDIMENTO',
  NOSB_SIMULACAO = 'NOSB_SIMULACAO'
}

interface OptionItem {
  label: string;
  value: string;
}

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  
  // Filtros de Estado
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  // Opções para Selects
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as OptionItem[],
    razoes: [] as OptionItem[],
    matriculas: [] as OptionItem[]
  });

  // Controle de Dados
  const [fullDataset, setFullDataset] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartDimension, setChartDimension] = useState<'rz' | 'matr' | 'motivo'>('rz');

  const menuConfig = {
    [PrintSubMenu.NOSB_IMPEDIMENTO]: {
      label: 'Impedimentos (NOSB)',
      icon: <ShieldAlert size={16}/>,
      motivoKey: 'nosb_impedimento'
    },
    [PrintSubMenu.NOSB_SIMULACAO]: {
      label: 'Simulação (NOSB)',
      icon: <ScanLine size={16}/>,
      motivoKey: 'nosb_simulacao'
    }
  };

  const currentConfig = menuConfig[activeSubMenu];

  // Carregar Metadados de Data (Ano/Mês)
  useEffect(() => {
    const fetchBaseFilters = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        
        const anosList = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a, b) => Number(b) - Number(a));
        const mesesList = (resMeses.data || [])
          .map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map(m => ({ label: m, value: m }));

        setOptions(prev => ({ ...prev, anos: anosList, meses: mesesList }));
      } catch (err) {
        console.error("Erro ao carregar filtros base:", err);
      }
    };
    fetchBaseFilters();
  }, []);

  // FASE 1: Executar RPC rpc_leitura_nosb e extrair filtros dinâmicos
  const handleProcessarRPC = useCallback(async (ano: string, mes: string) => {
    if (!ano || !mes) return;

    setLoading(true);
    // Não alteramos reportReady imediatamente para manter a estabilidade da UI enquanto carrega
    
    try {
      const { data, error } = await supabase.rpc('rpc_leitura_nosb', {
        p_ano: Number(ano),
        p_mes: mes
      });

      if (error) throw error;

      const dataset = Array.isArray(data) ? data : [];
      setFullDataset(dataset);

      // FASE 2: Popular filtros Razão e Matrícula via DISTINCT do retorno da RPC
      const rzSet = new Set<string>();
      const mtSet = new Set<string>();

      dataset.forEach(item => {
        // Suporte a variações de case conforme retorno da RPC
        const currentRz = item.rz ?? item.RZ;
        const currentMatr = item.matr ?? item.MATR;

        if (currentRz !== undefined && currentRz !== null && String(currentRz).trim() !== "") {
          rzSet.add(String(currentRz).trim());
        }
        if (currentMatr !== undefined && currentMatr !== null && String(currentMatr).trim() !== "") {
          mtSet.add(String(currentMatr).trim());
        }
      });

      setOptions(prev => ({
        ...prev,
        razoes: Array.from(rzSet).sort().map(v => ({ label: v, value: v })),
        matriculas: Array.from(mtSet).sort().map(v => ({ label: v, value: v }))
      }));

      setReportReady(true);
      setCurrentPage(1);
    } catch (err: any) {
      console.error("Erro ao processar rpc_leitura_nosb:", err);
      setReportReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // GATILHO AUTOMÁTICO: Ano + Mês = Executar RPC (Sem necessidade de clique em botão)
  useEffect(() => {
    if (filterAno && filterMes) {
      handleProcessarRPC(filterAno, filterMes);
    } else {
      // Reset de opções se os campos de data forem limpos
      setFullDataset([]);
      setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
      setReportReady(false);
    }
  }, [filterAno, filterMes, activeSubMenu, handleProcessarRPC]);

  const handleReset = () => {
    setFilterAno('');
    setFilterMes('');
    setFilterRazao('');
    setFilterMatr('');
    setFullDataset([]);
    setReportReady(false);
    setCurrentPage(1);
    setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
  };

  // Dataset Filtrado com base nos filtros da UI (Razão/Matrícula)
  const filteredData = useMemo(() => {
    return fullDataset.filter(item => {
      const itemRz = String(item.rz || item.RZ || '').trim();
      const itemMatr = String(item.matr || item.MATR || '').trim();
      const matchRz = filterRazao ? itemRz === filterRazao.trim() : true;
      const matchMatr = filterMatr ? itemMatr === filterMatr.trim() : true;
      return matchRz && matchMatr;
    });
  }, [fullDataset, filterRazao, filterMatr]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  // Relação Quantitativa agrupada por Razão e Motivo
  const relacaoQuantitativa = useMemo(() => {
    const map: Record<string, { rz: string, motivo: string, qtd: number }> = {};
    filteredData.forEach(r => {
      const rz = String(r.rz || r.RZ || 'N/A').trim();
      const motivo = String(r[currentConfig.motivoKey] || 'NÃO INFORMADO').trim();
      const key = `${rz}|${motivo}`;
      if (!map[key]) {
        map[key] = { rz, motivo, qtd: 0 };
      }
      map[key].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd);
  }, [filteredData, currentConfig.motivoKey]);

  // Dados do Gráfico Baseados na Dimensão Ativa
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(r => {
      let key = 'N/A';
      if (chartDimension === 'rz') key = String(r.rz || r.RZ || 'N/A');
      else if (chartDimension === 'matr') key = String(r.matr || r.MATR || 'N/A');
      else if (chartDimension === 'motivo') key = String(r[currentConfig.motivoKey] || 'N/A');
      
      key = key.trim();
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [filteredData, chartDimension, currentConfig.motivoKey]);

  const exportExcel = () => {
    if (filteredData.length === 0) return;
    const exportRows = filteredData.map(r => ({
      MÊS: r.mes || r.Mes,
      ANO: r.ano || r.Ano,
      RAZÃO: r.rz || r.RZ,
      UL: r.rz_ul_lv,
      INSTALAÇÃO: r.instalacao,
      MEDIDOR: r.medidor,
      REG: r.reg,
      TIPO: r.tipo,
      MATRÍCULA: r.matr || r.MATR,
      CÓDIGO: r.nl,
      LEITURA: r.l_atual,
      MOTIVO: r[currentConfig.motivoKey] || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle Impressão");
    XLSX.writeFile(wb, `SAL_Impressao_${filterMes}_${filterAno}.xlsx`);
  };

  const exportPDF = () => {
    if (filteredData.length === 0) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Relatório: ${currentConfig.label}`, 15, 10);
    
    autoTable(doc, {
      html: '#print-table-main',
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      margin: { top: 20 }
    });
    doc.save(`SAL_Relatorio_Impressao.pdf`);
  };

  return (
    <div className="space-y-10 pb-40 animate-in fade-in duration-500">
      <nav className="bg-white p-2 rounded-[24px] flex gap-2 shadow-sm border border-slate-200 no-print">
        {Object.entries(menuConfig).map(([key, config]) => {
          const isActive = activeSubMenu === key;
          return (
            <button 
              key={key} 
              onClick={() => { setActiveSubMenu(key as PrintSubMenu); handleReset(); }} 
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'bg-slate-950 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </nav>

      <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-wrap gap-x-12 gap-y-4 no-print border border-white/5 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Printer size={120} /></div>
         <div className="flex flex-col z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Ano</span>
            <span className="text-lg font-black italic">{filterAno || '--'}</span>
         </div>
         <div className="flex flex-col z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Mês</span>
            <span className="text-lg font-black italic uppercase">{filterMes || '--'}</span>
         </div>
         <div className="flex flex-col z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Unidade</span>
            <span className="text-lg font-black italic truncate max-w-[180px]">{filterRazao || 'TODAS'}</span>
         </div>
         <div className="flex flex-col z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Técnico</span>
            <span className="text-lg font-black italic">{filterMatr || 'GERAL'}</span>
         </div>
      </div>

      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione o Ano</label>
             <select value={filterAno} onChange={e => { setFilterAno(e.target.value); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all">
               <option value="">Selecione...</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione o Mês</label>
             <select value={filterMes} onChange={e => { setFilterMes(e.target.value); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all">
               <option value="">Selecione...</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Razão Social</label>
             <select disabled={options.razoes.length === 0} value={filterRazao} onChange={e => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold disabled:opacity-30 outline-none">
               <option value="">Todas ({options.razoes.length})</option>
               {options.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula / Técnico</label>
             <select disabled={options.matriculas.length === 0} value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold disabled:opacity-30 outline-none">
               <option value="">Geral ({options.matriculas.length})</option>
               {options.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button 
             onClick={() => handleProcessarRPC(filterAno, filterMes)} 
             disabled={!filterAno || !filterMes || loading} 
             className="px-20 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/30 flex items-center gap-4 hover:bg-blue-700 hover:scale-[1.02] transition-all disabled:opacity-50"
           >
              {loading ? <Loader2 className="animate-spin" size={18}/> : <Play size={16} fill="currentColor"/>} 
              REPROCESSAR AUDITORIA
           </button>
           <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[24px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all">
              <RotateCcw size={16} /> REINICIAR
           </button>
        </div>
      </section>

      {reportReady && (
        <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-700">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <IndicatorCard label="Dataset Carregado" value={filteredData.length.toLocaleString()} icon={<Database size={24}/>} color="blue" />
              <IndicatorCard label="Ocorrências" value={filteredData.length.toLocaleString()} icon={<ShieldAlert size={24}/>} color="red" />
              <IndicatorCard label="Cobertura de Lote" value="100" suffix="%" icon={<CheckCircle2 size={24}/>} color="amber" />
           </div>

           <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 no-print">
                <div className="flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  <h3 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Listagem Analítica</h3>
                </div>
                <div className="flex gap-4">
                   <button onClick={exportExcel} className="flex items-center gap-3 px-8 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all"><FileSpreadsheet size={18} className="text-green-600"/> EXCEL</button>
                   <button onClick={exportPDF} className="flex items-center gap-3 px-8 py-3.5 bg-slate-950 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all"><FileText size={18}/> PDF</button>
                </div>
              </div>
              
              <div className="overflow-x-auto p-10">
                 <table id="print-table-main" className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-900 uppercase font-black tracking-widest border-y border-slate-200">
                       <tr>
                         <th className="px-6 py-5">MES</th>
                         <th className="px-6 py-5">ANO</th>
                         <th className="px-6 py-5">RAZÃO</th>
                         <th className="px-6 py-5">UL</th>
                         <th className="px-6 py-5">INSTAL</th>
                         <th className="px-6 py-5">MEDIDOR</th>
                         <th className="px-6 py-5">REG</th>
                         <th className="px-6 py-5">TIPO</th>
                         <th className="px-6 py-5">MATR</th>
                         <th className="px-6 py-5">COD</th>
                         <th className="px-6 py-5">LEITURA</th>
                         <th className="px-6 py-5 text-blue-600">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {paginatedData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 uppercase font-bold">{r.mes || r.Mes}</td>
                          <td className="px-6 py-4">{r.ano || r.Ano}</td>
                          <td className="px-6 py-4 font-black truncate max-w-[150px]">{r.rz || r.RZ}</td>
                          <td className="px-6 py-4 text-slate-500">{r.rz_ul_lv}</td>
                          <td className="px-6 py-4 font-mono font-black text-blue-600">{r.instalacao}</td>
                          <td className="px-6 py-4 font-mono">{r.medidor}</td>
                          <td className="px-6 py-4">{r.reg}</td>
                          <td className="px-6 py-4 text-[9px] uppercase font-bold">{r.tipo}</td>
                          <td className="px-6 py-4 font-black">{r.matr || r.MATR}</td>
                          <td className="px-6 py-4"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black">{r.nl}</span></td>
                          <td className="px-6 py-4 font-black">{r.l_atual}</td>
                          <td className="px-6 py-4 font-bold italic text-slate-600">{r[currentConfig.motivoKey]}</td>
                        </tr>
                       ))}
                       {filteredData.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest">Nenhum registro encontrado para os filtros selecionados</td>
                        </tr>
                       )}
                    </tbody>
                 </table>
              </div>

              <div className="px-10 py-8 bg-slate-50 flex items-center justify-between no-print">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-4">
                   <button onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); }} disabled={currentPage === 1} className="px-6 py-3 bg-white border border-slate-200 rounded-xl disabled:opacity-30"><ChevronLeft size={16}/></button>
                   <button onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); }} disabled={currentPage >= totalPages} className="px-6 py-3 bg-white border border-slate-200 rounded-xl disabled:opacity-30"><ChevronRight size={16}/></button>
                </div>
              </div>
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden h-fit">
                 <div className="p-10 border-b border-slate-100 flex items-center gap-4">
                    <BarChart3 size={20} className="text-blue-600" />
                    <h3 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Relação Quantitativa</h3>
                 </div>
                 <div className="p-10">
                    <div className="overflow-y-auto max-h-[400px]">
                       <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                             <tr>
                                <th className="px-6 py-4">RAZÃO SOCIAL</th>
                                <th className="px-6 py-4">MOTIVO</th>
                                <th className="px-6 py-4 text-center">TOTAL</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {relacaoQuantitativa.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                   <td className="px-6 py-4 font-black text-slate-900 uppercase">{row.rz}</td>
                                   <td className="px-6 py-4 italic text-slate-500">{row.motivo}</td>
                                   <td className="px-6 py-4 text-center"><span className="px-3 py-1 bg-blue-50 text-blue-700 font-black rounded-lg">{row.qtd}</span></td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </section>

              <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 flex flex-col">
                 <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                       <TrendingUp size={22} className="text-blue-600" />
                       <h3 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Top Ocorrências</h3>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                       <button onClick={() => setChartDimension('rz')} className={`px-4 py-2 text-[9px] font-black rounded-lg transition-all ${chartDimension === 'rz' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Unidade</button>
                       <button onClick={() => setChartDimension('matr')} className={`px-4 py-2 text-[9px] font-black rounded-lg transition-all ${chartDimension === 'matr' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Técnico</button>
                       <button onClick={() => setChartDimension('motivo')} className={`px-4 py-2 text-[9px] font-black rounded-lg transition-all ${chartDimension === 'motivo' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Motivo</button>
                    </div>
                 </div>
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 900}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="value" barSize={20} radius={[0, 10, 10, 0]}>
                           {chartData.map((e, i) => <Cell key={i} fill={i === 0 ? '#1e40af' : '#3b82f6'} />)}
                           <LabelList dataKey="value" position="right" style={{fontSize: 10, fontWeight: 900}} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </section>
           </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center">
           <div className="bg-white p-24 rounded-[60px] shadow-2xl flex flex-col items-center gap-10">
              <div className="relative h-24 w-24">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Activity size={32} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="text-center">
                 <h2 className="text-2xl font-black uppercase italic text-slate-950">Auditoria Massiva</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Sincronizando rpc_leitura_nosb...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
