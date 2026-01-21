
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO,
  RPC_CE_TIPO_V9
} from '../constants';
import { 
  Filter, Play, RotateCcw, AlertCircle, 
  Loader2, ImageIcon, Database, 
  TrendingUp, CheckCircle2, XCircle, ShieldCheck,
  Users, FileSpreadsheet, FileText, Search, ChevronDown,
  Activity, Zap, Layout
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * WRAPPER LOCAL V9 - MENU AUDITORIA
 * 
 * Regra de Negócio Implementada:
 * 1. Sincronização Única: p_ano (Binder) e p_mes ("Todos").
 * 2. Materialização: O resultado da RPC é persistido no estado local datasetAuditoriaV9.
 * 3. Binder Ativo: O sistema registra o binder e habilita refinamentos 100% locais.
 */

const EvidenceControl: React.FC = () => {
  // --- Controle de Binder e Dataset Materializado ---
  const [filterAno, setFilterAno] = useState<string>('');
  const [activeBinder, setActiveBinder] = useState<string | null>(null);
  const [datasetAuditoriaV9, setDatasetAuditoriaV9] = useState<any[]>([]);
  const [anosOptions, setAnosOptions] = useState<string[]>([]);
  
  // --- Filtros de Refinamento (Client-Side Only) ---
  const [filterMes, setFilterMes] = useState<string>('');
  const [filterMatr, setFilterMatr] = useState<string>('');
  const [filterRazao, setFilterRazao] = useState<string>('');
  
  // --- UI States ---
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Busca inicial dos anos disponíveis (Binders)
  useEffect(() => {
    const fetchAnosBinder = async () => {
      try {
        const { data, error } = await supabase.rpc(RPC_CE_FILTRO_ANO);
        if (error) throw error;
        if (data) {
          const sortedAnos = data
            .map((a: any) => String(a.ano || a))
            .sort((a: any, b: any) => Number(b) - Number(a));
          setAnosOptions(sortedAnos);
        }
      } catch (err: any) {
        console.error("Falha ao carregar metadados de anos:", err);
      }
    };
    fetchAnosBinder();
  }, []);

  /**
   * EXECUÇÃO DO WRAPPER LOCAL
   * Realiza a carga integral para o Binder selecionado.
   */
  const carregarAuditoriaV9 = async (anoSelecionado: string) => {
    setLoading(true);
    setErrorMsg(null);
    setHasGenerated(false);
    
    try {
      // Chamada RPC com p_mes fixo como "Todos" para carregar o dataset completo do ano
      const { data, error } = await supabase.rpc(RPC_CE_TIPO_V9, {
        p_ano: Number(anoSelecionado),
        p_mes: "Todos"
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMsg(`Atenção: Nenhum dataset localizado para o Binder ${anoSelecionado}.`);
        setDatasetAuditoriaV9([]);
        setActiveBinder(null);
      } else {
        // MATERIALIZAÇÃO EM MEMÓRIA LOCAL
        setDatasetAuditoriaV9(data);
        setActiveBinder(anoSelecionado);
        setHasGenerated(true);
        
        // Reset de refinamentos para nova carga de binder
        setFilterMes('');
        setFilterRazao('');
        setFilterMatr('');
      }
    } catch (err: any) {
      console.error("Erro na materialização local V9:", err);
      setErrorMsg("Erro na sincronização do Binder. Verifique a conexão com o banco.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * DERIVAÇÃO DE FILTROS DINÂMICOS (100% LOCAL)
   * Extrai opções únicas do dataset já materializado.
   */
  const dynamicOptions = useMemo(() => {
    if (!datasetAuditoriaV9.length) return { meses: [], razoes: [], matriculas: [] };
    
    const meses = Array.from(new Set(datasetAuditoriaV9.map((item: any) => String(item.mes || ''))))
      .filter(v => v && v !== 'null')
      .sort((a: string, b: string) => {
        const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
        return months.indexOf(a.toUpperCase()) - months.indexOf(b.toUpperCase());
      });

    const razoes = Array.from(new Set(datasetAuditoriaV9.map((item: any) => String(item.rz || item.razao || ''))))
      .filter(v => v && v !== 'null')
      .sort();
      
    const matriculas = Array.from(new Set(datasetAuditoriaV9.map((item: any) => String(item.matr || ''))))
      .filter(v => v && v !== 'null')
      .sort();

    return { meses, razoes, matriculas };
  }, [datasetAuditoriaV9]);

  /**
   * FILTRAGEM INSTANTÂNEA EM MEMÓRIA
   */
  const filteredView = useMemo(() => {
    return datasetAuditoriaV9.filter(item => {
      const matchMes = filterMes ? (String(item.mes).toUpperCase() === filterMes.toUpperCase()) : true;
      const matchRz = filterRazao ? (String(item.rz || item.razao) === filterRazao) : true;
      const matchMatr = filterMatr ? (String(item.matr) === filterMatr) : true;
      return matchMes && matchRz && matchMatr;
    });
  }, [datasetAuditoriaV9, filterMes, filterRazao, filterMatr]);

  /**
   * SUMARIZAÇÃO DOS DADOS FILTRADOS
   */
  const summary = useMemo(() => {
    const totalSolicitadas = filteredView.reduce((acc, curr) => acc + (Number(curr.solicitadas) || 0), 0);
    const totalRealizadas = filteredView.reduce((acc, curr) => acc + (Number(curr.realizadas) || 0), 0);
    const naoRealizadas = Math.max(0, totalSolicitadas - totalRealizadas);
    const percIndicador = totalSolicitadas > 0 ? (naoRealizadas / totalSolicitadas) * 100 : 0;

    return {
      solicitadas: totalSolicitadas,
      realizadas: totalRealizadas,
      nao_realizadas: naoRealizadas,
      indicador: percIndicador
    };
  }, [filteredView]);

  const handleSincronizar = () => {
    if (!filterAno) {
      setErrorMsg("Obrigatório: Selecione um Binder para sincronização.");
      return;
    }
    carregarAuditoriaV9(filterAno);
  };

  const handleReset = () => {
    setFilterAno('');
    setActiveBinder(null);
    setFilterMes('');
    setFilterMatr('');
    setFilterRazao('');
    setDatasetAuditoriaV9([]);
    setHasGenerated(false);
    setErrorMsg(null);
  };

  const getFormatStyle = (indicador: any) => {
    const val = parseFloat(indicador);
    if (isNaN(val)) return 'bg-white text-slate-400';
    if (val >= 50) return 'bg-[#991b1b] text-white font-black'; // Crítico
    if (val >= 41) return 'bg-[#b45309] text-white font-bold'; // Alerta
    return 'bg-[#166534] text-white font-medium'; // Eficiente
  };

  const exportExcel = () => {
    if (!filteredView.length) return;
    const exportRows = filteredView.map(r => ({
      'Competência': `${r.mes}/${activeBinder}`,
      'Razão Social': r.rz || r.razao || '-',
      'Matrícula': r.matr || '-',
      'Solicitadas': r.solicitadas,
      'Realizadas': r.realizadas,
      'Taxa Falha (%)': (parseFloat(r.indicador) || 0).toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria_Local_V9");
    XLSX.writeFile(wb, `SAL_Auditoria_${activeBinder}_Export.xlsx`);
  };

  const exportPDF = () => {
    if (!filteredView.length) return;
    const doc = new jsPDF('landscape');
    const headers = ["COMPETÊNCIA", "RAZÃO / UNIDADE", "MATRÍCULA", "SOLICITADAS", "REALIZADAS", "FALHA (%)"];
    const body = filteredView.map(item => [
      `${item.mes}/${activeBinder}`,
      item.rz || item.razao || '-',
      item.matr || '-',
      (item.solicitadas || 0).toLocaleString(),
      (item.realizadas || 0).toLocaleString(),
      (parseFloat(item.indicador) || 0).toFixed(2).replace('.', ',') + '%'
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center', fontStyle: 'bold' },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
    });
    doc.save(`SAL_Relatorio_Auditoria_${activeBinder}.pdf`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-32">
      
      {/* STATUS DO BINDER ATIVO */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-6 no-print">
        <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Binder Selecionado</span>
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl text-white shadow-xl transition-all duration-500 ${activeBinder ? 'bg-blue-600 scale-105' : 'bg-slate-950'}`}>
              <ShieldCheck size={16} className={activeBinder ? "text-blue-200" : "text-slate-500"} />
              <span className="text-[11px] font-black uppercase tracking-widest">
                {activeBinder ? `ATIVO: ${activeBinder}` : 'AGUARDANDO SINCRONIZAÇÃO'}
              </span>
            </div>
          </div>
          <div className="h-12 w-px bg-slate-100 hidden md:block"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dataset Materializado</span>
            <span className={`text-[11px] font-black px-4 py-2 rounded-xl border transition-all ${hasGenerated ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
              {hasGenerated ? `${datasetAuditoriaV9.length.toLocaleString()} REGISTROS EM CACHE` : 'MEMÓRIA VAZIA'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-950 px-6 py-4 rounded-3xl border border-white/10 shadow-2xl">
           <Zap size={20} className="text-blue-400 animate-pulse" />
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Local Processing</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">V9 Wrapper Active</span>
           </div>
        </div>
      </div>

      {/* CONSOLE DE FILTROS (OPERAÇÕES LOCAIS) */}
      <section className="bg-white p-12 rounded-[48px] shadow-xl border border-slate-200 no-print relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity"><Layout size={140} /></div>
        
        <div className="flex items-center gap-4 mb-12 relative z-10">
          <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-500/30"><Database size={24} /></div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Painel de Auditoria V9</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
              Sincronização Binder & Refinamentos Instantâneos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-blue-600 shadow-lg shadow-blue-500/50"></div>
              1. Definir Binder (Ano)
            </label>
            <div className="relative">
              <select 
                value={filterAno} 
                onChange={(e) => setFilterAno(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-[24px] py-5 px-8 text-sm font-black outline-none transition-all hover:border-blue-400 hover:bg-white focus:ring-8 focus:ring-blue-50 appearance-none text-slate-900 shadow-inner"
              >
                <option value="">Selecionar Ano</option>
                {anosOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={20} />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${hasGenerated ? 'bg-green-500' : 'bg-slate-200'}`}></div>
              2. Filtrar Mês (Cache)
            </label>
            <div className="relative">
              <select 
                value={filterMes} 
                onChange={(e) => setFilterMes(e.target.value)} 
                disabled={!hasGenerated}
                className="w-full bg-slate-50 border border-slate-200 rounded-[24px] py-5 px-8 text-sm font-bold outline-none transition-all hover:border-blue-400 focus:ring-8 focus:ring-blue-50 disabled:opacity-20 appearance-none text-slate-700 shadow-inner"
              >
                <option value="">Dataset Completo</option>
                {dynamicOptions.meses.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
              <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={20} />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <div className={`h-2 w-2 rounded-full ${hasGenerated ? 'bg-green-500' : 'bg-slate-200'}`}></div>
               3. Filtrar Razão (Cache)
            </label>
            <div className="relative">
              <select 
                value={filterRazao} 
                onChange={(e) => setFilterRazao(e.target.value)} 
                disabled={!hasGenerated}
                className="w-full bg-slate-50 border border-slate-200 rounded-[24px] py-5 px-8 text-sm font-bold outline-none transition-all hover:border-blue-400 focus:ring-8 focus:ring-blue-50 disabled:opacity-20 appearance-none text-slate-700 shadow-inner"
              >
                <option value="">Todas Unidades</option>
                {dynamicOptions.razoes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={20} />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${hasGenerated ? 'bg-green-500' : 'bg-slate-200'}`}></div>
              4. Filtrar Matrícula (Cache)
            </label>
            <div className="relative">
              <select 
                value={filterMatr} 
                onChange={(e) => setFilterMatr(e.target.value)} 
                disabled={!hasGenerated}
                className="w-full bg-slate-50 border border-slate-200 rounded-[24px] py-5 px-8 text-sm font-bold outline-none transition-all hover:border-blue-400 focus:ring-8 focus:ring-blue-50 disabled:opacity-20 appearance-none text-slate-700 shadow-inner"
              >
                <option value="">Todos Técnicos</option>
                {dynamicOptions.matriculas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={20} />
            </div>
          </div>
        </div>

        <div className="mt-16 flex justify-center gap-8 relative z-10">
          <button 
            onClick={handleSincronizar} 
            disabled={loading} 
            className="group flex items-center gap-5 px-24 py-6 bg-slate-950 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.25em] shadow-2xl hover:bg-slate-800 transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-30"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} className="group-hover:text-blue-400 transition-colors" fill="currentColor" />} 
            SINCRONIZAR V9
          </button>
          <button onClick={handleReset} className="flex items-center gap-4 px-12 py-6 bg-slate-100 text-slate-500 rounded-[28px] text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200 shadow-sm">
            <RotateCcw size={18} /> REFRESH BINDER
          </button>
        </div>

        {errorMsg && (
          <div className="mt-10 p-7 bg-red-50 border-l-[10px] border-red-600 rounded-3xl flex items-center gap-5 text-red-900 text-xs font-black uppercase shadow-xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-2 bg-red-600 text-white rounded-full"><AlertCircle size={20} /></div>
            <p>{errorMsg}</p>
          </div>
        )}
      </section>

      {hasGenerated && (
        <div className="space-y-14 animate-in slide-in-from-bottom-12 duration-1000">
          
          {/* INDICADORES LOCAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="bg-white p-12 rounded-[48px] border-b-[12px] border-blue-600 shadow-xl border border-slate-200 transition-transform hover:-translate-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <Search size={14} className="text-blue-500" /> Dataset Solicitado
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-slate-950 tracking-tighter leading-none">{summary.solicitadas.toLocaleString()}</span>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Unidades</span>
              </div>
            </div>
            <div className="bg-white p-12 rounded-[48px] border-b-[12px] border-green-600 shadow-xl border border-slate-200 transition-transform hover:-translate-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-500" /> Êxito Auditoria
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-green-700 tracking-tighter leading-none">{summary.realizadas.toLocaleString()}</span>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OK</span>
              </div>
            </div>
            <div className="bg-white p-12 rounded-[48px] border-b-[12px] border-red-600 shadow-xl border border-slate-200 transition-transform hover:-translate-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <XCircle size={14} className="text-red-500" /> Lacunas Finais
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-red-700 tracking-tighter leading-none">{summary.nao_realizadas.toLocaleString()}</span>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PEND</span>
              </div>
            </div>
            <div className="bg-white p-12 rounded-[48px] border-b-[12px] border-amber-600 shadow-xl border border-slate-200 transition-transform hover:-translate-y-3">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <TrendingUp size={14} className="text-amber-500" /> Indicador de Falha
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-amber-700 tracking-tighter leading-none">{summary.indicador.toFixed(2)}</span>
                <span className="text-2xl font-black text-amber-500 uppercase tracking-tighter">%</span>
              </div>
            </div>
          </div>

          {/* TABELA DE CACHE V9 */}
          <section className="bg-white rounded-[56px] shadow-2xl border border-slate-200 overflow-hidden relative">
            <div className="px-14 py-12 border-b border-slate-100 flex flex-wrap items-center justify-between gap-8 no-print bg-slate-50/20">
              <div className="flex items-center gap-6">
                 <div className="p-4 bg-slate-950 rounded-2xl text-white shadow-xl shadow-slate-900/20"><Users size={24} /></div>
                 <div>
                    <h3 className="text-lg font-black text-slate-950 uppercase tracking-widest italic">Visão de Auditoria Materializada</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.35em] mt-1 flex items-center gap-2">
                      Binder Ativo: {activeBinder}
                      <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                      Processamento Instantâneo
                    </p>
                 </div>
              </div>
              <div className="flex gap-5">
                <button onClick={exportExcel} className="p-5 bg-green-50 text-green-700 rounded-3xl hover:bg-green-100 transition-all border border-green-200 shadow-sm" title="Excel"><FileSpreadsheet size={24} /></button>
                <button onClick={exportPDF} className="px-10 py-5 bg-slate-950 text-white rounded-3xl hover:bg-slate-800 transition-all shadow-2xl flex items-center gap-4 font-black text-[11px] uppercase tracking-widest"><FileText size={20} /> Relatório PDF</button>
              </div>
            </div>

            <div className="overflow-x-auto p-14">
              <table className="w-full text-left border-collapse border border-slate-300 rounded-[32px] overflow-hidden shadow-sm">
                <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-[0.25em] text-slate-900 border border-slate-300">
                  <tr>
                    <th className="px-10 py-8 border border-slate-300">Competência</th>
                    <th className="px-10 py-8 border border-slate-300">Razão / Unidade Gestora</th>
                    <th className="px-10 py-8 border border-slate-300">Matrícula Técnico</th>
                    <th className="px-10 py-8 text-center border border-slate-300">Solicitadas</th>
                    <th className="px-10 py-8 text-center border border-slate-300">Realizadas</th>
                    <th className="px-10 py-8 text-center border border-slate-300 bg-slate-200/40">FALHA (%)</th>
                  </tr>
                </thead>
                <tbody className="text-[12px] font-black">
                  {filteredView.map((row, idx) => {
                    const style = getFormatStyle(row.indicador);
                    return (
                      <tr key={idx} className={`${style} border border-slate-300 transition-all duration-300 hover:brightness-110 hover:translate-x-1`}>
                        <td className="px-10 py-6 border border-slate-300 uppercase whitespace-nowrap">{row.mes}/{activeBinder}</td>
                        <td className="px-10 py-6 border border-slate-300 font-black whitespace-nowrap">{row.rz || row.razao || '-'}</td>
                        <td className="px-10 py-6 border border-slate-300 font-mono tracking-widest text-sm">{row.matr || '-'}</td>
                        <td className="px-10 py-6 text-center border border-slate-300 text-sm">{(row.solicitadas || 0).toLocaleString()}</td>
                        <td className="px-10 py-6 text-center border border-slate-300 text-sm">{(row.realizadas || 0).toLocaleString()}</td>
                        <td className="px-10 py-6 text-center border border-slate-300 font-black text-lg italic tracking-tighter">
                          {(parseFloat(row.indicador) || 0).toFixed(2).replace('.', ',')}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredView.length === 0 && (
                <div className="py-40 text-center flex flex-col items-center gap-8">
                  <div className="p-10 bg-slate-50 rounded-full shadow-inner border border-slate-100 animate-pulse"><Search size={64} className="text-slate-100" /></div>
                  <h4 className="text-slate-950 font-black text-xl uppercase tracking-widest italic">Nenhum dado refinado</h4>
                </div>
              )}
            </div>
          </section>

        </div>
      )}

      {/* ESTADO INICIAL / AGUARDANDO BINDER */}
      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-72 bg-white rounded-[100px] border-2 border-dashed border-slate-200 text-center mx-auto max-w-5xl no-print shadow-inner group">
          <div className="w-44 h-44 bg-slate-50 rounded-full flex items-center justify-center mb-14 shadow-2xl border border-slate-100 group-hover:scale-110 transition-transform duration-500">
             <ImageIcon size={64} className="text-slate-200" />
          </div>
          <h3 className="text-slate-950 font-black text-5xl mb-8 tracking-tighter uppercase italic">Auditoria de Evidências</h3>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.5em] px-40 leading-loose max-w-4xl">
            Sincronização com <span className="text-blue-600 font-black">Cache Local</span> materializado. <br/>
            Selecione o <span className="text-slate-950 underline underline-offset-8 decoration-blue-500 decoration-4">Binder Anual</span> para carregar os indicadores V9.
          </p>
        </div>
      )}

      {/* LOADER DE MATERIALIZAÇÃO */}
      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center">
          <div className="bg-white p-28 rounded-[80px] shadow-2xl flex flex-col items-center gap-14 text-center border border-white/20 animate-in zoom-in-95 duration-500">
             <div className="relative h-40 w-40">
                <div className="absolute inset-0 rounded-full border-[12px] border-slate-100 border-t-blue-600 animate-spin"></div>
                <div className="absolute inset-0 m-auto flex items-center justify-center">
                   <Activity size={50} className="text-blue-600 animate-pulse" />
                </div>
             </div>
             <div className="space-y-6">
               <h2 className="text-4xl font-black text-slate-950 uppercase tracking-tighter italic">Sincronizando Binder</h2>
               <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] leading-relaxed max-w-md">
                 Materializando Cache Local... <br/>
                 <span className="text-blue-500">Aguarde o processamento final.</span>
               </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceControl;
