
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { TABLE_NAME } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, Play, ChevronDown, Check, Database, TrendingUp, AlertCircle } from 'lucide-react';

const VIEW_ANOS = "v_anos";
const VIEW_MESES = "v_meses";
const VIEW_RAZOES = "v_razoes";

const RPC_NAMES = {
  INDICADORES: 'rpc_indicadores_inicio',
  RELACAO_TIPO: 'rpc_relacao_por_tipo',
  IMPEDIMENTOS_MATR: 'rpc_impedimentos_por_matricula'
};

interface DropdownFilterProps {
  label: string;
  options: string[];
  selected: string | string[] | null;
  onToggle: (value: string) => void;
  placeholder: string;
  multiple?: boolean;
}

const DropdownFilter: React.FC<DropdownFilterProps> = ({ label, options, selected, onToggle, placeholder, multiple = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSelected = (option: string) => {
    if (multiple && Array.isArray(selected)) {
      return selected.includes(option);
    }
    return selected === option;
  };

  const getSummary = () => {
    if (multiple && Array.isArray(selected)) {
      return selected.length > 0 ? `${selected.length} selecionados` : placeholder;
    }
    return selected ? String(selected) : placeholder;
  };

  const getSelectedText = () => {
    if (multiple && Array.isArray(selected)) {
      return selected.length > 0 ? selected.join(', ') : 'Todos';
    }
    return selected ? String(selected) : 'Todos';
  };

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <div className="mb-2 flex flex-col gap-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
          {label}
        </label>
        <div className="text-[10px] font-medium text-blue-600 bg-blue-50/50 px-2 py-1.5 rounded border border-blue-100/50 truncate min-h-[28px] flex items-center">
          <span className="text-slate-400 font-bold mr-1 uppercase">Selecionado:</span>
          <span className="truncate">{getSelectedText()}</span>
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-4 py-3 bg-white border rounded-xl text-sm transition-all ${
          isOpen ? 'border-blue-600 ring-2 ring-blue-50' : 'border-slate-200 hover:border-blue-400'
        }`}
      >
        <span className="truncate pr-4 text-left font-medium">
          {getSummary()}
        </span>
        <ChevronDown size={16} className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 overflow-y-auto max-h-64">
            {multiple && (
              <div 
                onClick={() => {
                  if (Array.isArray(selected) && selected.length === options.length) {
                    options.forEach(o => onToggle(o));
                  } else {
                    const toToggle = Array.isArray(selected) 
                      ? options.filter(o => !selected.includes(o))
                      : options;
                    toToggle.forEach(o => onToggle(o));
                  }
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 text-blue-600 font-bold text-[10px] uppercase mb-1"
              >
                {Array.isArray(selected) && selected.length === options.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </div>
            )}
            {options.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onToggle(option);
                  if (!multiple) setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all mb-0.5 ${
                  isSelected(option) 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-xs">{option}</span>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  isSelected(option) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-slate-50'
                }`}>
                  {isSelected(option) && <Check size={10} strokeWidth={4} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface IndicatorsData {
  leituras_a_realizar: number;
  leituras_nao_realizadas: number;
  leituras_realizadas: number;
  percentual_impedimentos: number;
}

const Dashboard: React.FC = () => {
  const [indicators, setIndicators] = useState<IndicatorsData | null>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [cardsData, setCardsData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  
  const [availableFilters, setAvailableFilters] = useState<FilterState & { matriculas: string[] }>({ 
    anos: [], meses: [], razoes: [], matriculas: [] 
  });
  
  const [selectedFilters, setSelectedFilters] = useState({
    ano: null as string | null,
    mes: null as string | null,
    razoes: [] as string[],
    matricula: null as string | null
  });

  // INITIAL METADATA FETCH
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setFetchingMetadata(true);
        setErrorMsg(null);
        
        const [anoRes, mesRes, rzRes] = await Promise.all([
          supabase.from(VIEW_ANOS).select('Ano').order('Ano', { ascending: true }),
          supabase.from(VIEW_MESES).select('mes, ordem_mes').order('ordem_mes', { ascending: true }),
          supabase.from(VIEW_RAZOES).select('rz').order('rz', { ascending: true })
        ]);

        setAvailableFilters(prev => ({
          ...prev,
          anos: Array.from(new Set((anoRes.data || []).map(r => String(r.Ano)))),
          meses: Array.from(new Set((mesRes.data || []).map(r => String(r.mes)))),
          razoes: Array.from(new Set((rzRes.data || []).map(r => String(r.rz))))
        }));
      } catch (err: any) {
        setErrorMsg("Erro ao sincronizar metadados iniciais.");
      } finally {
        setFetchingMetadata(false);
      }
    };
    fetchMetadata();
  }, []);

  // DYNAMIC MATRICULA FETCH
  useEffect(() => {
    const fetchMatriculas = async () => {
      try {
        const p_ano = selectedFilters.ano ? Number(selectedFilters.ano) : null;
        const p_mes = selectedFilters.mes;
        const p_rz = selectedFilters.razoes.length > 0 ? selectedFilters.razoes[0] : null;

        let query = supabase.from(TABLE_NAME).select('matr');
        
        if (p_ano) query = query.eq('Ano', p_ano);
        if (p_mes) query = query.eq('Mes', p_mes);
        if (p_rz) query = query.eq('rz', p_rz);

        const { data, error } = await query.not('matr', 'is', null).order('matr', { ascending: true });
        
        if (!error) {
          const uniqueMatr = Array.from(new Set((data || []).map(r => String(r.matr))));
          setAvailableFilters(prev => ({ ...prev, matriculas: uniqueMatr }));
        }
      } catch (err) {
        console.error("Erro ao carregar matrículas:", err);
      }
    };

    fetchMatriculas();
  }, [selectedFilters.ano, selectedFilters.mes, selectedFilters.razoes]);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setIsReportGenerated(false);

      // MANDATORY: SCALAR ONLY FOR RPCS
      const p_ano = selectedFilters.ano ? Number(selectedFilters.ano) : null;
      const p_mes = selectedFilters.mes;
      const p_rz = selectedFilters.razoes.length > 0 ? selectedFilters.razoes[0] : null;
      const p_matr = selectedFilters.matricula;

      const [indRes, tipoRes, matrRes] = await Promise.all([
        supabase.rpc(RPC_NAMES.INDICADORES, { p_ano, p_mes, p_rz, p_matr }),
        supabase.rpc(RPC_NAMES.RELACAO_TIPO, { p_ano, p_mes, p_rz, p_matr }),
        supabase.rpc(RPC_NAMES.IMPEDIMENTOS_MATR, { p_ano, p_mes, p_rz, p_matr })
      ]);

      if (indRes.error) throw new Error(`[Indicadores] ${indRes.error.message}`);
      if (tipoRes.error) throw new Error(`[Relação Tipo] ${tipoRes.error.message}`);
      if (matrRes.error) throw new Error(`[Impedimentos Matrícula] ${matrRes.error.message}`);

      setIndicators(Array.isArray(indRes.data) ? indRes.data[0] : indRes.data);
      setCardsData(tipoRes.data || []);
      
      const formattedMatrData = (matrRes.data || []).map((item: any) => ({
        matr: String(item.matr),
        percentual: Number(item.percentual_impedimentos || item.percentual || 0),
        qtd_impedimentos: Number(item.leituras_nao_realizadas || item.qtd || 0)
      })).sort((a: any, b: any) => b.percentual - a.percentual);

      setGraphData(formattedMatrData);
      setIsReportGenerated(true);
    } catch (err: any) {
      console.error("RPC Fetching Error:", err);
      setErrorMsg(err.message || "Erro de conexão ao processar RPCs.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSingle = (key: 'ano' | 'mes' | 'matricula', value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? null : value
    }));
  };

  const handleToggleMulti = (key: 'razoes', value: string) => {
    setSelectedFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const tiposObrigatorios = ['Povoado', 'Rural', 'Urbano'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* SEÇÃO DE FILTROS GLOBAIS */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Filter size={18} /></div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Selecione Categoria</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DropdownFilter 
            label="Ano" 
            options={availableFilters.anos} 
            selected={selectedFilters.ano} 
            onToggle={(v) => handleToggleSingle('ano', v)} 
            placeholder="Filtrar por Ano" 
            multiple={false}
          />
          <DropdownFilter 
            label="Mês" 
            options={availableFilters.meses} 
            selected={selectedFilters.mes} 
            onToggle={(v) => handleToggleSingle('mes', v)} 
            placeholder="Filtrar por Mês" 
            multiple={false}
          />
          <DropdownFilter 
            label="Razão" 
            options={availableFilters.razoes} 
            selected={selectedFilters.razoes} 
            onToggle={(v) => handleToggleMulti('razoes', v)} 
            placeholder="Filtrar por Razão" 
            multiple={true}
          />
          <DropdownFilter 
            label="Matrícula" 
            options={availableFilters.matriculas} 
            selected={selectedFilters.matricula} 
            onToggle={(v) => handleToggleSingle('matricula', v)} 
            placeholder="Filtrar por Matrícula" 
            multiple={false}
          />
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className={`flex items-center gap-3 px-16 py-4 rounded-xl font-bold text-sm transition-all ${
                !loading ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02] shadow-xl shadow-blue-500/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <><Play size={16} fill="currentColor" /> GERAR RELATÓRIO</>}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
               <p className="text-red-800 text-xs font-black uppercase tracking-tight">Falha no Processamento</p>
               <p className="text-red-600 text-[10px] font-medium leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}
      </section>

      {/* DASHBOARD ANALÍTICO */}
      {isReportGenerated && indicators && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* CARDS INDICADORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard label="Leituras a Realizar" value={(indicators.leituras_a_realizar || 0).toLocaleString()} icon={<FileText size={20} />} color="blue" />
            <IndicatorCard label="Leituras Não Realizadas" value={(indicators.leituras_nao_realizadas || 0).toLocaleString()} icon={<XCircle size={20} />} color="red" />
            <IndicatorCard label="Leituras Realizadas" value={(indicators.leituras_realizadas || 0).toLocaleString()} icon={<CheckCircle size={20} />} color="green" />
            <IndicatorCard label="% Impedimentos" value={(indicators.percentual_impedimentos || 0).toFixed(2)} suffix="%" icon={<AlertTriangle size={20} />} color="amber" />
          </div>

          {/* GRÁFICO - RELAÇÃO DE IMPEDIMENTOS POR LEITURISTA */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Relação de Impedimentos por Leiturista
              </h3>
            </div>

            <div className="h-[500px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="matr" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} unit="%" />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }}
                    formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Taxa de Impedimento']}
                    labelFormatter={(label) => `Matrícula: ${label}`}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '30px' }} />
                  <Bar dataKey="percentual" name="Taxa de Impedimento (%)" fill="#2563eb" barSize={32} radius={[6, 6, 0, 0]}>
                    <LabelList 
                      dataKey="percentual" 
                      position="top" 
                      offset={10} 
                      style={{ fill: '#1e293b', fontSize: '9px', fontWeight: '900' }} 
                      formatter={(val: number) => `${val.toFixed(1)}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* RELAÇÃO POR TIPO (CARDS ATUALIZADOS) */}
          <div className="space-y-8 pt-6">
            <h3 className="text-center text-sm font-black text-slate-900 uppercase tracking-[0.6em]">
              Relação por Tipo:
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {tiposObrigatorios.map((tipoNome) => {
                const card = cardsData.find(c => String(c.tipo || c.tipo_leitura).trim().toLowerCase() === tipoNome.toLowerCase()) || {
                  tipo: tipoNome,
                  leituras_totais: 0,
                  leituras_nao_realizadas: 0,
                  leituras_realizadas: 0
                };
                
                return (
                  <div key={tipoNome} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Database size={80} />
                    </div>
                    
                    <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                      <span className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 transition-colors">
                        {tipoNome}
                      </span>
                      <Layout size={20} className="text-slate-300" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leituras Totais</p>
                        <p className="text-xl font-black text-slate-900">{(Number(card.leituras_totais) || 0).toLocaleString()}</p>
                      </div>
                      
                      <div className="flex justify-between items-center p-4 bg-red-50 border border-red-100">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Leituras Não Realizadas</p>
                        <p className="text-xl font-black text-red-600">{(Number(card.leituras_nao_realizadas) || 0).toLocaleString()}</p>
                      </div>
                      
                      <div className="flex justify-between items-center p-4 bg-green-50 border border-green-100">
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Leituras Realizadas</p>
                        <p className="text-xl font-black text-green-700">{(Number(card.leituras_realizadas) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ESTADO INICIAL */}
      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-48 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center mx-auto max-w-lg">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-sm">
            <Layout size={40} className="text-slate-200" />
          </div>
          <h3 className="text-slate-900 font-black text-xl mb-3 tracking-tight uppercase">SAL - Prontidão de Dados</h3>
          <p className="text-slate-400 font-medium text-xs uppercase tracking-[0.2em] leading-relaxed">
            Selecione a categoria e clique em <span className="text-blue-600 font-black">GERAR RELATÓRIO</span> para processar as informações.
          </p>
        </div>
      )}

      {/* OVERLAY DE CARREGAMENTO */}
      {loading && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-16 rounded-[50px] shadow-2xl flex flex-col items-center gap-8 text-center max-w-sm border border-white/20">
             <div className="relative h-28 w-28">
                <div className="absolute inset-0 rounded-full border-[8px] border-slate-50 border-t-blue-600 animate-spin"></div>
                <Database size={40} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
             </div>
             <div className="space-y-3">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sincronizando Banco</h2>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.3em]">Analisando Dataset Completo</p>
                  <p className="text-[9px] text-blue-500 font-black animate-pulse uppercase">Executando RPCs no Supabase...</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
