
import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Search, Menu as MenuIcon, X, ShieldCheck, 
  BarChart3, Users, Bell, Globe, Camera,
  UserCircle, ChevronDown, ChevronUp, ChevronRight,
  ShieldAlert, Settings, HelpCircle, Activity, 
  CheckCircle2, ClipboardCheck, TrendingUp, Printer
} from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';
import LeituristaControl from './components/LeituristaControl';
import EvidenceAuditControl from './components/EvidenceAuditControl';
import NosbPrintControl from './components/NosbPrintControl';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isControlsOpen, setIsControlsOpen] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (e: any) => {
      setScrolled(e.target.scrollTop > 20);
    };
    const viewport = document.getElementById('main-viewport');
    viewport?.addEventListener('scroll', handleScroll);
    return () => viewport?.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleControls = () => setIsControlsOpen(!isControlsOpen);

  const renderContent = () => {
    switch(activeMenu) {
      case Menu.INICIO: return <Dashboard />;
      case Menu.CONSULTA_TECNICA: return <TechnicalSearch />;
      case Menu.CONTROLE_LEITURISTA: return <LeituristaControl />;
      case Menu.CONTROLE_EVIDENCIAS: return <EvidenceAuditControl />;
      case Menu.NOSB_IMPRESSAO: return <NosbPrintControl />;
      default: return <Dashboard />;
    }
  };

  const getMenuTitle = () => {
    switch(activeMenu) {
      case Menu.INICIO: return 'Dashboard';
      case Menu.CONSULTA_TECNICA: return 'Pesquisa de Dados';
      case Menu.CONTROLE_LEITURISTA: return 'Controle de Leiturista';
      case Menu.CONTROLE_EVIDENCIAS: return 'Controle de Evidências';
      case Menu.NOSB_IMPRESSAO: return 'Nosb.Impressão';
      default: return 'SAL Enterprise';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#020617] text-white shadow-2xl transition-all duration-500 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Header Branding - Sidebar */}
          <div className="px-8 py-10 flex flex-col items-start">
            <div className="flex items-center gap-4 group cursor-pointer transition-all duration-300 hover:translate-x-1">
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-indigo-600 rounded-2xl rotate-12 group-hover:rotate-6 transition-transform duration-500 shadow-xl shadow-indigo-500/20"></div>
                <div className="absolute inset-0 bg-slate-950 rounded-2xl flex items-center justify-center border border-white/10">
                   <div className="relative">
                      <BarChart3 size={24} className="text-emerald-400 opacity-90" />
                      <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-md text-indigo-600 shadow-lg scale-75">
                        <Search size={10} strokeWidth={4} />
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex flex-col">
                <h1 className="text-4xl font-black tracking-tighter text-white leading-none">
                  SAL
                </h1>
                <div className="h-0.5 w-8 bg-emerald-500 mt-1 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
            </div>

            <div className="mt-4 pl-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight block">
                Sistema de Análise de Leitura
              </span>
            </div>
          </div>

          {/* Navigation - Sidebar */}
          <nav className="flex-1 space-y-1 px-6 mt-4 overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Menus Principais</p>
            
            {/* ITEM: DASHBOARD */}
            <button
              onClick={() => {
                setActiveMenu(Menu.INICIO);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeMenu === Menu.INICIO ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <LayoutGrid size={18} className={activeMenu === Menu.INICIO ? 'text-white' : 'text-slate-50'} />
              Dashboard
            </button>

            {/* ITEM: PESQUISA */}
            <button
              onClick={() => {
                setActiveMenu(Menu.CONSULTA_TECNICA);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeMenu === Menu.CONSULTA_TECNICA ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Search size={18} className={activeMenu === Menu.CONSULTA_TECNICA ? 'text-white' : 'text-slate-50'} />
              Pesquisa
            </button>

            <div className="mt-6 pt-4 border-t border-white/5">
              {/* GROUP: CONTROLES */}
              <button
                onClick={toggleControls}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-4">
                  <ShieldCheck size={18} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  <span>Controles</span>
                </div>
                {isControlsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* SUBMENUS */}
              <div className={`space-y-1 mt-1 overflow-hidden transition-all duration-300 ${isControlsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <button
                  onClick={() => {
                    setActiveMenu(Menu.CONTROLE_LEITURISTA);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ml-2 border-l-2 border-transparent hover:border-emerald-500/50 ${activeMenu === Menu.CONTROLE_LEITURISTA ? 'bg-white/10 text-emerald-400 border-l-emerald-500' : 'text-slate-400 hover:text-white'}`}
                >
                  <Users size={16} />
                  Leiturista
                </button>

                <button
                  onClick={() => {
                    setActiveMenu(Menu.CONTROLE_EVIDENCIAS);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ml-2 border-l-2 border-transparent hover:border-indigo-500/50 ${activeMenu === Menu.CONTROLE_EVIDENCIAS ? 'bg-white/10 text-indigo-400 border-l-indigo-500' : 'text-slate-400 hover:text-white'}`}
                >
                  <Camera size={16} />
                  Evidências
                </button>

                <button
                  onClick={() => {
                    setActiveMenu(Menu.NOSB_IMPRESSAO);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ml-2 border-l-2 border-transparent hover:border-blue-500/50 ${activeMenu === Menu.NOSB_IMPRESSAO ? 'bg-white/10 text-blue-400 border-l-blue-500' : 'text-slate-400 hover:text-white'}`}
                >
                  <Printer size={16} />
                  Nosb.Impressão
                </button>
              </div>
            </div>
          </nav>

          {/* Status Indicator - Bottom Sidebar */}
          <div className="p-6 border-t border-white/5 bg-[#020617]">
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Node: Active</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden relative">
        <header className={`flex h-20 items-center justify-between px-8 z-40 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b' : 'bg-transparent'}`}>
          <div className="flex items-center gap-6">
            <button onClick={toggleSidebar} className="lg:hidden text-slate-600 p-2.5 hover:bg-slate-100 rounded-xl transition-all">
              {isSidebarOpen ? <X size={24} /> : <MenuIcon size={24} />}
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                {getMenuTitle()}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                 <Globe size={10} className="text-indigo-500" />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monitoramento de Rede em Tempo Real</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
             <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all">
               <ShieldCheck size={14} /> SECURITY AUDIT: ON
             </button>
             <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all relative">
                <Bell size={20} />
                <span className="absolute top-3 right-3 h-2 w-2 bg-rose-500 rounded-full border-2 border-white"></span>
             </button>
             <div className="h-8 w-px bg-slate-200 mx-1"></div>
             <div className="flex items-center gap-3 pl-2 group cursor-pointer">
                <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-slate-200 transition-all group-hover:border-indigo-500 group-hover:scale-105 overflow-hidden">
                  <UserCircle size={24} className="text-slate-400" />
                </div>
             </div>
          </div>
        </header>

        <div id="main-viewport" className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar scroll-smooth">
          <div className="mx-auto max-w-7xl">{renderContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default App;
