
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  TABLE_NAME,
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  RPC_CE_CNA,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, Loader2, Database, 
  TrendingUp, Layout, ListFilter, 
  ChevronLeft, ChevronRight,
  ShieldAlert, ScanLine, FileBarChart,
  Printer, List
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';

const ITEMS_PER_PAGE = 25;

enum PrintSubMenu {
  NOSB_IMPEDIMENTO = 'NOSB_IMPEDIMENTO',
  NOSB_SIMULACAO = 'NOSB_SIMULACAO',
  APRESENTACAO = 'APRESENTACAO'
}

interface OptionItem {
  label: string;
  value: string;
}

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  const [options, setOptions] = useState({
    anos: [] as string[],
    meses: [] as OptionItem[],
    razoes: [] as OptionItem[],
    matriculas: [] as OptionItem[]
  });

  const [dataset, setDataset] = useState<any[]>([]);
  const [reportReady, setReportReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartDimension, setChartDimension] = useState<'mes' | 'matr' | 'razao'>('razao');

  const menuConfig = {
    [PrintSubMenu.NOSB_IMPEDIMENTO]: {
      label: 'Impedimentos (NOSB)',
      icon: <ShieldAlert size={14}/>,
      motivoKey: 'nosb_impedimento',
      rpc: RPC_CE_IMPEDIMENTOS
    },
    [PrintSubMenu.NOSB_SIMULACAO]: {
      label: 'Simulação (NOSB)',
      icon: <ScanLine size={14}/>,
      motivoKey: 'nosb_simulacao',
      rpc: RPC_CE_SIMULACAO_NOSB
    },
    [PrintSubMenu.APRESENTACAO]: {
      label: 'Apresentação (CNA)',
      icon: <FileBarChart size={14}/>,
      motivoKey: 'cna',
      rpc: RPC_CE_CNA
    }
  };

  const currentConfig = menuConfig[activeSubMenu];

  useEffect(() => {
    const fetchBaseMetadata = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        
        const anos = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));
        const meses = (resMeses.data || []).map((m: any) => {
          const mVal = String(m.mes || m);
          return { label: mVal.toUpperCase(), value: mVal };
        })
        .filter((m: any) => !!MONTH_ORDER[m.value])
        .sort((a: any, b: any) => (MONTH_ORDER[a.value] || 0) - (MONTH_ORDER[b.value] || 0));

        setOptions(prev => ({ ...prev, anos, meses }));
      } catch (err) {
        console.error("Erro fetch metadata:", err);
      }
    };
    fetchBaseMetadata();
  }, []);

  useEffect(() => {
    setFilterRazao('');
    setFilterMatr('');
    setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));

    const fetchFiltrosDinamicos = async () => {
      if (!filterAno || !filterMes) return;

      setLoadingFilters(true);
      try {
        // Busca Razão Social e Matrícula diretamente da FONTE BASE (TABLE_NAME)
        // filtrado por Ano e Mês para garantir precisão e evitar erro de RPC
        const { data: baseData, error } = await supabase
          .from(TABLE_NAME)
          .select('rz, matr')
          .eq('Ano', Number(filterAno))
          .eq('Mes', filterMes)
          .limit(10000);

        if (error) throw error;

        if (baseData) {
          // Extrai RZ únicas
          const rzSet = new Set<string>();
          const mtSet = new Set<string>();
          
          baseData.forEach(item => {
            if (item.rz) rzSet.add(String(item.rz));
            if (item.matr) mtSet.add(String(item.matr));
          });

          const rzOptions = Array.from(rzSet)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))
            .map(r => ({ label: r, value: r }));

          const mtOptions = Array.from(mtSet)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))
            .map(m => ({ label: m, value: m }));

          setOptions(prev => ({ ...prev, razoes: rzOptions, matriculas: mtOptions }));
        }
      } catch (err) {
        console.error("Erro ao carregar filtros dinâmicos da base:", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFiltrosDinamicos();
  }, [filterAno, filterMes]);

  const handleSubMenuChange = (id: PrintSubMenu) => {
    setActiveSubMenu(id);
    setDataset([]);
    setReportReady(false);
    setCurrentPage(1);
  };

  const handleProcessarRelatorio = async () => {
    if (!filterAno || !filterMes) {
      alert("Atenção: A seleção de Ano e Mês é obrigatória para processar o relatório.");
      return;
    }

    setLoading(true);
    try {
      // Chamada da RPC sem parâmetros conforme especificação
      const { data, error } = await supabase.rpc(currentConfig.rpc);
      
      if (error) throw error;
      
      const rawData = Array.isArray(data) ? data : [];

      // FILTRAGEM LOCAL OBRIGATÓRIA (Processamento em Engine SAL)
      let filteredResults = rawData.filter((r: any) => {
        const matchAno = String(r.Ano || r.ano) === filterAno;
        const matchMes = String(r.Mes || r.mes || '').toUpperCase() === filterMes.toUpperCase();
        
        let matchRz = true;
        if (filterRazao && filterRazao !== "" && filterRazao !== "null") {
           matchRz = String(r.rz || r.RZ || r.razao || '') === filterRazao;
        }

        let matchMatr = true;
        if (filterMatr && filterMatr !== "" && filterMatr !== "null") {
           matchMatr = String(r.matr || r.MATR || '') === filterMatr;
        }

        return matchAno && matchMes && matchRz && matchMatr;
      });

      if (filteredResults.length === 0) {
        alert("Atenção: Não foram localizados registros para a combinação de filtros selecionada.");
        setDataset([]);
        setReportReady(false);
      } else {
        setDataset(filteredResults);
        setReportReady(true);
        setCurrentPage(1);
      }
    } catch (err) { 
      console.error("Erro no processamento estratégico:", err);
      alert("Erro ao sincronizar dados. Tente novamente.");
      setDataset([]);
      setReportReady(false);
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

  const paginatedData = useMemo(() => {
    if (!dataset || dataset.length === 0) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return dataset.slice(start, start + ITEMS_PER_PAGE);
  }, [dataset, currentPage]);

  const totalPages = Math.max(1, Math.ceil(dataset.length / ITEMS_PER_PAGE));

  const relacaoQuantitativa = useMemo(() => {
    if (!reportReady || dataset.length === 0) return [];
    const grouped: Record<string, { razao: string, nao_impressao: number, impressao: number, total: number }> = {};
    const key = currentConfig.motivoKey;

    dataset.forEach(item => {
      const rz = String(item.rz || item.RZ || item.razao || 'N/A');
      const val = String(item[key] || '').toUpperCase();
      
      if (!grouped[rz]) grouped[rz] = { razao: rz, nao_impressao: 0, impressao: 0, total: 0 };
      
      if (activeSubMenu === PrintSubMenu.APRESENTACAO) {
         if (val.includes('IMPRESSO') || val.includes('NORMAL')) grouped[rz].impressao++;
         else grouped[rz].nao_impressao++;
      } else {
         grouped[rz].nao_impressao++;
      }
      grouped[rz].total++;
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [dataset, reportReady, activeSubMenu, currentConfig]);

  const chartData = useMemo(() => {
    if (!reportReady || dataset.length === 0) return [];
    const grouped: Record<string, any> = {};
    dataset.forEach(item => {
      let k = '';
      if (chartDimension === 'mes') k = String(item.Mes || item.mes || '').toUpperCase();
      else if (chartDimension === 'matr') k = String(item.matr || item.MATR || 'N/A');
      else k = String(item.rz || item.RZ || 'N/A');

      if (!grouped[k]) grouped[k] = { label: k, qtd: 0 };
      grouped[k].qtd++;
    });
    return Object.values(grouped).sort((a, b) => b.qtd - a.qtd).slice(0, 15);
  }, [dataset, reportReady, chartDimension]);

  const isPeriodDefined = filterAno !== '' && filterMes !== '';

  return (
    <div className="space-y-6 -mt-10 pb-40">
      <nav className="bg-white/95 backdrop-blur-md p-2 rounded-2xl flex flex-wrap gap-1 shadow-sm border border-slate-200/60 no-print mx-4">
        {(Object.keys(PrintSubMenu) as Array<keyof typeof PrintSubMenu>).map((key) => {
          const subId = PrintSubMenu[key];
          const config = menuConfig[subId];
          return (
            <button 
              key={subId} 
              onClick={() => handleSubMenuChange(subId)} 
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeSubMenu === subId 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
         <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
            <Printer className="text-blue-600" size={28} />
            {currentConfig.label}
         </h2>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">
           Controle de Impressão — Módulo de Auditoria de Leitura
         </p>
         <div className="h-1 w-20 bg-blue-600/30 mt-4 rounded-full"></div>
      </div>

      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 mt-4 no-print mx-4">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-slate-900 text-white rounded-xl"><Filter size={20} /></div>
          <h2 className="text-base font-black uppercase italic tracking-tight text-slate-800">Filtros Operacionais:</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <div className="space-y-3">
             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ano de Competência</label>
             <select 
               value={filterAno} 
               onChange={e => setFilterAno(e.target.value)} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:border-blue-500 transition-all"
             >
               <option value="">Selecione</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mês de Competência</label>
             <select 
               value={filterMes} 
               onChange={e => setFilterMes(e.target.value)} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:border-blue-500 transition-all"
             >
               <option value="">Selecione</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3 relative">
             <label className={`text-[11px] font-black uppercase tracking-widest ${isPeriodDefined ? 'text-slate-400' : 'text-slate-300'}`}>
                Razão Social {isPeriodDefined ? '' : '(Aguardando Período)'}
             </label>
             <select 
               disabled={!isPeriodDefined || loadingFilters}
               value={filterRazao} 
               onChange={e => setFilterRazao(e.target.value)} 
               className={`w-full border rounded-2xl py-4 px-5 text-sm font-bold outline-none transition-all ${isPeriodDefined ? 'bg-white border-slate-200 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
             >
               <option value="">{loadingFilters ? 'Sincronizando...' : 'Todas'}</option>
               {options.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
             </select>
             {loadingFilters && <div className="absolute right-10 bottom-4"><Loader2 className="animate-spin text-blue-600" size={16} /></div>}
           </div>
           
           <div className="space-y-3 relative">
             <label className={`text-[11px] font-black uppercase tracking-widest ${isPeriodDefined ? 'text-slate-400' : 'text-slate-300'}`}>
                Técnico (Matrícula) {isPeriodDefined ? '' : '(Aguardando Período)'}
             </label>
             <select 
               disabled={!isPeriodDefined || loadingFilters}
               value={filterMatr} 
               onChange={e => setFilterMatr(e.target.value)} 
               className={`w-full border rounded-2xl py-4 px-5 text-sm font-bold outline-none transition-all ${isPeriodDefined ? 'bg-white border-slate-200 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
             >
               <option value="">{loadingFilters ? 'Sincronizando...' : 'Todas'}</option>
               {options.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
             {loadingFilters && <div className="absolute right-10 bottom-4"><Loader2 className="animate-spin text-blue-600" size={16} /></div>}
           </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button 
             type="button"
             onClick={handleProcessarRelatorio} 
             disabled={loading || !isPeriodDefined} 
             className="px-16 py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
           >
              {loading ? <Loader2 className="animate-spin" size={18}/> : <Play size={16} fill="currentColor"/>} 
              PROCESSAR RELATÓRIO
           </button>
           <button onClick={handleReset} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors">
              <RotateCcw size={14} /> LIMPAR
           </button>
        </div>
      </section>

      {reportReady && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 mx-4 mt-8">
           <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  <h3 className="text-base font-black uppercase italic tracking-tight">Dataset Analítico</h3>
                </div>
                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-4 py-2 rounded-full uppercase tracking-widest">
                  {dataset.length} registros localizados
                </span>
              </div>
              
              <div className="overflow-x-auto p-4 sm:p-10">
                 <table className="w-full text-left text-[10px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-wider border border-slate-200">
                       <tr>
                         <th className="px-4 py-4 border border-slate-200">MÊS</th>
                         <th className="px-4 py-4 border border-slate-200">ANO</th>
                         <th className="px-4 py-4 border border-slate-200">RAZÃO</th>
                         <th className="px-4 py-4 border border-slate-200">UL</th>
                         <th className="px-4 py-4 border border-slate-200">INSTALAÇÃO</th>
                         <th className="px-4 py-4 border border-slate-200">MEDIDOR</th>
                         <th className="px-4 py-4 border border-slate-200">REG</th>
                         <th className="px-4 py-4 border border-slate-200">TIPO</th>
                         <th className="px-4 py-4 border border-slate-200">MATR</th>
                         <th className="px-4 py-4 border border-slate-200">COD</th>
                         <th className="px-4 py-4 border border-slate-200">LEITURA</th>
                         <th className="px-4 py-4 border border-slate-200 bg-blue-50 text-blue-700 font-black">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {dataset.length > 0 ? (
                         paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 border border-slate-100 uppercase">{r.Mes || r.mes}</td>
                            <td className="px-4 py-3 border border-slate-100">{r.Ano || r.ano}</td>
                            <td className="px-4 py-3 border border-slate-100 font-bold">{r.rz || r.RZ || r.razao}</td>
                            <td className="px-4 py-3 border border-slate-100 font-mono">{r.rz_ul_lv || r.ul}</td>
                            <td className="px-4 py-3 border border-slate-100 font-bold">{r.instalacao}</td>
                            <td className="px-4 py-3 border border-slate-100 font-mono">{r.medidor}</td>
                            <td className="px-4 py-3 border border-slate-100">{r.reg}</td>
                            <td className="px-4 py-3 border border-slate-100 uppercase">{r.tipo || r.tipo_leitura}</td>
                            <td className="px-4 py-3 border border-slate-100 font-mono">{r.matr || r.MATR}</td>
                            <td className="px-4 py-3 border border-slate-100 font-black">{r.nl}</td>
                            <td className="px-4 py-3 border border-slate-100 font-black">{r.l_atual}</td>
                            <td className="px-4 py-3 border border-slate-100 font-medium italic text-slate-500">
                              {r[currentConfig.motivoKey] || 'N/A'}
                            </td>
                          </tr>
                         ))
                       ) : (
                        <tr><td colSpan={12} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic">Sem dados para os filtros selecionados</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              <div className="px-10 py-6 bg-slate-50 flex items-center justify-between border-t border-slate-200 no-print">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                  <span className="text-[9px] text-slate-400 font-medium uppercase mt-1 tracking-tighter italic">Processamento finalizado via Engine SAL</span>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              </div>
           </section>

           <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 bg-slate-900 text-white flex items-center gap-3">
                <List size={20} />
                <h3 className="text-base font-black uppercase italic tracking-widest">Relação Quantitativa Agrupada</h3>
              </div>
              <div className="p-10">
                 <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest border border-slate-200">
                       <tr>
                         <th className="px-6 py-4 border border-slate-200">IDENTIFICAÇÃO</th>
                         <th className="px-6 py-4 border border-slate-200 text-center">VOLUME (OCORRÊNCIAS)</th>
                         {activeSubMenu === PrintSubMenu.APRESENTACAO && <th className="px-6 py-4 border border-slate-200 text-center">IMPRESSÃO REALIZADA</th>}
                         <th className="px-6 py-4 border border-slate-200 text-center font-black">TOTALIZADOR</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {relacaoQuantitativa.map((rq, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                             <td className="px-6 py-4 border border-slate-100 font-black text-slate-900">{rq.razao}</td>
                             <td className="px-6 py-4 border border-slate-100 text-center font-bold text-red-600">{rq.nao_impressao.toLocaleString()}</td>
                             {activeSubMenu === PrintSubMenu.APRESENTACAO && <td className="px-6 py-4 border border-slate-100 text-center font-bold text-green-600">{rq.impressao.toLocaleString()}</td>}
                             <td className="px-6 py-4 border border-slate-100 text-center font-black bg-slate-50/50">{rq.total.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </section>

           <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 no-print">
              <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
                <h3 className="text-base font-black uppercase italic tracking-tight flex items-center gap-3">
                  <TrendingUp size={22} className="text-blue-600" /> Histórico Analítico de Volume
                </h3>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                   {[{id:'razao',l:'Razão'},{id:'matr',l:'Matrícula'},{id:'mes',l:'Mês'}].map(d => (
                     <button key={d.id} onClick={() => setChartDimension(d.id as any)} className={`px-5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${chartDimension === d.id ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>{d.l}</button>
                   ))}
                </div>
              </div>
              <div className="h-[450px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} angle={-45} textAnchor="end" interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip cursor={{fill: '#f8fafc', radius: 10}} />
                      <Bar dataKey="qtd" name="Ocorrências" barSize={35} radius={[6, 6, 0, 0]}>
                         {chartData.map((_, index) => <Cell key={index} fill={index % 2 === 0 ? '#1e293b' : '#334155'} />)}
                      </Bar>
                   </BarChart>
                 </ResponsiveContainer>
              </div>
           </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
           <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-10 text-center animate-in zoom-in-95 duration-500">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-100 border-t-blue-600 animate-spin"></div>
                <Database size={30} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Processando Dataset em Tempo Real</h2>
          </div>
        </div>
      )}

      {!reportReady && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[40px] border-2 border-dashed border-slate-100 text-center mx-4 shadow-sm mt-4">
           <div className="p-8 bg-slate-50 rounded-full mb-6"><Printer size={40} className="text-slate-200" /></div>
           <h3 className="text-slate-950 font-black text-xl mb-2 uppercase italic">Aguardando Parâmetros de Filtro</h3>
           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] px-20">Configure a competência e execute o <span className="text-slate-900">PROCESSAMENTO</span>.</p>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
