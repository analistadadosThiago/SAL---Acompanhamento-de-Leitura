
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  TABLE_NAME,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, Loader2, Database, 
  TrendingUp, List, 
  ChevronLeft, ChevronRight,
  ShieldAlert, ScanLine, 
  Printer, AlertCircle, Layout, FileSpreadsheet, FileText, BarChart3, Info,
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
  
  // Opções para Selects (Metadados)
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as OptionItem[],
    razoes: [] as OptionItem[],
    matriculas: [] as OptionItem[]
  });

  // Controle de Dados e UI
  const [dataset, setDataset] = useState<any[]>([]);
  const [reportReady, setReportReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartDimension, setChartDimension] = useState<'rz' | 'matr' | 'motivo'>('rz');

  const menuConfig = {
    [PrintSubMenu.NOSB_IMPEDIMENTO]: {
      label: 'Impedimentos (NOSB)',
      icon: <ShieldAlert size={16}/>,
      motivoKey: 'nosb_impedimento',
      rpc: RPC_CE_IMPEDIMENTOS
    },
    [PrintSubMenu.NOSB_SIMULACAO]: {
      label: 'Simulação (NOSB)',
      icon: <ScanLine size={16}/>,
      motivoKey: 'nosb_simulacao',
      rpc: RPC_CE_SIMULACAO_NOSB 
    }
  };

  const currentConfig = menuConfig[activeSubMenu];

  // Fase 0: Carregar Anos e Meses (Metadados Base)
  useEffect(() => {
    const fetchBaseMetadata = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        
        const anosList = (resAnos.data || []).map((a: any) => {
          if (typeof a === 'object') return String(Object.values(a)[0] || '');
          return String(a);
        }).filter(Boolean).sort((a: string, b: string) => Number(b) - Number(a));

        const mesesList = (resMeses.data || []).map((m: any) => {
          const mVal = typeof m === 'object' ? String(Object.values(m)[0] || '') : String(m);
          return { label: mVal.toUpperCase(), value: mVal };
        })
        .filter((m: any) => !!MONTH_ORDER[m.value] || !!MONTH_ORDER[m.value.toUpperCase()])
        .sort((a: any, b: any) => {
          const m1 = MONTH_ORDER[a.value] || MONTH_ORDER[a.value.toUpperCase()] || 0;
          const m2 = MONTH_ORDER[b.value] || MONTH_ORDER[b.value.toUpperCase()] || 0;
          return m1 - m2;
        });

        setOptions(prev => ({ ...prev, anos: anosList, meses: mesesList }));
      } catch (err) {
        console.error("SAL_ERROR: Erro ao carregar metadados iniciais.");
      }
    };
    fetchBaseMetadata();
  }, []);

  // FASE 1: CARGA DE PRÉ-FILTRO MATERIALIZADO (LEVE)
  useEffect(() => {
    const fetchPreFiltros = async () => {
      if (!filterAno || !filterMes) {
        setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
        return;
      }
      
      setLoadingFilters(true);
      try {
        const p_ano = Number(filterAno);
        const p_mes = filterMes;

        // Carga leve: apenas rz e matr para popular filtros sem sobrecarga
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .select('rz, matr')
          .eq('Ano', p_ano)
          .eq('Mes', p_mes);

        if (error) throw error;

        const rzSet = new Set<string>();
        const mtSet = new Set<string>();

        (data || []).forEach(item => {
          if (item.rz) rzSet.add(String(item.rz).trim());
          if (item.matr) mtSet.add(String(item.matr).trim());
        });

        const rzList = Array.from(rzSet).sort().map(val => ({ label: val, value: val }));
        const mtList = Array.from(mtSet).sort().map(val => ({ label: val, value: val }));

        setOptions(prev => ({ ...prev, razoes: rzList, matriculas: mtList }));
      } catch (err) {
        console.error("SAL_ERROR: Erro na Fase 1 (Pré-filtro).", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchPreFiltros();
  }, [filterAno, filterMes]);

  // FASE 2: CARGA DE DADOS DETALHADOS (SOB DEMANDA)
  const handleProcessarDataset = async () => {
    if (!filterAno || !filterMes) return;

    setLoading(true);
    setReportReady(false); 
    
    try {
      const numAno = Number(filterAno);
      const p_mes = filterMes;

      // Busca dados detalhados usando a RPC com os filtros de pré-seleção
      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: numAno,
        p_mes: p_mes,
        p_matr: filterMatr || null,
        p_rz: filterRazao || null,
        p_limit: 1000000, // Limite massivo para evitar cortes no dataset analítico
        p_offset: 0,
        p_motivo: null
      });

      if (error) throw error;
      setDataset(Array.isArray(data) ? data : []);
      setReportReady(true);
      setCurrentPage(1);
    } catch (err: any) { 
      console.error("SAL_ERROR: Erro na Fase 2 (Processamento Dataset):", err);
    } finally { 
      setLoading(false); 
    }
  };

  const handleReset = () => {
    setFilterAno('');
    setFilterMes('');
    setFilterRazao('');
    setFilterMatr('');
    setDataset([]);
    setReportReady(false);
    setCurrentPage(1);
  };

  // Paginação Visual do Dataset Carregado
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return dataset.slice(start, start + ITEMS_PER_PAGE);
  }, [dataset, currentPage]);

  const totalPages = Math.max(1, Math.ceil(dataset.length / ITEMS_PER_PAGE));

  // Relação Quantitativa (Agrupada por Razão e Motivo)
  const relacaoQuantitativa = useMemo(() => {
    const map: Record<string, { rz: string, motivo: string, qtd: number }> = {};
    dataset.forEach(r => {
      const rz = String(r.rz || r.RZ || r.razao || 'N/A').trim();
      const motivo = String(r[currentConfig.motivoKey] || 'N/A').trim();
      const key = `${rz}|${motivo}`;
      if (!map[key]) {
        map[key] = { rz, motivo, qtd: 0 };
      }
      map[key].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd);
  }, [dataset, currentConfig.motivoKey]);

  // Dados do Gráfico Baseado na Dimensão Selecionada
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    dataset.forEach(r => {
      let key = 'N/A';
      if (chartDimension === 'rz') key = String(r.rz || r.RZ || r.razao || 'N/A');
      else if (chartDimension === 'matr') key = String(r.matr || r.MATR || 'N/A');
      else if (chartDimension === 'motivo') key = String(r[currentConfig.motivoKey] || 'N/A');
      
      key = key.trim();
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [dataset, chartDimension, currentConfig.motivoKey]);

  const exportExcel = () => {
    if (dataset.length === 0) return;
    const exportData = dataset.map(r => ({
      MÊS: r.Mes || r.mes,
      ANO: r.Ano || r.ano,
      RAZÃO: r.rz || r.RZ || r.razao,
      UL: r.rz_ul_lv,
      INSTALAÇÃO: r.instalacao,
      MEDIDOR: r.medidor,
      REG: r.reg,
      TIPO: r.tipo,
      MATRÍCULA: r.matr || r.MATR,
      CÓDIGO: r.nl,
      LEITURA: r.l_atual,
      MOTIVO: r[currentConfig.motivoKey] || 'NÃO INFORMADO'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados Impressão");
    XLSX.writeFile(wb, `SAL_Export_${currentConfig.label}_${filterMes}_${filterAno}.xlsx`);
  };

  const exportPDF = () => {
    if (dataset.length === 0) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Relatório de Análise: ${currentConfig.label}`, 15, 10);
    doc.setFontSize(10);
    doc.text(`Período: ${filterMes}/${filterAno}`, 15, 16);
    
    autoTable(doc, {
      html: '#print-analitico-table',
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { top: 25 }
    });
    doc.save(`SAL_Relatorio_${currentConfig.label}.pdf`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-40">
      {/* Submenus Navigation */}
      <nav className="bg-white p-2 rounded-[24px] flex flex-wrap gap-2 shadow-sm border border-slate-200 no-print">
        {(Object.keys(PrintSubMenu) as Array<keyof typeof PrintSubMenu>).map((key) => {
          const subId = PrintSubMenu[key];
          const config = menuConfig[subId];
          const isActive = activeSubMenu === subId;
          return (
            <button 
              key={subId} 
              onClick={() => { setActiveSubMenu(subId); handleReset(); }} 
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                isActive 
                  ? 'bg-slate-950 text-white shadow-2xl shadow-slate-950/20' 
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </nav>

      {/* Informativo Visual Selecionado */}
      <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-wrap gap-x-16 gap-y-6 no-print border border-white/5 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12"><Printer size={160} /></div>
         <div className="flex flex-col relative z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Ano selecionado</span>
            <span className="text-lg font-black tracking-tighter italic">{filterAno || '--'}</span>
         </div>
         <div className="flex flex-col relative z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Mês selecionado</span>
            <span className="text-lg font-black tracking-tighter italic uppercase">{filterMes || '--'}</span>
         </div>
         <div className="flex flex-col relative z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Razão selecionada</span>
            <span className="text-lg font-black tracking-tighter italic truncate max-w-[200px]">{filterRazao || 'TODAS'}</span>
         </div>
         <div className="flex flex-col relative z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Matrícula selecionada</span>
            <span className="text-lg font-black tracking-tighter italic">{filterMatr || 'GERAL'}</span>
         </div>
      </div>

      {/* Configuração de Parâmetros (Pré-filtro) */}
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Filter size={20} /></div>
          <h2 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Configuração de Parâmetros</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Ano</label>
             <select value={filterAno} onChange={e => { setFilterAno(e.target.value); setFilterRazao(''); setFilterMatr(''); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4.5 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none">
               <option value="">Selecione...</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Mês</label>
             <select value={filterMes} onChange={e => { setFilterMes(e.target.value); setFilterRazao(''); setFilterMatr(''); }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4.5 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none">
               <option value="">Selecione...</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
               Selecione o Razão
               {loadingFilters && <Loader2 size={12} className="animate-spin text-blue-600" />}
             </label>
             <select disabled={!filterAno || !filterMes || loadingFilters} value={filterRazao} onChange={e => setFilterRazao(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4.5 px-6 text-sm font-bold disabled:opacity-30 focus:ring-4 focus:ring-blue-100 transition-all outline-none">
               <option value="">Todas Unidades ({options.razoes.length})</option>
               {options.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
               Selecione a Matrícula
               {loadingFilters && <Loader2 size={12} className="animate-spin text-blue-600" />}
             </label>
             <select disabled={!filterAno || !filterMes || loadingFilters} value={filterMatr} onChange={e => setFilterMatr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4.5 px-6 text-sm font-bold disabled:opacity-30 focus:ring-4 focus:ring-blue-100 transition-all outline-none">
               <option value="">Todas Matrículas ({options.matriculas.length})</option>
               {options.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
        </div>

        <div className="mt-14 flex flex-col sm:flex-row justify-center items-center gap-6">
           <button 
             onClick={handleProcessarDataset} 
             disabled={!filterAno || !filterMes || loading} 
             className="w-full sm:w-auto px-24 py-5.5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-4 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
           >
              {loading ? <Loader2 className="animate-spin" size={20}/> : <Play size={18} fill="currentColor"/>} 
              PROCESSAR DATASET
           </button>
           <button onClick={handleReset} className="w-full sm:w-auto px-12 py-5.5 bg-slate-100 text-slate-500 rounded-[24px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
              <RotateCcw size={16} /> REINICIAR
           </button>
        </div>
      </section>

      {reportReady && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
           {/* Indicadores Consolidados */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <IndicatorCard label="Dataset Analisado" value={dataset.length.toLocaleString()} icon={<Database size={24}/>} color="blue" />
              <IndicatorCard label="Ocorrências Localizadas" value={dataset.length.toLocaleString()} icon={<ShieldAlert size={24}/>} color="red" />
              <IndicatorCard label="Cobertura de Lote" value="100" suffix="%" icon={<CheckCircle2 size={24}/>} color="amber" />
           </div>

           {/* Listagem Analítica */}
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
                 <table id="print-analitico-table" className="w-full text-left text-[11px] border-collapse border border-black">
                    <thead className="bg-slate-50 text-slate-950 uppercase font-black tracking-widest">
                       <tr>
                         <th className="px-6 py-5 border border-black">MES</th>
                         <th className="px-6 py-5 border border-black">ANO</th>
                         <th className="px-6 py-5 border border-black">RAZÃO</th>
                         <th className="px-6 py-5 border border-black">UL</th>
                         <th className="px-6 py-5 border border-black">INSTALAÇÃO</th>
                         <th className="px-6 py-5 border border-black">MEDIDOR</th>
                         <th className="px-6 py-5 border border-black">REG</th>
                         <th className="px-6 py-5 border border-black">TIPO</th>
                         <th className="px-6 py-5 border border-black">MATR</th>
                         <th className="px-6 py-5 border border-black">COD</th>
                         <th className="px-6 py-5 border border-black">LEITURA</th>
                         <th className="px-6 py-5 border border-black bg-blue-50 text-blue-900">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-slate-900 font-medium bg-white">
                       {paginatedData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 border border-black uppercase whitespace-nowrap">{r.Mes || r.mes}</td>
                          <td className="px-6 py-4 border border-black">{r.Ano || r.ano}</td>
                          <td className="px-6 py-4 border border-black font-black whitespace-nowrap">{r.rz || r.RZ || r.razao}</td>
                          <td className="px-6 py-4 border border-black">{r.rz_ul_lv}</td>
                          <td className="px-6 py-4 border border-black font-mono text-blue-600 font-black">{r.instalacao}</td>
                          <td className="px-6 py-4 border border-black font-mono">{r.medidor}</td>
                          <td className="px-6 py-4 border border-black">{r.reg}</td>
                          <td className="px-6 py-4 border border-black whitespace-nowrap">{r.tipo}</td>
                          <td className="px-6 py-4 border border-black font-black">{r.matr || r.MATR}</td>
                          <td className="px-6 py-4 border border-black text-center font-black">
                             <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">{r.nl}</span>
                          </td>
                          <td className="px-6 py-4 border border-black font-black">{r.l_atual}</td>
                          <td className="px-6 py-4 border border-black font-bold italic text-slate-600 bg-slate-50/30">
                            {r[currentConfig.motivoKey] || 'NÃO INFORMADO'}
                          </td>
                        </tr>
                       ))}
                       {dataset.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">Nenhum dado detalhado carregado</td>
                        </tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              <div className="px-10 py-10 bg-slate-50 flex flex-wrap items-center justify-between border-t border-slate-200 no-print gap-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-5 py-2 rounded-full border border-slate-200">
                  Exibindo página {currentPage} de {totalPages}
                </span>
                <div className="flex gap-4">
                   <button 
                     onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                     disabled={currentPage === 1} 
                     className="px-6 py-3 bg-white border border-slate-200 rounded-[18px] shadow-sm hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2 font-black text-[10px] uppercase"
                   >
                     <ChevronLeft size={16} /> Anterior
                   </button>
                   <button 
                     onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                     disabled={currentPage >= totalPages} 
                     className="px-6 py-3 bg-white border border-slate-200 rounded-[18px] shadow-sm hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2 font-black text-[10px] uppercase"
                   >
                     Próximo <ChevronRight size={16} />
                   </button>
                </div>
              </div>
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Relação Quantitativa */}
              <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden h-full">
                 <div className="p-10 border-b border-slate-100 flex items-center gap-4">
                    <div className="p-2.5 bg-slate-900 text-white rounded-xl"><BarChart3 size={18} /></div>
                    <h3 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Relação Quantitativa</h3>
                 </div>
                 <div className="p-10">
                    <div className="overflow-y-auto max-h-[500px] border border-slate-100 rounded-3xl">
                       <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest sticky top-0 z-10">
                             <tr>
                                <th className="px-6 py-5 border-b border-slate-200">RAZÃO</th>
                                <th className="px-6 py-5 border-b border-slate-200 text-center">NÃO IMPRESSÃO</th>
                                <th className="px-6 py-5 border-b border-slate-200 text-center">QUANTIDADE</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {relacaoQuantitativa.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="px-6 py-4 font-black text-slate-900 whitespace-nowrap">{row.rz}</td>
                                   <td className="px-6 py-4 text-slate-500 font-medium italic">{row.motivo}</td>
                                   <td className="px-6 py-4 text-center">
                                      <span className="px-4 py-1.5 bg-blue-50 text-blue-700 font-black rounded-lg text-xs">
                                        {row.qtd.toLocaleString()}
                                      </span>
                                   </td>
                                </tr>
                             ))}
                             {relacaoQuantitativa.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-300 font-bold uppercase">Sem agrupamentos disponíveis</td>
                              </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </section>

              {/* Gráfico Comparativo Dinâmico */}
              <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 h-full flex flex-col">
                 <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20"><TrendingUp size={18} /></div>
                      <h3 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Top Ocorrências</h3>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                       <button onClick={() => setChartDimension('rz')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${chartDimension === 'rz' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Razão</button>
                       <button onClick={() => setChartDimension('matr')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${chartDimension === 'matr' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Técnico</button>
                       <button onClick={() => setChartDimension('motivo')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${chartDimension === 'motivo' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Motivo</button>
                    </div>
                 </div>
                 <div className="flex-1 min-h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 90 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} 
                          angle={-45} 
                          textAnchor="end" 
                          interval={0} 
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <Tooltip 
                          cursor={{fill: '#f8fafc', radius: 10}} 
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '20px' }} 
                        />
                        <Bar name="Volume Ocorrências" dataKey="value" barSize={32} radius={[8, 8, 0, 0]}>
                           {chartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === 0 ? '#1e40af' : '#3b82f6'} />
                           ))}
                           <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fontWeight: '900', fill: '#0f172a' }} offset={10} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] text-center">
                       Visualização: {chartDimension.toUpperCase()} | Filtros Ativos: {filterMes || '--'}/{filterAno || '--'}
                    </p>
                 </div>
              </section>
           </div>
        </div>
      )}

      {/* Overlay de Processamento */}
      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
           <div className="bg-white p-24 rounded-[60px] shadow-2xl flex flex-col items-center gap-10 text-center scale-110">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Activity size={40} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-3">
                 <h2 className="text-3xl font-black uppercase tracking-tighter italic text-slate-950">Análise de Dataset</h2>
                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Processamento Estratégico em Tempo Real</p>
              </div>
           </div>
        </div>
      )}

      {/* Estado Vazio / Instrução Inicial */}
      {!reportReady && !loading && (
        <div className="flex flex-col items-center justify-center py-48 bg-white rounded-[60px] border-2 border-dashed border-slate-200 text-center shadow-inner mt-4 animate-in zoom-in-95 duration-700">
           <div className="p-12 bg-slate-50 rounded-full mb-10 shadow-sm border border-slate-100"><Printer size={60} className="text-slate-200" /></div>
           <h3 className="text-slate-950 font-black text-3xl mb-4 uppercase italic tracking-tighter">Módulo de Auditoria de Lote</h3>
           <p className="text-slate-400 font-bold text-[12px] uppercase tracking-[0.5em] px-20 max-w-3xl leading-relaxed">
             Selecione obrigatoriamente o <span className="text-blue-600">ANO e MÊS</span> para habilitar os filtros inteligentes de pré-carga. O processamento detalhado só ocorrerá após o comando manual.
           </p>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
