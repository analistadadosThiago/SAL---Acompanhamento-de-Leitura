
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { TABLE_NAME, IMPEDIMENTO_CODES, MONTH_ORDER } from '../constants';
import { LeituraRecord, FilterState } from '../types';
import IndicatorCard from './IndicatorCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, XCircle, CheckCircle, AlertTriangle, Filter, Layout, RefreshCw, AlertCircle, Play, ChevronDown, Check } from 'lucide-react';

// Componente Local de Dropdown Multi-seleção
interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ label, options, selected, onToggle, placeholder }) => {
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

  return (
    <div className="flex flex-col w-full relative" ref={dropdownRef}>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
        {label}
        {selected.length > 0 && (
          <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">{selected.length}</span>
        )}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-xl text-sm transition-all ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
        } ${selected.length > 0 ? 'text-slate-900 font-medium' : 'text-slate-400'}`}
      >
        <span className="truncate">
          {selected.length > 0 ? selected.join(', ') : placeholder}
        </span>
        <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <div
                key={option}
                onClick={() => onToggle(option)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selected.includes(option) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-sm font-medium">{option}</span>
                {selected.includes(option) && <Check size={16} />}
              </div>
            ))}
            {options.length === 0 && (
              <div className="p-4 text-center text-slate-400 text-xs italic">Nenhuma opção disponível</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [data, setData] = useState<LeituraRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  
  const [availableFilters, setAvailableFilters] = useState<FilterState>({ 
    anos: [], 
    meses: [], 
    razoes: [] 
  });
  
  const [selectedFilters, setSelectedFilters] = useState({
    anos: [] as string[],
    meses: [] as string[],
    razoes: [] as string[]
  });

  // 1. Busca todos os valores distintos para os filtros dropdown
  useEffect(() => {
    const fetchFilterMetadata = async () => {
      try {
        setFetchingMetadata(true);
        // Seleciona colunas sem LIMIT para garantir 100% dos valores distintos
        const { data: records, error } = await supabase
          .from(TABLE_NAME)
          .select('Ano, Mes, rz');

        if (error) throw error;

        if (records) {
          const anos = Array.from(new Set(records.map(r => r.Ano?.toString())))
            .filter((a): a is string => Boolean(a))
            .sort((a, b) => b.localeCompare(a));

          const meses = Array.from(new Set(records.map(r => r.Mes)))
            .filter((m): m is string => Boolean(m))
            .sort((a, b) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0));

          const razoes = Array.from(new Set(records.map(r => r.rz)))
            .filter((rz): rz is string => Boolean(rz))
            .sort();

          setAvailableFilters({ anos, meses, razoes });
        }
      } catch (err: any) {
        console.error("Erro ao carregar metadados dos filtros:", err);
        setErrorMsg(err.message || "Falha ao carregar opções de filtros.");
      } finally {
        setFetchingMetadata(false);
      }
    };

    fetchFilterMetadata();
  }, []);

  // 2. Validação para o botão Gerar
  const canGenerate = useMemo(() => {
    return selectedFilters.anos.length > 0 && 
           selectedFilters.meses.length > 0 && 
           selectedFilters.razoes.length > 0;
  }, [selectedFilters]);

  // 3. Consulta integral após clique em Gerar
  const handleGenerateReport = async () => {
    if (!canGenerate) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setIsReportGenerated(false);

      // Consulta sem LIMIT, OFFSET ou paginação automática
      const { data: records, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .in('Ano', selectedFilters.anos)
        .in('Mes', selectedFilters.meses)
        .in('rz', selectedFilters.razoes);
      
      if (error) throw error;

      setData(records as LeituraRecord[] || []);
      setIsReportGenerated(true);
    } catch (err: any) {
      console.error("Erro ao buscar dados integrais:", err);
      setErrorMsg(err.message || 'Erro ao extrair registros do banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof selectedFilters, value: string) => {
    setIsReportGenerated(false); // Esconde resultados se filtros mudarem
    setSelectedFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  // Cálculos baseados nos dados carregados
  const metrics = useMemo(() => {
    if (!isReportGenerated) return null;
    const totalLeituras = data.length;
    const naoRealizadas = data.filter(r => IMPEDIMENTO_CODES.includes(String(r.nl))).length;
    const realizadas = totalLeituras - naoRealizadas;
    const percImpedimentos = realizadas > 0 ? (naoRealizadas / realizadas) * 100 : 0;

    return { totalLeituras, naoRealizadas, realizadas, percImpedimentos };
  }, [data, isReportGenerated]);

  const chartData = useMemo(() => {
    if (!isReportGenerated) return [];
    const timeMap: Record<string, any> = {};
    
    data.forEach(r => {
      const key = `${r.Mes} ${r.Ano}`;
      if (!timeMap[key]) {
        timeMap[key] = { label: key, totalImpedimentos: 0, sortKey: (r.Ano * 100) + (MONTH_ORDER[r.Mes] || 0) };
      }
      if (IMPEDIMENTO_CODES.includes(String(r.nl))) {
        timeMap[key].totalImpedimentos++;
      }
    });

    return Object.values(timeMap).sort((a, b) => a.sortKey - b.sortKey);
  }, [data, isReportGenerated]);

  const tipoGroups = useMemo(() => {
    if (!isReportGenerated) return [];
    const groups: Record<string, { tipo: string, total: number, nr: number, r: number, perc: number }> = {};
    data.forEach(r => {
      const t = r.tipo || 'OUTROS';
      if (!groups[t]) groups[t] = { tipo: t, total: 0, nr: 0, r: 0, perc: 0 };
      groups[t].total++;
      if (IMPEDIMENTO_CODES.includes(String(r.nl))) groups[t].nr++;
    });

    return Object.values(groups).map(g => {
      const r = g.total - g.nr;
      const perc = r > 0 ? (g.nr / r) * 100 : 0;
      return { ...g, r, perc };
    });
  }, [data, isReportGenerated]);

  if (fetchingMetadata) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 bg-white rounded-2xl border">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium">Extraindo parâmetros da base...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Filtros em formato de Dropdown */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-8 text-blue-900 font-bold border-b border-slate-50 pb-4">
          <Filter size={20} />
          <h2 className="text-lg">Painel de Configuração Analítica</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MultiSelectDropdown 
            label="Ano" 
            options={availableFilters.anos} 
            selected={selectedFilters.anos} 
            onToggle={(val) => handleToggle('anos', val)} 
            placeholder="Selecione os Anos"
          />
          <MultiSelectDropdown 
            label="Mês" 
            options={availableFilters.meses} 
            selected={selectedFilters.meses} 
            onToggle={(val) => handleToggle('meses', val)} 
            placeholder="Selecione os Meses"
          />
          <MultiSelectDropdown 
            label="Razão (rz)" 
            options={availableFilters.razoes} 
            selected={selectedFilters.razoes} 
            onToggle={(val) => handleToggle('razoes', val)} 
            placeholder="Selecione as Razões"
          />
        </div>

        <div className="flex flex-col items-center gap-4 pt-4">
          {!canGenerate && (
            <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-tight bg-amber-50 px-4 py-2 rounded-lg">
              <AlertCircle size={14} />
              Selecione Ano, Mês e Razão para gerar o relatório
            </div>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={!canGenerate || loading}
            className={`flex items-center gap-3 px-16 py-3.5 rounded-xl font-black text-lg transition-all shadow-xl shadow-blue-100 ${
              canGenerate && !loading
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border'
            }`}
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
            GERAR RELATÓRIO
          </button>
        </div>
      </section>

      {/* Área de Dados */}
      {!isReportGenerated && !loading && (
        <div className="flex flex-col items-center justify-center p-32 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
          <Layout size={64} className="mb-4 opacity-10" />
          <h3 className="text-lg font-bold text-slate-500 uppercase tracking-tighter">Aguardando Execução</h3>
          <p className="text-sm mt-1">Defina os filtros acima e clique em Gerar.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center p-32 bg-white rounded-2xl shadow-sm border">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-50 border-t-blue-600 mb-6"></div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Consultando Base de Dados</h3>
          <p className="text-slate-500 mt-2 font-medium italic">Processando 100% dos registros do Supabase...</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-8 text-center bg-white rounded-2xl border border-red-100">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-slate-700 font-bold mb-4">{errorMsg}</p>
          <button onClick={handleGenerateReport} className="text-blue-600 font-bold hover:underline">Tentar novamente</button>
        </div>
      )}

      {isReportGenerated && !loading && metrics && (
        <div className="animate-in fade-in zoom-in-95 duration-700 space-y-8">
          {/* Indicadores Principais */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <IndicatorCard label="Leituras a Realizar" value={metrics.totalLeituras.toLocaleString()} icon={<FileText />} color="blue" />
            <IndicatorCard label="Leituras Não Realizadas" value={metrics.naoRealizadas.toLocaleString()} icon={<XCircle />} color="red" />
            <IndicatorCard label="Leituras Realizadas" value={metrics.realizadas.toLocaleString()} icon={<CheckCircle />} color="green" />
            <IndicatorCard label="% Impedimentos" value={metrics.percImpedimentos.toFixed(2)} suffix="%" icon={<AlertTriangle />} color="amber" />
          </section>

          {/* Gráfico Analítico */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-slate-800 font-black text-xl tracking-tighter uppercase">Impedimentos Mensais</h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contagem de impedimentos</span>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar name="Impedimentos" dataKey="totalImpedimentos" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Cards por Tipo */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-slate-800 font-black uppercase tracking-tighter border-l-4 border-blue-600 pl-4">
              <Layout size={20} />
              <h3>Análise Segmentada por Tipo</h3>
            </div>
            <div className="grid grid-cols-1 gap-6">
              {tipoGroups.map((group, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-lg">
                  <div className="flex items-center justify-between mb-8">
                    <span className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-black uppercase tracking-widest">{group.tipo}</span>
                    <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>{selectedFilters.anos.join(' / ')}</span>
                      <span>•</span>
                      <span>PROCESSADO</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 transition-colors hover:bg-white hover:border-blue-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Total Leituras</p>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter">{group.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 transition-colors hover:bg-white hover:border-red-100">
                      <p className="text-[10px] font-bold text-red-400 uppercase mb-2">Não Realizadas</p>
                      <p className="text-3xl font-black text-red-600 tracking-tighter">{group.nr.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 transition-colors hover:bg-white hover:border-green-100">
                      <p className="text-[10px] font-bold text-green-400 uppercase mb-2">Realizadas</p>
                      <p className="text-3xl font-black text-green-600 tracking-tighter">{group.r.toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-600 p-5 rounded-xl shadow-lg shadow-blue-100 text-white flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-blue-200 uppercase mb-2 opacity-80">% Impedimentos</p>
                      <p className="text-4xl font-black tracking-tighter">{group.perc.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
