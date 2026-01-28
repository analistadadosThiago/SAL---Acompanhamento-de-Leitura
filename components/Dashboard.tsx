import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { TABLE_NAME, IMPEDIMENTO_CODES, VIEW_ANOS, VIEW_MESES, VIEW_RAZOES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { 
  FileText, XCircle, CheckCircle, AlertTriangle, Filter, 
  Layout, RefreshCw, Zap, ChevronDown, Check, 
  Database, TrendingUp, Sparkles, Activity, BrainCircuit,
  Globe, Cpu, BarChart3, Info, Terminal
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const RPC_NAMES = {
  INDICADORES: 'rpc_indicadores_inicio',
  RELACAO_TIPO: 'rpc_relacao_por_tipo'
};

const safeGet = (val: any) => {
  if (!val) return 'N/A';
  if (typeof val === 'object') return val.nome || val.rz || val.matr || JSON.stringify(val);
  return String(val);
};

const DropdownFilter: React.FC<{
  label: string;
  options: string[];
  selected: string | string[] | null;
  onToggle: (value: string | null) => void;
  placeholder: string;
  multiple?: boolean;
}> = ({ label, options, selected, onToggle, placeholder, multiple = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSelected = (option: string | null) => {
    if (multiple && Array.isArray(selected)) return option !== null && selected.includes(option);
    return selected === option;
  };

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-5 py-4 bg-white border-2 rounded-2xl text-sm transition-all font-bold ${isOpen ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-sm' : 'border-slate-100 hover:border-indigo-200'}`}
      >
        <span className="truncate pr-4 text-left text-slate-700 uppercase tracking-tight">
          {multiple && Array.isArray(selected) 
            ? (selected.length > 0 ? `${selected.length} Selecionados` : placeholder)
            : (selected ? String(selected) : "Todos")}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-2 overflow-y-auto max-h-64 custom-scrollbar">
            {!multiple && (
              <div onClick={() => { onToggle(null); setIsOpen(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 ${selected === null ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs uppercase font-bold">Todos</span>
                {selected === null && <Check size={14} className="text-indigo-600" />}
              </div>
            )}
            {options.map((option) => (
              <div key={option} onClick={() => { onToggle(option); if (!multiple) setIsOpen(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 ${isSelected(option) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                <span className="text-xs uppercase font-bold">{option}</span>
                {isSelected(option) && <Check size={14} className="text-indigo-600" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [indicators, setIndicators] = useState<any>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [availableFilters, setAvailableFilters] = useState<FilterState>({ anos: [], meses: [], razoes: [] });
  const [selectedFilters, setSelectedFilters] = useState<{ano: string | null, mes: string | null, razoes: string[]}>({ 
    ano: '2024', 
    mes: null, 
    razoes: [] 
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      const [anoRes, mesRes, rzRes] = await Promise.all([
        supabase.from(VIEW_ANOS).select('Ano').order('Ano', { ascending: false }),
        supabase.from(VIEW_MESES).select('mes, ordem_mes').order('ordem_mes', { ascending: true }),
        supabase.from(VIEW_RAZOES).select('rz').order('rz', { ascending: true })
      ]);
      setAvailableFilters({
        anos: Array.from(new Set((anoRes.data || []).map(r => String(r.Ano)))),
        meses: Array.from(new Set((mesRes.data || []).map(r => String(r.mes)))),
        razoes: Array.from(new Set((rzRes.data || []).map(r => safeGet(r.rz))))
      });
    };
    fetchMetadata();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    setAiInsights(null);
    try {
      const p_ano = selectedFilters.ano ? Number(selectedFilters.ano) : null;
      const p_mes = selectedFilters.mes;
      const p_rz = selectedFilters.razoes.length > 0 ? selectedFilters.razoes[0] : null;

      const { data, error } = await supabase.rpc(RPC_NAMES.INDICADORES, { p_ano, p_mes, p_rz, p_matr: null });
      if (error) throw error;
      
      const resData = Array.isArray(data) ? data[0] : data;
      setIndicators(resData);
      
      let query = supabase.from(TABLE_NAME).select('matr').in('nl', IMPEDIMENTO_CODES);
      if (p_ano) query = query.eq('Ano', p_ano);
      if (p_mes) query = query.eq('Mes', p_mes);
      if (p_rz) query = query.eq('rz', p_rz);

      const { data: impData } = await query.limit(10000);
      const counts: Record<string, number> = {};
      (impData || []).forEach(i => { const k = safeGet(i.matr); counts[k] = (counts[k] || 0) + 1; });
      
      setGraphData(Object.entries(counts)
        .map(([name, total]) => ({ matricula: name, qtd: total }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 15));
        
      setIsReportGenerated(true);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiConsultancy = async () => {
    if (!indicators || loadingAi) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const eff = (((indicators.leituras_totais - indicators.leituras_nao_realizadas) / (indicators.leituras_totais || 1)) * 100).toFixed(2);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{
          role: 'user',
          parts: [{
            text: `
              Aja como um consultor sênior de utilities para o Sistema SAL (Sistema de Análise de Leitura). 
              Analise os seguintes indicadores operacionais do período selecionado:
              - Volume Total de Leituras: ${indicators.leituras_totais}
              - Leituras Não Realizadas (Impedimentos): ${indicators.leituras_nao_realizadas}
              - Eficiência Operacional: ${eff}%
              - Principais técnicos (Matrículas) com anomalias: ${JSON.stringify(graphData)}

              Sua consultoria estratégica deve abordar:
              1. Análise detalhada dos riscos operacionais e de faturamento.
              2. Avaliação da performance do time de campo baseada nas matrículas críticas.
              3. Plano de ação imediato para redução de perdas.
              
              Mantenha uma linguagem executiva, profissional e orientada a dados. Use parágrafos curtos. Responda em Português do Brasil.
            `
          }]
        }],
        config: {
          thinkingConfig: { thinkingBudget: 4000 }
        }
      });
      setAiInsights(response.text || "Análise indisponível no momento.");
    } catch (err) {
      console.error("AI Error:", err);
      setAiInsights("Falha ao processar análise neural. Verifique a conexão com o núcleo de inteligência.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
           <div className="flex items-center gap-3 text-indigo-600 mb-2">
              <Globe size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Network Intelligence Active</span>
           </div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">SAL Dashboard</h1>
           <p className="text-slate-400 font-medium mt-1">Sincronização estratégica de performance operacional</p>
        </div>
        <div className="px-6 py-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-sm group hover:border-indigo-200 transition-colors">
           <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Core v9.0 Sincronizado</span>
        </div>
      </div>

      <section className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-200 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20"><Filter size={22}/></div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic leading-none">Configuração de Dataset</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Parâmetros de Sincronização em Tempo Real</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <DropdownFilter label="Ano Fiscal" options={availableFilters.anos} selected={selectedFilters.ano} onToggle={v => setSelectedFilters(p => ({...p, ano: v}))} placeholder="Todos" />
          <DropdownFilter label="Mês Competência" options={availableFilters.meses} selected={selectedFilters.mes} onToggle={v => setSelectedFilters(p => ({...p, mes: v}))} placeholder="Todos" />
          <DropdownFilter label="Razão Social" options={availableFilters.razoes} selected={selectedFilters.razoes} onToggle={v => {
            if(!v) { setSelectedFilters(p => ({...p, razoes: []})); return; }
            setSelectedFilters(p => ({...p, razoes: p.razoes.includes(v) ? p.razoes.filter(i=>i!==v) : [...p.razoes, v]}));
          }} placeholder="Todas" multiple />
        </div>

        <div className="mt-12 flex justify-center">
          <button 
            onClick={handleGenerate} 
            disabled={loading}
            className="group relative px-24 py-5 bg-slate-950 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 overflow-hidden"
          >
            <div className="relative z-10 flex items-center gap-4">
              {loading ? <Activity className="animate-spin" size={20}/> : <Zap size={20} fill="currentColor" className="group-hover:text-amber-400 transition-colors"/>}
              ATUALIZAR MATRIZ
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
      </section>

      {isReportGenerated && indicators && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Leituras Totais" value={(indicators.leituras_totais || 0).toLocaleString()} icon={<FileText size={24}/>} color="blue" />
            <IndicatorCard label="Impedimentos" value={(indicators.leituras_nao_realizadas || 0).toLocaleString()} icon={<XCircle size={24}/>} color="red" />
            <IndicatorCard label="Leituras Realizadas" value={((indicators.leituras_totais || 0) - (indicators.leituras_nao_realizadas || 0)).toLocaleString()} icon={<CheckCircle size={24}/>} color="green" />
            <IndicatorCard label="Taxa de Ocorrência" value={(( (indicators.leituras_nao_realizadas || 0) / (indicators.leituras_totais || 1)) * 100).toFixed(2)} suffix="%" icon={<AlertTriangle size={24}/>} color="amber" />
          </div>

          <div className="bg-[#020617] p-12 rounded-[4rem] text-white shadow-2xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none rotate-12 group-hover:rotate-0 transition-transform duration-1000"><BrainCircuit size={280} /></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-5 bg-indigo-600 rounded-[2rem] shadow-2xl shadow-indigo-600/20 relative">
                    <Sparkles size={32} className="text-white" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-[#020617] animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">SAL Neural Insights</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                       <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest px-2 py-0.5 border border-indigo-400/30 rounded-full">Gemini 3 Pro Engine</span>
                       <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                       <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Consultoria Estratégica AI</span>
                    </div>
                  </div>
                </div>
                {aiInsights && (
                  <button onClick={handleAiConsultancy} disabled={loadingAi} className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 text-[10px] font-black uppercase tracking-widest active:scale-95">
                    <RefreshCw className={loadingAi ? 'animate-spin' : ''} size={16} />
                    Recalcular Insight
                  </button>
                )}
              </div>
              
              {aiInsights ? (
                <div className="p-10 bg-white/[0.03] backdrop-blur-3xl rounded-[3rem] border border-white/10 text-slate-300 text-lg leading-relaxed animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                  <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
                    <div className="p-2 bg-indigo-500/20 rounded-xl"><Cpu size={18} className="text-indigo-400" /></div>
                    <div>
                       <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">Relatório Estratégico Neural materializado</span>
                       <p className="text-[9px] text-slate-500 uppercase mt-0.5">Base de dados: Sincronização Atual</p>
                    </div>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    <p className="whitespace-pre-wrap font-medium text-slate-200">{aiInsights}</p>
                  </div>
                  <div className="mt-10 flex items-center gap-4 text-slate-500 text-[10px] font-bold uppercase italic border-t border-white/5 pt-6">
                     <Info size={14} />
                     Os dados acima são baseados em processamento probabilístico e devem ser validados pela gerência operacional.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-12 p-12 border-2 border-dashed border-white/10 rounded-[4rem] bg-white/[0.02]">
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                       <Terminal size={18} className="text-indigo-400" />
                       <h4 className="text-xl font-bold text-white uppercase tracking-tight">Análise Preditiva de Riscos</h4>
                    </div>
                    <p className="text-slate-400 text-base font-medium leading-relaxed">
                      Sincronize o núcleo de inteligência para identificar anomalias de faturamento, gargalos de performance técnica em campo e estimativas de perdas operacionais para o período selecionado.
                    </p>
                  </div>
                  <button 
                    onClick={handleAiConsultancy} 
                    disabled={loadingAi} 
                    className="w-full md:w-fit px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-indigo-600/30 group active:scale-95"
                  >
                    {loadingAi ? <RefreshCw className="animate-spin" size={18}/> : <>PROCESSAR INSIGHTS <Zap size={16} fill="currentColor" className="group-hover:scale-125 transition-transform"/></>}
                  </button>
                </div>
              )}
            </div>
          </div>

          <section className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-200 group transition-all duration-500 hover:shadow-xl">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                <div className="flex items-center gap-5">
                   <div className="p-4 bg-slate-50 text-indigo-600 rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform"><TrendingUp size={28} /></div>
                   <div>
                     <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Ranking de Performance Crítica</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Distribuição de Impedimentos por Matrícula Técnica</p>
                   </div>
                </div>
                <div className="px-5 py-2.5 bg-slate-100 rounded-full flex items-center gap-3">
                   <BarChart3 size={14} className="text-slate-400" />
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Top 15 Ocorrências</span>
                </div>
             </div>
             <div className="h-[450px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={graphData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                   <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="matricula" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                   <Tooltip 
                     cursor={{fill: '#f8fafc', radius: 16}} 
                     contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px' }}
                   />
                   <Bar dataKey="qtd" name="Total de Ocorrências" barSize={54} radius={[16, 16, 4, 4]}>
                     {graphData.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={index === 0 ? '#f43f5e' : '#4f46e5'} fillOpacity={1 - (index * 0.03)} />
                     ))}
                     <LabelList dataKey="qtd" position="top" style={{ fill: '#1e293b', fontSize: '12px', fontWeight: '900' }} offset={15} />
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </section>
        </div>
      )}

      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white border-2 border-dashed border-slate-200 rounded-[5rem] text-center animate-in fade-in duration-1000 transition-colors hover:border-indigo-100">
          <div className="relative mb-10">
             <div className="absolute inset-0 bg-indigo-50 rounded-full scale-150 blur-3xl opacity-50"></div>
             <div className="relative p-16 bg-white rounded-full shadow-xl border border-slate-50 text-slate-200">
                <Layout size={120} className="text-slate-100" />
             </div>
          </div>
          <h3 className="text-slate-900 font-black text-3xl mb-4 tracking-tighter uppercase italic">Aguardando Parâmetros de Core</h3>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] max-w-sm mx-auto">Configure os filtros operacionais acima para materializar o dashboard de monitoramento.</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl shadow-indigo-500/20 flex flex-col items-center gap-12 border border-slate-100 animate-in zoom-in-95 duration-500">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-indigo-600 animate-spin"></div>
                 <Database size={48} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
              </div>
              <div className="text-center">
                 <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Sincronizando Core v9.0</h2>
                 <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.4em] mt-4 animate-pulse">Acessando Camada de Dados Segura...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;