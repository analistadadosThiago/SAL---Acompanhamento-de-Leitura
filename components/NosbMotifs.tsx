
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RPC_CE_FILTRO_ANO, 
  RPC_CE_FILTRO_MES, 
  RPC_FILTRO_RAZAO_CI_UI, 
  RPC_FILTRO_MATRICULA_CI_UI,
  RPC_CE_IMPEDIMENTOS,
  RPC_CE_SIMULACAO_NOSB,
  MONTH_ORDER
} from '../constants';
import { 
  Filter, Play, RotateCcw, Printer, BarChart3, ChevronLeft, ChevronRight, 
  Table as TableIcon, LayoutDashboard, Database, Activity, FileText, 
  ShieldAlert, ScanLine, ListFilter, TrendingUp, Users, Target
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import IndicatorCard from './IndicatorCard';
import * as XLSX from 'xlsx';

enum SubMenu {
  IMPRESSAO = 'IMPRESSAO',
  SIMULACAO = 'SIMULACAO'
}

interface FilterData {
  anos: string[];
  meses: { label: string; value: string }[];
  razoes: { label: string; value: string }[];
  matriculas: { label: string; value: string }[];
}

const NosbMotifs: React.FC = () => {
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenu>(SubMenu.IMPRESSAO);

  // States for Impressão
  const [impFilters, setImpFilters] = useState({ ano: '', mes: '', rz: '', matr: '' });
  const [impOptions, setImpOptions] = useState<FilterData>({ anos: [], meses: [], razoes: [], matriculas: [] });
  const [impData, setImpData] = useState<any[]>([]);
  const [impLoading, setImpLoading] = useState(false);
  const [impOptionsLoading, setImpOptionsLoading] = useState(false);

  // States for Simulação
  const [simFilters, setSimFilters] = useState({ ano: '', mes: '', rz: '', matr: '', motivo: '', limit: 25, offset: 0 });
  const [simOptions, setSimOptions] = useState<FilterData>({ anos: [], meses: [], razoes: [], matriculas: [] });
  const [simData, setSimData] = useState<any[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simPage, setSimPage] = useState(1);

  const safeExtract = (item: any, key: string) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item[key] || item.rz || item.matr || item.razao || String(item);
  };

  // Base Options (Anos/Meses)
  useEffect(() => {
    const fetchBase = async () => {
      try {
        const [resAnos, resMeses] = await Promise.all([
          supabase.rpc(RPC_CE_FILTRO_ANO),
          supabase.rpc(RPC_CE_FILTRO_MES)
        ]);
        const anos = (resAnos.data || []).map((a: any) => String(a.ano || a)).sort((a, b) => Number(b) - Number(a));
        const meses = (resMeses.data || []).map((m: any) => String(m.mes || m).toUpperCase())
          .filter((m: string) => !!MONTH_ORDER[m])
          .sort((a: string, b: string) => (MONTH_ORDER[a] || 0) - (MONTH_ORDER[b] || 0))
          .map(m => ({ label: m, value: m }));
        
        setImpOptions(prev => ({ ...prev, anos, meses }));
        setSimOptions(prev => ({ ...prev, anos, meses }));
      } catch (err) { console.error("Error fetching base filters:", err); }
    };
    fetchBase();
  }, []);

  // Dynamic Options for Impressão (Dependent Filters)
  useEffect(() => {
    const fetchDynamic = async () => {
      if (!impFilters.ano || !impFilters.mes) {
        setImpOptions(prev => ({ ...prev, razoes: [], matriculas: [] }));
        return;
      }
      setImpOptionsLoading(true);
      try {
        const [resRz, resMatr] = await Promise.all([
          supabase.rpc(RPC_FILTRO_RAZAO_CI_UI, { p_ano: impFilters.ano, p_mes: impFilters.mes }),
          supabase.rpc(RPC_FILTRO_MATRICULA_CI_UI, { p_ano: impFilters.ano, p_mes: impFilters.mes })
        ]);
        const razoes = (resRz.data || []).map((i: any) => ({ label: safeExtract(i, 'rz'), value: safeExtract(i, 'rz') }));
        const matriculas = (resMatr.data || []).map((i: any) => ({ label: safeExtract(i, 'matr'), value: safeExtract(i, 'matr') }));
        setImpOptions(prev => ({ ...prev, razoes, matriculas }));
      } catch (err) { console.error("Error fetching dynamic filters:", err); }
      finally { setImpOptionsLoading(false); }
    };
    if (activeSubMenu === SubMenu.IMPRESSAO) fetchDynamic();
  }, [impFilters.ano, impFilters.mes, activeSubMenu]);

  // Dynamic Options for Simulação (Independent but synced)
  useEffect(() => {
    const fetchDynamicSim = async () => {
      if (!simFilters.ano && !simFilters.mes) return;
      try {
        const [resRz, resMatr] = await Promise.all([
          supabase.rpc(RPC_FILTRO_RAZAO_CI_UI, { p_ano: simFilters.ano || null, p_mes: simFilters.mes || null }),
          supabase.rpc(RPC_FILTRO_MATRICULA_CI_UI, { p_ano: simFilters.ano || null, p_mes: simFilters.mes || null })
        ]);
        const razoes = (resRz.data || []).map((i: any) => ({ label: safeExtract(i, 'rz'), value: safeExtract(i, 'rz') }));
        const matriculas = (resMatr.data || []).map((i: any) => ({ label: safeExtract(i, 'matr'), value: safeExtract(i, 'matr') }));
        setSimOptions(prev => ({ ...prev, razoes, matriculas }));
      } catch (err) { console.error("Error fetching dynamic filters sim:", err); }
    };
    if (activeSubMenu === SubMenu.SIMULACAO) fetchDynamicSim();
  }, [simFilters.ano, simFilters.mes, activeSubMenu]);

  const handleGerarImpressao = async () => {
    if (!impFilters.ano || !impFilters.mes) {
      alert("Selecione obrigatoriamente Ano e Mês.");
      return;
    }
    setImpLoading(true);
    try {
      const { data, error } = await supabase.rpc(RPC_CE_IMPEDIMENTOS, {
        p_ano: Number(impFilters.ano),
        p_mes: impFilters.mes,
        p_rz: impFilters.rz ? Number(impFilters.rz) : null,
        p_matr: impFilters.matr || null
      });
      if (error) throw error;
      setImpData(data || []);
    } catch (err) { alert("Erro ao carregar dados de impressão."); }
    finally { setImpLoading(false); }
  };

  const handleGerarSimulacao = async () => {
    setSimLoading(true);
    try {
      const { data, error } = await supabase.rpc(RPC_CE_SIMULACAO_NOSB, {
        p_ano: simFilters.ano || null,
        p_mes: simFilters.mes || null,
        p_rz: simFilters.rz || null,
        p_matr: simFilters.matr || null,
        p_motivo: simFilters.motivo || null,
        p_limit: simFilters.limit,
        p_offset: (simPage - 1) * simFilters.limit
      });
      if (error) throw error;
      setSimData(data || []);
    } catch (err) { alert("Erro ao carregar simulação."); }
    finally { setSimLoading(false); }
  };

  const metricsSim = useMemo(() => {
    if (simData.length === 0) return { total: 0, distinct: 0, topMotif: 'N/A' };
    const total = simData.length;
    const motifs: Record<string, number> = {};
    simData.forEach(d => {
      const m = d.motivo || d.nosb_impedimento || 'Outros';
      motifs[m] = (motifs[m] || 0) + 1;
    });
    const top = Object.entries(motifs).sort((a,b) => b[1]-a[1])[0];
    return { total, distinct: new Set(simData.map(d => d.instalacao)).size, topMotif: top ? top[0] : 'N/A' };
  }, [simData]);

  const chartDataSim = useMemo(() => {
    const map: Record<string, number> = {};
    simData.forEach(d => {
      const key = d.motivo || d.nosb_impedimento || 'N/A';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [simData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Selector de Submenu */}
      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <button 
          onClick={() => setActiveSubMenu(SubMenu.IMPRESSAO)}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeSubMenu === SubMenu.IMPRESSAO ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Printer size={18} /> NOSB Impressão
        </button>
        <button 
          onClick={() => setActiveSubMenu(SubMenu.SIMULACAO)}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeSubMenu === SubMenu.SIMULACAO ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <BarChart3 size={18} /> NOSB Simulação
        </button>
      </div>

      {activeSubMenu === SubMenu.IMPRESSAO ? (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
          {/* Filtros Impressão */}
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><ShieldAlert size={20}/></div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Parâmetros de Impressão</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano</label>
                <select value={impFilters.ano} onChange={e => setImpFilters({...impFilters, ano: e.target.value, rz: '', matr: ''})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold">
                  <option value="">Selecione...</option>
                  {impOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês</label>
                <select value={impFilters.mes} onChange={e => setImpFilters({...impFilters, mes: e.target.value, rz: '', matr: ''})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold">
                  <option value="">Selecione...</option>
                  {impOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão</label>
                <select disabled={!impFilters.ano || !impFilters.mes || impOptionsLoading} value={impFilters.rz} onChange={e => setImpFilters({...impFilters, rz: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold disabled:opacity-40">
                  <option value="">Todas</option>
                  {impOptions.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
                <select disabled={!impFilters.ano || !impFilters.mes || impOptionsLoading} value={impFilters.matr} onChange={e => setImpFilters({...impFilters, matr: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold disabled:opacity-40">
                  <option value="">Todas</option>
                  {impOptions.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-8 flex justify-center gap-4">
              <button onClick={handleGerarImpressao} disabled={impLoading || !impFilters.ano || !impFilters.mes} className="px-16 py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 flex items-center gap-3">
                {impLoading ? <Activity className="animate-spin" size={18}/> : <Play size={16} fill="currentColor"/>} GERAR RELATÓRIO
              </button>
              <button onClick={() => { setImpFilters({ano:'', mes:'', rz:'', matr:''}); setImpData([]); }} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200">
                <RotateCcw size={14}/> Limpar
              </button>
            </div>
          </section>

          {/* Tabela Impressão */}
          {impData.length > 0 && (
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2"><TableIcon size={18} className="text-blue-600"/> Dados de Auditoria NOSB</h3>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{impData.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 border-x border-slate-100">MES/ANO</th>
                      <th className="px-6 py-4 border-x border-slate-100">RAZÃO</th>
                      <th className="px-6 py-4 border-x border-slate-100">INSTALAÇÃO</th>
                      <th className="px-6 py-4 border-x border-slate-100">MEDIDOR</th>
                      <th className="px-6 py-4 border-x border-slate-100">MATR</th>
                      <th className="px-6 py-4 border-x border-slate-100">MOTIVO</th>
                      <th className="px-6 py-4 border-x border-slate-100 text-right">LEITURA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {impData.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 border-x border-slate-50 uppercase">{r.mes}/{r.ano}</td>
                        <td className="px-6 py-4 border-x border-slate-50 font-bold">{r.rz}</td>
                        <td className="px-6 py-4 border-x border-slate-50 font-mono text-blue-600">{r.instalacao}</td>
                        <td className="px-6 py-4 border-x border-slate-50">{r.medidor}</td>
                        <td className="px-6 py-4 border-x border-slate-50">{r.matr}</td>
                        <td className="px-6 py-4 border-x border-slate-50 italic text-slate-500">{r.motivo || r.nosb_impedimento}</td>
                        <td className="px-6 py-4 border-x border-slate-50 text-right font-black">{r.l_atual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Filtros Simulação */}
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-slate-900 text-white rounded-xl"><ScanLine size={20}/></div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Audit Simulator NOSB</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano</label>
                <select value={simFilters.ano} onChange={e => setSimFilters({...simFilters, ano: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold">
                  <option value="">Todos</option>
                  {simOptions.anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês</label>
                <select value={simFilters.mes} onChange={e => setSimFilters({...simFilters, mes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold">
                  <option value="">Todos</option>
                  {simOptions.meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão</label>
                <select value={simFilters.rz} onChange={e => setSimFilters({...simFilters, rz: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold">
                  <option value="">Todas</option>
                  {simOptions.razoes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
                <select value={simFilters.matr} onChange={e => setSimFilters({...simFilters, matr: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold">
                  <option value="">Todas</option>
                  {simOptions.matriculas.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo</label>
                <input type="text" placeholder="Buscar motivo..." value={simFilters.motivo} onChange={e => setSimFilters({...simFilters, motivo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold placeholder:text-slate-300"/>
              </div>
            </div>
            <div className="mt-8 flex justify-center gap-4">
              <button onClick={() => { setSimPage(1); handleGerarSimulacao(); }} disabled={simLoading} className="px-16 py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                {simLoading ? <Activity className="animate-spin" size={18}/> : <LayoutDashboard size={16}/>} GERAR SIMULAÇÃO
              </button>
            </div>
          </section>

          {/* Dash Simulação */}
          {simData.length > 0 && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <IndicatorCard label="Dataset Carregado" value={metricsSim.total.toLocaleString()} icon={<Database size={20}/>} color="blue" />
                <IndicatorCard label="Unidades Únicas" value={metricsSim.distinct.toLocaleString()} icon={<Target size={20}/>} color="green" />
                <IndicatorCard label="Motivo Crítico" value={metricsSim.topMotif} icon={<ShieldAlert size={20}/>} color="amber" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="text-xs font-black uppercase text-slate-900 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600"/> Top 10 Motivos</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataSim} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{borderRadius: '12px'}} />
                        <Bar dataKey="value" fill="#0f172a" radius={[0, 8, 8, 0]}>
                          {chartDataSim.map((_, i) => <Cell key={i} fillOpacity={1 - i*0.08} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2"><TableIcon size={18}/> Listagem Paginada</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase">
                        <tr>
                          <th className="px-6 py-4">RAZÃO</th>
                          <th className="px-6 py-4">INSTAL.</th>
                          <th className="px-6 py-4">MOTIVO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {simData.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-bold truncate max-w-[120px]">{r.rz}</td>
                            <td className="px-6 py-3 font-mono text-blue-600">{r.instalacao}</td>
                            <td className="px-6 py-3 italic">{r.motivo || r.nosb_impedimento}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t flex items-center justify-between">
                    <button onClick={() => { if(simPage > 1) { setSimPage(p=>p-1); handleGerarSimulacao(); } }} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={16}/></button>
                    <span className="text-[10px] font-black uppercase text-slate-400">Pág {simPage}</span>
                    <button onClick={() => { setSimPage(p=>p+1); handleGerarSimulacao(); }} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={16}/></button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {(impLoading || simLoading) && (
        <div className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 border border-slate-100">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-full border-[6px] border-slate-100 border-t-blue-600 animate-spin"></div>
              <Database size={24} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Processando Dados Reais...</h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default NosbMotifs;
