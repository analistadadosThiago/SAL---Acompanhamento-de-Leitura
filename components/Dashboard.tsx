
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { TABLE_NAME, IMPEDIMENTO_CODES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { 
  FileText, XCircle, CheckCircle, AlertTriangle, Filter, 
  Layout, RefreshCw, Zap, ChevronDown, Check, 
  Database, TrendingUp, Sparkles, Activity, BrainCircuit 
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const VIEW_ANOS = "v_anos";
const VIEW_MESES = "v_meses";
const VIEW_RAZOES = "v_razoes";

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
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">{label}</label>
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
    ano: null, 
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

      const { data: impData } = await query.limit(5000);
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const eff = (((indicators.leituras_totais - indicators.leituras_nao_realizadas) / (indicators.leituras_totais || 1)) * 100).toFixed(2);
      const prompt = `Analise os seguintes indicadores do SAL v9: Total de Leituras: ${indicators.leituras_totais}, Impedimentos: ${indicators.leituras_nao_realizadas}, Eficiência: ${eff}%. Identifique riscos de faturamento e proponha 3 ações de correção de campo em formato de tópicos executivos profissionais. Use um tom de consultor sênior de utilities.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
      });
      setAiInsights(response.text || "Análise finalizada sem texto de retorno.");
    } catch (err) {
      setAiInsights("Sistema de IA indisponível no momento.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-500/20"><Filter size={22}/></div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase leading-none">Configuração de Parâmetros</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Sincronização Estratégica v9.0</p>
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
            className="group relative px-20 py-5 bg-slate-950 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-white/10 to-indigo-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <div className="relative flex items-center gap-4">
              {loading ? <Activity className="animate-spin" size={20}/> : <Zap size={20} fill="currentColor"/>}
              SINCRONIZAR DASHBOARD
            </div>
          </button>
        </div>
      </section>

      {isReportGenerated && indicators && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <IndicatorCard label="Leituras a Realizar" value={(indicators.leituras_totais || 0).toLocaleString()} icon={<FileText size={24}/>} color="blue" />
            <IndicatorCard label="Não Realizadas" value={(indicators.leituras_nao_realizadas || 0).toLocaleString()} icon={<XCircle size={24}/>} color="red" />
            <IndicatorCard label="Leituras Realizadas" value={((indicators.leituras_totais || 0) - (indicators.leituras_nao_realizadas || 0)).toLocaleString()} icon={<CheckCircle size={24}/>} color="green" />
            <IndicatorCard label="Indicador" value={(( (indicators.leituras_nao_realizadas || 0) / (indicators.leituras_totais || 1)) * 100).toFixed(2).replace('.',',')} suffix="%" icon={<AlertTriangle size={24}/>} color="amber" />
          </div>

          <div className="bg-[#0f172a] p-12 rounded-[4rem] text-white shadow-2xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none rotate-12 transition-transform group-hover:scale-110"><BrainCircuit size={200} /></div>
            <div className="relative z-10">
              <div className="flex items-center gap-5 mb-10">
                <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-600/30"><Sparkles size={30} className="text-white" /></div>
              </div>
              
              {aiInsights ? (
                <div className="p-10 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 text-slate-300 text-lg leading-relaxed animate-in fade-in duration-700">
                  <p className="whitespace-pre-wrap">{aiInsights}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  <p className="text-slate-400 text-base max-w-2xl font-medium">O núcleo de análise neural está pronto para processar o lote atual e identificar inconsistências de faturamento, padrões de impedimento regionais e riscos técnicos.</p>
                  <button onClick={handleAiConsultancy} disabled={loadingAi} className="w-fit px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-500 shadow-2xl shadow-indigo-600/40 transition-all flex items-center gap-4">
                    {loadingAi ? <RefreshCw className="animate-spin" size={18}/> : <>INICIAR CONSULTORIA IA <Zap size={16} fill="currentColor"/></>}
                  </button>
                </div>
              )}
            </div>
          </div>

          <section className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-4">
                <TrendingUp size={26} className="text-indigo-600" />
                Performance por Leiturista
              </h3>
              <span className="text-[10px] font-black bg-slate-100 px-5 py-2.5 rounded-full uppercase text-slate-500 tracking-widest">Top Ocorrências do Período</span>
            </div>
            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="matricula" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: '900'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '20px' }} />
                  <Bar dataKey="qtd" name="Ocorrências" barSize={50} radius={[15, 15, 0, 0]}>
                    {graphData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#f43f5e' : '#4f46e5'} fillOpacity={1 - (index * 0.04)} />
                    ))}
                    <LabelList dataKey="qtd" position="top" style={{ fill: '#1e293b', fontSize: '12px', fontWeight: '900' }} offset={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-40 bg-white border-2 border-dashed border-slate-200 rounded-[4rem] text-center animate-pulse">
          <div className="p-12 bg-slate-50 rounded-full mb-8 text-slate-200"><Layout size={100} /></div>
          <h3 className="text-slate-900 font-black text-3xl mb-4 tracking-tighter uppercase italic">Fluxo de Dados Pendente</h3>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.5em] px-20 max-w-lg">O núcleo de processamento aguarda a seleção de parâmetros operacionais para materializar a visão estratégica.</p>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-500">
           <div className="bg-white p-24 rounded-[5rem] shadow-2xl flex flex-col items-center gap-10 border border-slate-100">
              <div className="relative h-32 w-32">
                 <div className="absolute inset-0 rounded-full border-[10px] border-slate-50 border-t-indigo-600 animate-spin"></div>
                 <Database size={44} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Análise de Matriz Neural</h2>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.5em] mt-4 animate-pulse">Materializando Dataset SAL v9.0...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
