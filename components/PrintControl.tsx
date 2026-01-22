
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  TABLE_NAME,
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  RPC_CE_CNA,
  RPC_FILTRO_RAZAO_CI,
  RPC_FILTRO_MATRICULA_CI,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, Loader2, Database, 
  TrendingUp, List, 
  ChevronLeft, ChevronRight,
  ShieldAlert, ScanLine, FileBarChart,
  Printer, AlertCircle, Layout
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LabelList
} from 'recharts';
import IndicatorCard from './IndicatorCard';

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
  
  // Estados de Filtros Locais e Isolados
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
    },
    [PrintSubMenu.APRESENTACAO]: {
      label: 'Apresentação (CNA)',
      icon: <FileBarChart size={16}/>,
      motivoKey: 'cna',
      rpc: RPC_CE_CNA
    }
  };

  const currentConfig = menuConfig[activeSubMenu];

  // 1. Carregamento de Metadados Iniciais (Apenas Ano e Mês)
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
        .filter((m: any) => !!MONTH_ORDER[m.value] || !!MONTH_ORDER[m.value.toUpperCase()])
        .sort((a: any, b: any) => {
          const m1 = MONTH_ORDER[a.value] || MONTH_ORDER[a.value.toUpperCase()] || 0;
          const m2 = MONTH_ORDER[b.value] || MONTH_ORDER[b.value.toUpperCase()] || 0;
          return m1 - m2;
        });

        setOptions(prev => ({ ...prev, anos, meses }));
      } catch (err) {
        console.error("SAL_ERROR: Erro metadados base:", err);
      }
    };
    fetchBaseMetadata();
  }, []);

  // 2. Carregamento de Filtros Dependentes (Razão e Técnico) baseados em Ano/Mês
  useEffect(() => {
    const fetchFiltrosDinamicos = async () => {
      // Limpa os filtros dependentes sempre que os primários mudam
      setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
      setFilterRazao('');
      setFilterMatr('');
      setDataset([]);
      setReportReady(false);

      if (!filterAno || !filterMes) return;
      
      setLoadingFilters(true);
      try {
        const p_ano = Number(filterAno);
        const p_mes = MONTH_ORDER[filterMes] || MONTH_ORDER[filterMes.toUpperCase()] || 0;

        const [resRz, resMatr] = await Promise.all([
          supabase.rpc(RPC_FILTRO_RAZAO_CI, { p_ano, p_mes }),
          supabase.rpc(RPC_FILTRO_MATRICULA_CI, { p_ano, p_mes })
        ]);

        if (resRz.error) throw resRz.error;
        if (resMatr.error) throw resMatr.error;

        const rzList = (resRz.data || []).map((r: any) => {
          const val = String(r.rz || r.RZ || r.razao || r.razao_social || r).trim();
          return { label: val, value: val };
        }).filter((x: any) => x.value && x.value !== 'null' && x.value !== '');

        const mtList = (resMatr.data || []).map((m: any) => {
          const val = String(m.matr || m.MATR || m.matricula || m.tecnico || m).trim();
          return { label: val, value: val };
        }).filter((x: any) => x.value && x.value !== 'null' && x.value !== '');

        setOptions(prev => ({
          ...prev,
          razoes: rzList,
          matriculas: mtList
        }));
      } catch (err) {
        console.error("SAL_ERROR: Filtros dinâmicos de impressão:", err);
      } finally {
        setLoadingFilters(false);
      }
    };
    fetchFiltrosDinamicos();
  }, [filterAno, filterMes]);

  const handleSubMenuChange = (id: PrintSubMenu) => {
    setActiveSubMenu(id);
    handleReset(); // Isola completamente o estado ao trocar de submenu
  };

  const handleProcessarImpressao = async () => {
    if (!filterAno || !filterMes) {
      alert("Selecione o Ano e o Mês de competência para continuar.");
      return;
    }

    setLoading(true);
    setReportReady(false); 
    
    try {
      const numAno = Number(filterAno);
      const numMes = MONTH_ORDER[filterMes] || MONTH_ORDER[filterMes.toUpperCase()] || 0;

      if (numMes === 0) {
        throw new Error("Mês inválido selecionado.");
      }

      const { data, error } = await supabase.rpc(currentConfig.rpc, {
        p_ano: numAno,
        p_mes: numMes,
        p_razao: filterRazao || null,
        p_tecnico: filterMatr || null
      });

      if (error) throw error;
      const rawData = Array.isArray(data) ? data : [];

      // Filtro de refinamento local para garantir exibição correta
      const filtered = rawData.filter((r: any) => {
        const rAno = Number(r.Ano || r.ano);
        const rMesRaw = r.Mes || r.mes;
        
        const matchAno = rAno === numAno;
        
        let matchMes = false;
        if (typeof rMesRaw === 'number') {
          matchMes = rMesRaw === numMes;
        } else {
          const rMesStr = String(rMesRaw).toUpperCase();
          matchMes = rMesStr === filterMes.toUpperCase();
        }
        
        if (!matchAno || !matchMes) return false;

        const rzVal = String(r.rz || r.RZ || r.razao || '').trim();
        const matchRz = filterRazao ? (rzVal === filterRazao) : true;

        const matrVal = String(r.matr || r.MATR || '').trim();
        const matchMatr = filterMatr ? (matrVal === filterMatr) : true;

        return matchRz && matchMatr;
      });

      setDataset(filtered);
      setReportReady(true);
      setCurrentPage(1);
    } catch (err: any) { 
      console.error("SAL_ERROR: Falha no processamento de impressão:", err);
      alert("Erro ao sincronizar com o banco de dados. Verifique a conexão.");
      setDataset([]);
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
    setOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return dataset.slice(start, start + ITEMS_PER_PAGE);
  }, [dataset, currentPage]);

  const totalPages = Math.max(1, Math.ceil(dataset.length / ITEMS_PER_PAGE));

  const stats = useMemo(() => {
    const total = dataset.length;
    let impressao = 0;
    let naoImpressao = 0;

    if (activeSubMenu === PrintSubMenu.APRESENTACAO) {
      dataset.forEach(r => {
        const val = String(r[currentConfig.motivoKey] || '').toUpperCase();
        if (val.includes('IMPRESSO') || val.includes('NORMAL')) impressao++;
        else naoImpressao++;
      });
    } else {
      naoImpressao = total;
    }

    return { total, impressao, naoImpressao };
  }, [dataset, activeSubMenu, currentConfig.motivoKey]);

  const groupedByRazao = useMemo(() => {
    const map: Record<string, number> = {};
    dataset.forEach(r => {
      const key = String(r.rz || r.RZ || r.razao || 'N/A').trim();
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, qtd]) => ({ label, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [dataset]);

  const isProcessDisabled = !filterAno || !filterMes || loading;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-40">
      <nav className="bg-white p-2 rounded-2xl flex flex-wrap gap-2 shadow-sm border border-slate-200 no-print">
        {(Object.keys(PrintSubMenu) as Array<keyof typeof PrintSubMenu>).map((key) => {
          const subId = PrintSubMenu[key];
          const config = menuConfig[subId];
          return (
            <button 
              key={subId} 
              onClick={() => handleSubMenuChange(subId)} 
              className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeSubMenu === subId 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </nav>

      <div className="px-2">
         <h2 className="text-2xl lg:text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none flex items-center flex-wrap gap-x-3">
            <span className="text-slate-400">Controle de Impressão</span>
            <span className="text-blue-600">·</span>
            <span>{currentConfig.label}</span>
         </h2>
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] mt-4 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-blue-500"></span>
            Módulo de Análise e Gestão de Ocorrências Operacionais
         </p>
      </div>

      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-slate-950 text-white rounded-xl shadow-lg shadow-black/10"><Filter size={20} /></div>
          <h2 className="text-sm font-black uppercase italic tracking-tight text-slate-800">Parâmetros de Execução</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano</label>
             <select 
               value={filterAno} 
               onChange={e => setFilterAno(e.target.value)} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-600 transition-all"
             >
               <option value="">Selecionar</option>
               {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</label>
             <select 
               value={filterMes} 
               onChange={e => setFilterMes(e.target.value)} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-600 transition-all"
             >
               <option value="">Selecionar</option>
               {options.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
               Razão Social
               {loadingFilters && <Loader2 size={12} className="animate-spin text-blue-600" />}
             </label>
             <select 
               disabled={!filterAno || !filterMes || loadingFilters} 
               value={filterRazao} 
               onChange={e => setFilterRazao(e.target.value)} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-600 transition-all disabled:opacity-40"
             >
               <option value="">Todas do Período ({options.razoes.length})</option>
               {options.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
               Técnico
               {loadingFilters && <Loader2 size={12} className="animate-spin text-blue-600" />}
             </label>
             <select 
               disabled={!filterAno || !filterMes || loadingFilters} 
               value={filterMatr} 
               onChange={e => setFilterMatr(e.target.value)} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-600 transition-all disabled:opacity-40"
             >
               <option value="">Todas do Período ({options.matriculas.length})</option>
               {options.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button 
             onClick={handleProcessarImpressao} 
             disabled={isProcessDisabled} 
             className="px-20 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30 flex items-center gap-3 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
           >
              {loading ? <Loader2 className="animate-spin" size={18}/> : <Play size={16} fill="currentColor"/>} 
              Executar Análise
           </button>
           <button onClick={handleReset} className="px-12 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors">
              <RotateCcw size={14} /> Limpar
           </button>
        </div>
      </section>

      {reportReady && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <IndicatorCard label="Dataset Analisado" value={stats.total.toLocaleString()} icon={<Database size={24}/>} color="blue" />
              <IndicatorCard label="Não Impressão" value={stats.naoImpressao.toLocaleString()} icon={<ShieldAlert size={24}/>} color="red" />
              {activeSubMenu === PrintSubMenu.APRESENTACAO ? (
                <IndicatorCard label="Eficiência Impressão" value={stats.impressao.toLocaleString()} icon={<FileBarChart size={24}/>} color="green" />
              ) : (
                <IndicatorCard label="Ponto de Atenção" value={((stats.naoImpressao / (stats.total || 1)) * 100).toFixed(2)} suffix="%" icon={<AlertCircle size={24}/>} color="amber" />
              )}
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
                <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900 mb-10 flex items-center gap-3">
                  <TrendingUp className="text-blue-600" size={22}/>
                  Top 10 Razão Social por Ocorrências
                </h3>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupedByRazao} layout="vertical" margin={{ left: 40, right: 40 }}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                       <XAxis type="number" hide />
                       <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{fill: '#0f172a', fontSize: 10, fontWeight: '900'}} width={150} />
                       <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                       <Bar dataKey="qtd" barSize={25} radius={[0, 10, 10, 0]} fill="#2563eb">
                          <LabelList dataKey="qtd" position="right" style={{ fontSize: '10px', fontWeight: '900', fill: '#0f172a' }} />
                       </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl flex flex-col">
                 <h3 className="text-base font-black uppercase italic tracking-widest mb-8 flex items-center gap-3">
                   <List size={22} className="text-blue-500" />
                   Ranking Razão
                 </h3>
                 <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {groupedByRazao.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Nível {i+1}</span>
                            <span className="text-xs font-bold truncate max-w-[150px]">{item.label}</span>
                         </div>
                         <div className="text-right">
                            <p className="text-lg font-black text-white">{item.qtd}</p>
                            <span className="text-[9px] text-slate-500 uppercase font-black">Registros</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <Layout size={20} className="text-blue-600" />
                  <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900">Listagem de Registros de Impressão</h3>
                </div>
                <div className="text-[10px] font-black bg-slate-900 text-white px-5 py-2 rounded-full uppercase tracking-widest">
                  Total: {dataset.length.toLocaleString()}
                </div>
              </div>
              
              <div className="overflow-x-auto p-10">
                 <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest">
                       <tr>
                         <th className="px-5 py-5 border border-slate-200">Mês</th>
                         <th className="px-5 py-5 border border-slate-200">Ano</th>
                         <th className="px-5 py-5 border border-slate-200">Razão Social</th>
                         <th className="px-5 py-5 border border-slate-200">Instalação</th>
                         <th className="px-5 py-5 border border-slate-200">Matrícula</th>
                         <th className="px-5 py-5 border border-slate-200 text-center">Cod</th>
                         <th className="px-5 py-5 border border-slate-200 bg-blue-50/50 text-blue-800">Motivo (Análise)</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {paginatedData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4 border border-slate-100 uppercase">{r.Mes || r.mes}</td>
                          <td className="px-5 py-4 border border-slate-100">{r.Ano || r.ano}</td>
                          <td className="px-5 py-4 border border-slate-100 font-bold">{r.rz || r.RZ || r.razao}</td>
                          <td className="px-5 py-4 border border-slate-100 font-mono text-blue-600">{r.instalacao}</td>
                          <td className="px-5 py-4 border border-slate-100 font-bold">{r.matr || r.MATR}</td>
                          <td className="px-5 py-4 border border-slate-100 text-center font-black">{r.nl}</td>
                          <td className="px-5 py-4 border border-slate-100 font-medium italic text-slate-500 bg-slate-50/20">
                            {r[currentConfig.motivoKey] || 'Inconsistência não detalhada'}
                          </td>
                        </tr>
                       ))}
                       {dataset.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-20 text-center text-slate-400 font-bold uppercase">Nenhum registro localizado para os parâmetros informados</td>
                        </tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              <div className="px-10 py-8 bg-slate-50 flex items-center justify-between border-t border-slate-200 no-print">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-3">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-100 transition-all disabled:opacity-30"><ChevronLeft size={18} /></button>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-100 transition-all disabled:opacity-30"><ChevronRight size={18} /></button>
                </div>
              </div>
           </section>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
           <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-8">
              <div className="relative h-24 w-24">
                 <div className="absolute inset-0 rounded-full border-[8px] border-slate-100 border-t-blue-600 animate-spin"></div>
                 <Database size={30} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="text-center">
                 <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter italic">Processando Dataset</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Sincronizando com o Núcleo SAL...</p>
              </div>
           </div>
        </div>
      )}

      {!reportReady && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[60px] border-2 border-dashed border-slate-200 text-center shadow-sm mt-4">
           <div className="p-10 bg-slate-50 rounded-full mb-8"><Printer size={50} className="text-slate-200" /></div>
           <h3 className="text-slate-950 font-black text-2xl mb-3 uppercase italic tracking-tighter">Módulo de Impressão Pronto</h3>
           <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] px-20 max-w-2xl leading-relaxed">
             Aguardando seleção dos parâmetros de competência para <span className="text-blue-600">PROCESSAMENTO ESTATÍSTICO</span>.
           </p>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
