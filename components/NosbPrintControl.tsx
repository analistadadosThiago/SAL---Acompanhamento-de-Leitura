
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  MONTH_ORDER,
  RPC_CL_FILTROS
} from '../constants';
import { 
  Printer, RotateCcw, ShieldAlert, ScanLine, 
  Table as TableIcon, FileDown, ChevronLeft, 
  ChevronRight, Printer as PrinterIcon, Zap,
  Filter, ClipboardList, Target, Activity, 
  CheckCircle2, Loader2, Search, X, Check, ChevronDown,
  Users, BarChart3, TrendingUp, Hash, Layers,
  Maximize2, Minimize2, FileText, FileSpreadsheet
} from 'lucide-react';
import IndicatorCard from './IndicatorCard';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const ITEMS_PER_PAGE = 25;

enum NosbSubMenu {
  IMPEDIMENTOS = 'IMPEDIMENTOS',
  SIMULACAO = 'SIMULACAO'
}

interface NosbState {
  ano: string;
  mes: string;
  rz: string;
  matr: string;
  motivo: string;
  data: any[];
  loaded: boolean;
  executing: boolean;
  page: number;
}

const NosbPrintControl: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<NosbSubMenu>(NosbSubMenu.IMPEDIMENTOS);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [options, setOptions] = useState<{ anos: string[], meses: string[], razoes: string[], matriculas: string[], motivos: string[] }>({
    anos: [], meses: [], razoes: [], matriculas: [], motivos: []
  });
  
  const [state, setState] = useState<NosbState>({
    ano: '2024', mes: '', rz: '', matr: '', motivo: '',
    data: [], loaded: false, executing: false, page: 1
  });

  const [loadingInitial, setLoadingInitial] = useState(false);

  const subMenuConfig = {
    [NosbSubMenu.IMPEDIMENTOS]: {
      label: 'Impedimentos (NOSB)',
      icon: <ShieldAlert size={20} />,
      rpc: RPC_CE_IMPEDIMENTOS,
      motivoKey: 'nosb_impedimento',
      color: '#e74c3c'
    },
    [NosbSubMenu.SIMULACAO]: {
      label: 'Simulações (NOSB)',
      icon: <ScanLine size={20} />,
      rpc: RPC_CE_SIMULACAO_NOSB,
      motivoKey: 'nosb_simulacao',
      color: '#3498db'
    }
  };

  const config = subMenuConfig[activeSubMenu];

  useEffect(() => {
    const fetchBaseData = async () => {
      setLoadingInitial(true);
      try {
        const { data: filterRes } = await supabase.rpc(RPC_CL_FILTROS);
        const f = Array.isArray(filterRes) ? filterRes[0] : filterRes;
        if (f) {
          setOptions(prev => ({
            ...prev,
            anos: (f.anos || []).map(String),
            meses: (f.meses || []).map(String).sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0)),
            matriculas: (f.matriculas || []).map(String).sort()
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar filtros NOSB:", err);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchBaseData();
  }, []);

  const handleSincronizar = async () => {
    if (!state.ano || !state.mes) {
      alert('⚠️ Por favor, selecione ANO e MÊS para buscar os dados.');
      return;
    }
    
    setState(p => ({ ...p, executing: true }));
    try {
      const { data, error } = await supabase.rpc(config.rpc, {
        p_ano: parseInt(state.ano),
        p_mes: state.mes,
        p_rz: null,
        p_matr: null
      });

      if (error) throw error;

      const rawData = data || [];
      const uniqueRz = Array.from(new Set(rawData.map((i: any) => String(i.rz || i.razao || i.razao_social || i.RZ || '').trim()))).filter(Boolean).sort();
      const uniqueMatr = Array.from(new Set(rawData.map((i: any) => String(i.matr || i.matricula || i.MATR || '').trim()))).filter(Boolean).sort();
      const uniqueMotivos = Array.from(new Set(rawData.map((i: any) => String(i.motivo || i[config.motivoKey] || '').trim()))).filter(Boolean).sort();

      setOptions(prev => ({ ...prev, razoes: uniqueRz, matriculas: uniqueMatr, motivos: uniqueMotivos }));
      setState(p => ({ ...p, data: rawData, loaded: true, executing: false, page: 1 }));
    } catch (err) {
      console.error("Erro ao sincronizar NOSB:", err);
      setState(p => ({ ...p, executing: false }));
    }
  };

  const filteredData = useMemo(() => {
    return state.data.filter(item => {
      const itemRz = String(item.rz || item.razao || item.razao_social || item.RZ || '').trim();
      const itemMatr = String(item.matr || item.matricula || item.MATR || '').trim();
      const itemMotivo = String(item.motivo || item[config.motivoKey] || '').trim();
      
      const matchRz = !state.rz || itemRz === state.rz;
      const matchMatr = !state.matr || itemMatr === state.matr;
      const matchMotivo = !state.motivo || itemMotivo === state.motivo;
      return matchRz && matchMatr && matchMotivo;
    });
  }, [state.data, state.rz, state.matr, state.motivo, config.motivoKey]);

  const paginatedData = useMemo(() => {
    const start = (state.page - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, state.page]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  const metrics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const motif = String(item.motivo || item[config.motivoKey] || 'N/A');
      counts[motif] = (counts[motif] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      count: filteredData.length,
      topMotif: sorted.length > 0 ? sorted[0][0] : 'N/A',
      uniqueMatr: new Set(filteredData.map(i => i.matr)).size
    };
  }, [filteredData, config.motivoKey]);

  const summaryByRazao = useMemo(() => {
    const summary: Record<string, { razao: string, total: number }> = {};
    filteredData.forEach(item => {
      const rz = String(item.rz || item.razao || item.razao_social || item.RZ || 'N/A').trim();
      if (!summary[rz]) summary[rz] = { razao: rz, total: 0 };
      summary[rz].total++;
    });
    return Object.values(summary).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const reset = () => {
    setState({ ano: '2024', mes: '', rz: '', matr: '', motivo: '', data: [], loaded: false, executing: false, page: 1 });
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    const exportData = filteredData.map(r => ({
      "MES": r.mes,
      "ANO": r.ano,
      "RAZÃO SOCIAL": String(r.rz || r.razao || r.razao_social || '').trim(),
      "UL": r.rz_ul_lv,
      "INSTALAÇÃO": r.instalacao,
      "MEDIDOR": r.medidor,
      "REG": r.reg,
      "TIPO": r.tipo || 'N/A',
      "MATRÍCULA": String(r.matr || r.matricula || '').trim(),
      "CÓDIGO": r.nl,
      "LEITURA": r.l_atual,
      "MOTIVO NOSB": r.motivo || r[config.motivoKey]
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SAL_NOSB_Export");
    XLSX.writeFile(wb, `SAL_NOSB_${activeSubMenu}_${state.mes}_${state.ano}.xlsx`);
  };

  const handleExportPDF = () => {
    if (filteredData.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(12);
    doc.text(`SAL Enterprise - Auditoria NOSB: ${config.label}`, 14, 15);
    doc.setFontSize(8);
    doc.text(`Período: ${state.mes}/${state.ano} | Filtros: ${state.rz || 'Todos'} | ${state.matr || 'Todas'}`, 14, 20);

    const headers = [['MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'TIPO', 'MATR', 'COD', 'LEITURA', 'MOTIVO NOSB']];
    const body = filteredData.slice(0, 500).map(r => [
      r.mes, r.ano, String(r.rz || r.razao || '').trim(), r.rz_ul_lv, r.instalacao, r.medidor, r.reg, r.tipo || 'N/A',
      String(r.matr || r.matricula || '').trim(), r.nl, r.l_atual, r.motivo || r[config.motivoKey]
    ]);

    autoTable(doc, {
      startY: 25,
      head: headers,
      body: body,
      styles: { fontSize: 6, cellPadding: 1 },
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    doc.save(`SAL_NOSB_Relatorio_${activeSubMenu}.pdf`);
  };

  return (
    <div className={`space-y-10 pb-24 ${isFullScreen ? 'fixed inset-0 z-[100] bg-[#f8fafc] overflow-y-auto p-10' : 'relative'}`}>
      {/* Cabeçalho do Módulo */}
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#2c3e50] via-[#3498db] to-[#2c3e50]"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-[#020617] text-white rounded-[2rem] shadow-2xl shadow-slate-900/20">
              <Printer size={32} />
            </div>
            <div>
              <div className="flex items-center gap-4">
                 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                  Nosb.Impressão
                </h2>
                <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-all print:hidden">
                  {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Activity size={14} className="text-[#3498db]" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Módulo de Auditoria Profissional v9.0 | 12 Colunas Estruturais
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner print:hidden">
            {Object.entries(subMenuConfig).map(([key, cfg]) => (
              <button 
                key={key} 
                onClick={() => { setActiveSubMenu(key as NosbSubMenu); setState(p => ({ ...p, loaded: false, data: [] })); }}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubMenu === key ? 'bg-white text-[#3498db] shadow-md translate-y-[-1px]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painel de Filtros Profissional */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200 print:hidden relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#3498db]"></div>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-[#3498db] rounded-xl"><Filter size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Parâmetros Operacionais NOSB</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Matriz v9.0</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Ano</label>
            <select 
              value={state.ano} 
              onChange={e => setState(p => ({ ...p, ano: e.target.value, loaded: false, data: [] }))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
            >
              <option value="">Selecione</option>
              {options.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Mês</label>
            <select 
              value={state.mes} 
              onChange={e => setState(p => ({ ...p, mes: e.target.value, loaded: false, data: [] }))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
            >
              <option value="">Selecione</option>
              {options.meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">3. Razão Social</label>
            <select 
              value={state.rz} 
              disabled={!state.loaded}
              onChange={e => setState(p => ({ ...p, rz: e.target.value, page: 1 }))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-[#3498db] outline-none transition-all disabled:opacity-30"
            >
              <option value="">Todas as Razões</option>
              {options.razoes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">4. Matrícula</label>
            <select 
              value={state.matr} 
              disabled={!state.loaded}
              onChange={e => setState(p => ({ ...p, matr: e.target.value, page: 1 }))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-[#3498db] outline-none transition-all disabled:opacity-30"
            >
              <option value="">Todas as Matrículas</option>
              {options.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">5. Motivo</label>
            <select 
              value={state.motivo} 
              disabled={!state.loaded}
              onChange={e => setState(p => ({ ...p, motivo: e.target.value, page: 1 }))} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold focus:border-[#3498db] outline-none transition-all disabled:opacity-30"
            >
              <option value="">Todos os Motivos</option>
              {options.motivos.map(mo => <option key={mo} value={mo}>{mo}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-6">
           <div className="flex gap-6">
             <button 
               onClick={handleSincronizar} 
               disabled={!state.ano || !state.mes || state.executing} 
               className="px-24 py-5 bg-[#020617] text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center gap-4"
             >
                {state.executing ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />}
                BUSCAR DADOS
             </button>
             <button onClick={reset} className="px-12 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-200 transition-all">
               <RotateCcw size={16} /> REINICIAR
             </button>
           </div>
        </div>
      </section>

      {/* Resultados e Tabela Principal */}
      {state.loaded && (
        <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <IndicatorCard label="Dataset Analítico" value={metrics.count.toLocaleString()} icon={<ClipboardList size={24}/>} color="blue" />
              <IndicatorCard label="Principal Ocorrência" value={metrics.topMotif} icon={<Target size={24}/>} color="amber" />
              <IndicatorCard label="Técnicos Impactados" value={metrics.uniqueMatr.toLocaleString()} icon={<Users size={24}/>} color="green" />
           </div>

           <section className="bg-white rounded-[4rem] shadow-sm border border-slate-200 overflow-hidden print-report-only">
              <div className="px-12 py-10 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 print:hidden">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-[#2c3e50] text-white rounded-2xl shadow-xl"><TableIcon size={24} /></div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight italic">Relatório de Auditoria NOSB</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fonte: {config.label}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={handleExportExcel} className="flex items-center gap-4 px-8 py-5 bg-[#27ae60] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#219653] transition-all shadow-lg shadow-emerald-600/20">
                    <FileSpreadsheet size={20}/> EXCEL
                  </button>
                  <button onClick={handleExportPDF} className="flex items-center gap-4 px-8 py-5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20">
                    <FileText size={20}/> PDF
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-4 px-8 py-5 bg-[#3498db] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2980b9] transition-all shadow-lg shadow-blue-600/20">
                    <PrinterIcon size={20}/> IMPRIMIR
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                 <table id="nosb-report-table" className="w-full text-left text-[11px] border-collapse print:text-[7.5pt]">
                    <thead className="bg-[#34495e] text-white font-black uppercase tracking-widest border-b">
                       <tr>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black text-center">MES</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black text-center">ANO</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black">RAZÃO</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black text-center">UL</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black">INSTALAÇÃO</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black">MEDIDOR</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black text-center">REG</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black text-center">TIPO</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black">MATR</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] print:border-black text-center">COD</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] text-right">LEITURA</th>
                         <th className="px-6 py-6 border-x border-[#4a6572] bg-[#2c3e50]/50 font-black italic">MOTIVO NOSB</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                       {paginatedData.map((r, i) => (
                          <tr key={i} className="hover:bg-[#e8f4fd] transition-colors">
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase font-bold">{r.mes}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">{r.ano}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-bold text-slate-900 uppercase whitespace-nowrap">{String(r.rz || r.razao || r.razao_social || r.RZ || '').trim()}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">{r.rz_ul_lv}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-mono text-blue-600 font-bold">{r.instalacao}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-mono">{r.medidor}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase">{r.reg}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center uppercase text-[9px] font-black">{r.tipo || 'N/A'}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-bold">{String(r.matr || r.matricula || r.MATR || '').trim()}</td>
                            <td className="px-6 py-5 border-x border-slate-50 text-center">
                              <span className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-700">{r.nl}</span>
                            </td>
                            <td className="px-6 py-5 border-x border-slate-50 text-right font-black text-slate-900">{r.l_atual}</td>
                            <td className="px-6 py-5 border-x border-slate-50 font-black italic text-blue-800 bg-blue-50/20">{r.motivo || r[config.motivoKey]}</td>
                          </tr>
                       ))}
                       {paginatedData.length === 0 && (
                          <tr>
                            <td colSpan={12} className="px-12 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                              Nenhum registro localizado para os filtros informados.
                            </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              <div className="px-12 py-8 bg-slate-50 border-t flex items-center justify-between print:hidden">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Página {state.page} de {totalPages}</span>
                <div className="flex gap-4">
                   <button onClick={() => setState(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={state.page === 1} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-[#3498db] transition-all disabled:opacity-30"><ChevronLeft size={20}/></button>
                   <button onClick={() => setState(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))} disabled={state.page >= totalPages} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-[#3498db] transition-all disabled:opacity-30"><ChevronRight size={20}/></button>
                </div>
              </div>
           </section>

           {/* Tabela Resumo Quantitativa */}
           <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-[#2c3e50] px-10 py-6 flex items-center gap-4">
               <div className="p-3 bg-white text-[#2c3e50] rounded-xl shadow-sm"><Layers size={24} /></div>
               <div>
                  <h3 className="text-lg font-black uppercase text-white tracking-tight italic">Resumo Quantitativo por Razão</h3>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Compilação Estratégica v9.0</p>
               </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm border-collapse">
                 <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest text-[11px]">
                   <tr>
                     <th className="px-10 py-5 border-x border-slate-100">RAZÃO SOCIAL</th>
                     <th className="px-10 py-5 border-x border-slate-100 text-center">STATUS NOSB</th>
                     <th className="px-10 py-5 text-center">QUANTIDADE</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {summaryByRazao.map((row, idx) => (
                     <tr key={idx} className="hover:bg-slate-50 transition-colors">
                       <td className="px-10 py-4 font-black text-slate-900 uppercase">{row.razao}</td>
                       <td className="px-10 py-4 text-center">
                          <span className="bg-rose-50 text-[#e74c3c] px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-rose-100 italic">ATENÇÃO: NOSB ATIVO</span>
                       </td>
                       <td className="px-10 py-4 text-center font-black text-lg text-slate-800">{row.total.toLocaleString()}</td>
                     </tr>
                   ))}
                   {summaryByRazao.length === 0 && (
                     <tr>
                       <td colSpan={3} className="px-10 py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">Aguardando dados...</td>
                     </tr>
                   )}
                 </tbody>
                 <tfoot className="bg-slate-900 text-white font-black uppercase italic">
                    <tr>
                      <td className="px-10 py-6">TOTAL GERAL COMPILADO</td>
                      <td className="px-10 py-6 text-center">-</td>
                      <td className="px-10 py-6 text-center text-xl">{metrics.count.toLocaleString()}</td>
                    </tr>
                 </tfoot>
               </table>
             </div>
           </section>
        </div>
      )}

      {/* Placeholder Inicial */}
      {!state.loaded && !state.executing && (
        <div className="flex flex-col items-center justify-center py-40 bg-white border-2 border-dashed border-slate-200 rounded-[4rem] text-center animate-pulse">
          <div className="p-12 bg-slate-50 rounded-full mb-8 text-slate-200"><Search size={100} /></div>
          <h3 className="text-slate-900 font-black text-3xl mb-4 tracking-tighter uppercase italic">Aguardando Sincronização</h3>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] px-20 max-w-lg">Selecione Ano e Mês para materializar a visão de auditoria de não impressão (NOSB).</p>
        </div>
      )}

      {/* Loader de Sincronização Neural */}
      {state.executing && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-20 rounded-[50px] shadow-2xl flex flex-col items-center gap-6 border border-slate-100">
             <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-50 border-t-[#3498db] animate-spin"></div>
                <Loader2 size={32} className="absolute inset-0 m-auto text-[#3498db] animate-pulse" />
             </div>
             <div className="text-center">
               <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Sincronização Neural</h2>
               <p className="text-[9px] font-bold text-[#3498db] uppercase tracking-[0.5em] mt-3 animate-pulse">Materializando Base Técnica v9.0...</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NosbPrintControl;
