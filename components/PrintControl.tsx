
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_FILTRO_MES,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, RotateCcw, Database, 
  ChevronLeft, ChevronRight,
  ShieldAlert, ScanLine, 
  FileSpreadsheet,
  CheckCircle2, Activity, Play, Search
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 25;

enum PrintSubMenu {
  NOSB_IMPEDIMENTO = 'NOSB_IMPEDIMENTO',
  NOSB_SIMULACAO = 'NOSB_SIMULACAO'
}

interface SubMenuState {
  filterAno: string;
  filterMes: string;
  searchRz: string;
  searchMatr: string;
  searchMotivo: string;
  datasetRaw: any[];
  displayResults: boolean;
  currentPage: number;
}

const initialSubState: SubMenuState = {
  filterAno: '',
  filterMes: '',
  searchRz: '',
  searchMatr: '',
  searchMotivo: '',
  datasetRaw: [],
  displayResults: false,
  currentPage: 1
};

const PrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<PrintSubMenu>(PrintSubMenu.NOSB_IMPEDIMENTO);
  const [loading, setLoading] = useState(false);
  const [dateOptions, setDateOptions] = useState({
    anos: [] as string[],
    meses: [] as { label: string; value: string }[]
  });

  // Estados Isolados por SubMenu (Isolamento Total)
  const [states, setStates] = useState<Record<PrintSubMenu, SubMenuState>>({
    [PrintSubMenu.NOSB_IMPEDIMENTO]: { ...initialSubState },
    [PrintSubMenu.NOSB_SIMULACAO]: { ...initialSubState }
  });

  const currentSubState = states[activeSubMenu];

  const menuConfig = {
    [PrintSubMenu.NOSB_IMPEDIMENTO]: {
      label: 'Impedimentos (NOSB)',
      icon: <ShieldAlert size={16}/>,
      rpc: RPC_CE_IMPEDIMENTOS,
      motivoKey: 'nosb_impedimento'
    },
    [PrintSubMenu.NOSB_SIMULACAO]: {
      label: 'Simulação (NOSB)',
      icon: <ScanLine size={16}/>,
      rpc: RPC_CE_SIMULACAO_NOSB,
      motivoKey: 'nosb_simulacao'
    }
  };

  const currentConfig = menuConfig[activeSubMenu];

  // Carregar Metadados (Ano/Mês) iniciais para os filtros visuais
  useEffect(() => {
    const fetchBaseFilters = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        
        const anosList = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a: any, b: any) => Number(b) - Number(a));
        const mesesList = (resMeses.data || [])
          .map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map((m: string) => ({ label: m, value: m }));

        setDateOptions({ anos: anosList, meses: mesesList });
      } catch (err) {
        console.error("Erro ao carregar filtros base:", err);
      }
    };
    fetchBaseFilters();
  }, []);

  const updateCurrentState = (updates: Partial<SubMenuState>) => {
    setStates(prev => ({
      ...prev,
      [activeSubMenu]: { ...prev[activeSubMenu], ...updates }
    }));
  };

  const handleGerarRelatorio = async () => {
    if (!currentSubState.filterAno || !currentSubState.filterMes) return;
    
    setLoading(true);
    try {
      // REGRA: Executar a RPC correspondente SEM enviar parâmetros
      const { data, error } = await supabase.rpc(currentConfig.rpc);
      
      if (error) throw error;
      
      updateCurrentState({
        datasetRaw: Array.isArray(data) ? data : [],
        displayResults: true,
        currentPage: 1
      });
    } catch (err) {
      console.error(`Erro ao executar ${currentConfig.rpc}:`, err);
      alert("Falha na sincronização com o banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    updateCurrentState({ ...initialSubState });
  };

  // Filtragem LOCAL (Frontend) por Ano e Mês (Lote de Competência)
  const filteredData = useMemo(() => {
    if (!currentSubState.datasetRaw) return [];
    
    const targetAno = Number(currentSubState.filterAno);
    const targetMesStr = currentSubState.filterMes.toUpperCase();
    const targetMesNum = MONTH_ORDER[targetMesStr];

    return currentSubState.datasetRaw.filter(item => {
      // 1. Filtragem por Lote (Obrigatória no Frontend)
      const itemAno = Number(item.ano || item.Ano);
      const itemMes = item.mes || item.Mes;
      const itemMesStr = String(itemMes).toUpperCase();
      const itemMesNum = Number(itemMes) || MONTH_ORDER[itemMesStr];

      const matchAno = itemAno === targetAno;
      const matchMes = itemMesNum === targetMesNum || itemMesStr === targetMesStr;
      
      if (!matchAno || !matchMes) return false;

      // 2. Garantia de Contexto (Motivo deve existir para a aba ativa)
      const motivoVal = String(item[currentConfig.motivoKey] || '');
      if (!motivoVal || motivoVal === 'null' || motivoVal.trim() === '') return false;

      // 3. Filtros de Busca Interna (Frontend)
      const itemRz = String(item.rz || item.RZ || '').toLowerCase();
      const itemMatr = String(item.matr || item.MATR || '').toLowerCase();
      const itemMotivo = motivoVal.toLowerCase();
      
      const matchSearchRz = currentSubState.searchRz ? itemRz.includes(currentSubState.searchRz.toLowerCase()) : true;
      const matchSearchMatr = currentSubState.searchMatr ? itemMatr.includes(currentSubState.searchMatr.toLowerCase()) : true;
      const matchSearchMotivo = currentSubState.searchMotivo ? itemMotivo.includes(currentSubState.searchMotivo.toLowerCase()) : true;
      
      return matchSearchRz && matchSearchMatr && matchSearchMotivo;
    });
  }, [currentSubState, activeSubMenu, currentConfig.motivoKey]);

  const paginatedData = useMemo(() => {
    const start = (currentSubState.currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentSubState.currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Controle_Impressao");
    XLSX.writeFile(wb, `SAL_NOSB_${activeSubMenu}_${currentSubState.filterMes}_${currentSubState.filterAno}.xlsx`);
  };

  return (
    <div className="space-y-10 pb-40 animate-in fade-in duration-500">
      {/* Navegação de Submenus Isolados */}
      <nav className="bg-white p-2 rounded-[24px] flex gap-2 shadow-sm border border-slate-200">
        {Object.entries(menuConfig).map(([key, config]) => {
          const isActive = activeSubMenu === key;
          return (
            <button 
              key={key} 
              onClick={() => setActiveSubMenu(key as PrintSubMenu)} 
              className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </nav>

      {/* Parâmetros Visuais de Lote (Filtragem Frontend) */}
      <section className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-10">
           <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Filter size={18} /></div>
           <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest italic">Parâmetros de Competência</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione o Ano</label>
             <select 
               value={currentSubState.filterAno} 
               onChange={e => updateCurrentState({ filterAno: e.target.value })} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all"
             >
               <option value="">Selecione...</option>
               {dateOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           
           <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione o Mês</label>
             <select 
               value={currentSubState.filterMes} 
               onChange={e => updateCurrentState({ filterMes: e.target.value })} 
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all"
             >
               <option value="">Selecione...</option>
               {dateOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
        </div>

        <div className="mt-12 flex justify-center gap-6">
           <button 
             onClick={handleGerarRelatorio} 
             disabled={!currentSubState.filterAno || !currentSubState.filterMes || loading} 
             className="px-20 py-6 bg-slate-950 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.25em] shadow-2xl hover:bg-slate-800 hover:scale-[1.02] transition-all disabled:opacity-30 flex items-center gap-4"
           >
              {loading ? <Activity className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />} 
              GERAR RELATÓRIO
           </button>
           <button onClick={handleReset} className="px-12 py-6 bg-slate-100 text-slate-500 rounded-[24px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all">
              <RotateCcw size={16} /> REINICIAR
           </button>
        </div>
      </section>

      {currentSubState.displayResults && (
        <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-700">
           {/* Cards de Resumo do Lote */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-[28px] border-l-[6px] border-blue-600 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Dataset Lote</p>
                <div className="flex items-center gap-4">
                  <h3 className="text-4xl font-black text-slate-900">{filteredData.length.toLocaleString()}</h3>
                  <Database size={24} className="text-slate-100"/>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[28px] border-l-[6px] border-red-600 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ocorrências Atuais</p>
                <div className="flex items-center gap-4">
                  <h3 className="text-4xl font-black text-red-700">{filteredData.length.toLocaleString()}</h3>
                  <ShieldAlert size={24} className="text-red-50"/>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[28px] border-l-[6px] border-green-500 shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Status Processamento</p>
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black text-green-700 uppercase italic">Concluído</h3>
                  <CheckCircle2 size={24} className="text-green-100"/>
                </div>
              </div>
           </div>

           {/* Listagem Analítica do Mês/Ano Selecionado */}
           <section className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <Database size={20} className="text-blue-600" />
                  <h3 className="text-base font-black uppercase tracking-tighter italic text-slate-900">Listagem Analítica do Lote</h3>
                </div>
                <button onClick={exportExcel} className="flex items-center gap-3 px-8 py-4 bg-green-50 text-green-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-green-100 transition-all border border-green-200">
                  <FileSpreadsheet size={18}/> EXCEL
                </button>
              </div>

              {/* Filtros Internos (Frontend Only) */}
              <div className="p-8 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrar Razão Social..." 
                      value={currentSubState.searchRz}
                      onChange={(e) => updateCurrentState({ searchRz: e.target.value, currentPage: 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500"
                    />
                 </div>
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrar Matrícula..." 
                      value={currentSubState.searchMatr}
                      onChange={(e) => updateCurrentState({ searchMatr: e.target.value, currentPage: 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500"
                    />
                 </div>
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrar Motivo..." 
                      value={currentSubState.searchMotivo}
                      onChange={(e) => updateCurrentState({ searchMotivo: e.target.value, currentPage: 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-blue-500"
                    />
                 </div>
              </div>
              
              <div className="overflow-x-auto p-10">
                 <table className="w-full text-left text-[10.5px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest">
                       <tr>
                         <th className="px-5 py-5 border border-slate-200">MES</th>
                         <th className="px-5 py-5 border border-slate-200">ANO</th>
                         <th className="px-5 py-5 border border-slate-200">RAZÃO</th>
                         <th className="px-5 py-5 border border-slate-200">UL</th>
                         <th className="px-5 py-5 border border-slate-200">INSTAL</th>
                         <th className="px-5 py-5 border border-slate-200">MEDIDOR</th>
                         <th className="px-5 py-5 border border-slate-200">REG</th>
                         <th className="px-5 py-5 border border-slate-200">TIPO</th>
                         <th className="px-5 py-5 border border-slate-200">MATR</th>
                         <th className="px-5 py-5 border border-slate-200">CÓD</th>
                         <th className="px-5 py-5 border border-slate-200">LEITURA</th>
                         <th className="px-5 py-5 border border-slate-200 text-blue-700">MOTIVO</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {paginatedData.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-5 py-4 border border-slate-100 font-bold uppercase">{r.mes || r.Mes}</td>
                          <td className="px-5 py-4 border border-slate-100">{r.ano || r.Ano}</td>
                          <td className="px-5 py-4 border border-slate-100 font-black uppercase truncate max-w-[150px]">{r.rz || r.RZ}</td>
                          <td className="px-5 py-4 border border-slate-100 text-slate-400 whitespace-nowrap">{r.rz_ul_lv}</td>
                          <td className="px-5 py-4 border border-slate-100 font-mono font-black text-blue-600">{r.instalacao}</td>
                          <td className="px-5 py-4 border border-slate-100 font-mono whitespace-nowrap">{r.medidor}</td>
                          <td className="px-5 py-4 border border-slate-100">{r.reg}</td>
                          <td className="px-5 py-4 border border-slate-100 uppercase text-[9px] font-bold">{r.tipo}</td>
                          <td className="px-5 py-4 border border-slate-100 font-black">{r.matr || r.MATR}</td>
                          <td className="px-5 py-4 border border-slate-100"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black">{r.nl}</span></td>
                          <td className="px-5 py-4 border border-slate-100 font-black">{r.l_atual}</td>
                          <td className="px-5 py-4 border border-slate-100 font-bold italic text-slate-700">{r[currentConfig.motivoKey]}</td>
                        </tr>
                       ))}
                       {filteredData.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-6 py-28 text-center text-slate-300 font-bold uppercase tracking-widest italic">
                             Nenhum registro localizado para os filtros informados no lote atual
                          </td>
                        </tr>
                       )}
                    </tbody>
                 </table>
              </div>

              {/* Paginação Profissional */}
              <div className="px-10 py-10 bg-slate-50 flex items-center justify-between border-t">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Página {currentSubState.currentPage} de {totalPages} ({filteredData.length} registros)
                </span>
                <div className="flex gap-4">
                   <button 
                     onClick={() => updateCurrentState({ currentPage: Math.max(1, currentSubState.currentPage - 1) })} 
                     disabled={currentSubState.currentPage === 1} 
                     className="px-8 py-3.5 bg-white border border-slate-200 rounded-xl disabled:opacity-30 transition-all shadow-sm font-bold text-xs"
                   >
                     <ChevronLeft size={18}/>
                   </button>
                   <button 
                     onClick={() => updateCurrentState({ currentPage: Math.min(totalPages, currentSubState.currentPage + 1) })} 
                     disabled={currentSubState.currentPage >= totalPages} 
                     className="px-8 py-3.5 bg-white border border-slate-200 rounded-xl disabled:opacity-30 transition-all shadow-sm font-bold text-xs"
                   >
                     <ChevronRight size={18}/>
                   </button>
                </div>
              </div>
           </section>
        </div>
      )}

      {/* Loading Overlay com Backdrop Blur */}
      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center">
           <div className="bg-white p-24 rounded-[60px] shadow-2xl flex flex-col items-center gap-10 animate-in zoom-in-95 duration-300">
              <div className="relative h-24 w-24">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-blue-600 animate-spin"></div>
                 <Activity size={32} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="text-center">
                 <h2 className="text-2xl font-black uppercase italic text-slate-950 tracking-tighter">Sincronizando Lote</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Acessando núcleo de dados SAL...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PrintControl;
