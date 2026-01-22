
import React, { useState } from 'react';
import { LayoutGrid, Search, Menu as MenuIcon, X, ShieldCheck, BarChart3, Activity, Users, Image as ImageIcon, Printer } from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';
import LeituristaControl from './components/LeituristaControl';
import EvidenceControl from './components/EvidenceControl';
import PrintControl from './components/PrintControl';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderContent = () => {
    switch(activeMenu) {
      case Menu.INICIO: return <Dashboard />;
      case Menu.CONSULTA_TECNICA: return <TechnicalSearch />;
      case Menu.CONTROLE_LEITURISTA: return <LeituristaControl />;
      case Menu.CONTROLE_EVIDENCIAS: return <EvidenceControl />;
      case Menu.CONTROLE_IMPRESSAO: return <PrintControl />;
      default: return <Dashboard />;
    }
  };

  const getMenuTitle = () => {
    switch(activeMenu) {
      case Menu.INICIO: return 'Dashboard Estratégico';
      case Menu.CONSULTA_TECNICA: return 'Consulta Operacional';
      case Menu.CONTROLE_LEITURISTA: return 'Controle de Produtividade';
      case Menu.CONTROLE_EVIDENCIAS: return 'Auditoria de Evidências';
      case Menu.CONTROLE_IMPRESSAO: return 'Controle de Impressão';
      default: return 'SAL';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] font-sans text-slate-900">
      {/* Sidebar Corporativa */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-[#000000] text-white shadow-2xl transition-all duration-500 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex items-center gap-5 border-b border-white/5 px-8 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-2xl shadow-blue-500/20 flex-shrink-0 border border-white/10">
               <BarChart3 size={28} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-white leading-none uppercase italic">SAL</span>
              <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-1.5 leading-tight">
                Sistema de Análise de Leitura
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 space-y-2 p-6 mt-6 overflow-y-auto">
            <button
              onClick={() => setActiveMenu(Menu.INICIO)}
              className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4.5 text-xs font-black uppercase tracking-widest transition-all ${
                activeMenu === Menu.INICIO 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutGrid size={18} />
              Início
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONSULTA_TECNICA)}
              className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4.5 text-xs font-black uppercase tracking-widest transition-all ${
                activeMenu === Menu.CONSULTA_TECNICA 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Search size={18} />
              Consulta
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONTROLE_LEITURISTA)}
              className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4.5 text-xs font-black uppercase tracking-widest transition-all ${
                activeMenu === Menu.CONTROLE_LEITURISTA 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Users size={18} />
              Controle de Leiturista
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONTROLE_EVIDENCIAS)}
              className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4.5 text-xs font-black uppercase tracking-widest transition-all ${
                activeMenu === Menu.CONTROLE_EVIDENCIAS 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ImageIcon size={18} />
              Controle de Evidências
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONTROLE_IMPRESSAO)}
              className={`flex w-full items-center gap-4 rounded-2xl px-6 py-4.5 text-xs font-black uppercase tracking-widest transition-all ${
                activeMenu === Menu.CONTROLE_IMPRESSAO 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Printer size={18} />
              Controle de Impressão
            </button>
          </nav>

          {/* Footer Active Connection */}
          <div className="p-8 border-t border-white/5">
            <div className="flex items-center gap-4 bg-white/5 p-5 rounded-2xl border border-white/5">
               <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse"></div>
               <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Database</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Online & Secure</span>
               </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Modern Header */}
        <header className="flex h-24 items-center justify-between border-b bg-white px-10 shadow-sm z-20">
          <div className="flex items-center gap-8">
            <button onClick={toggleSidebar} className="lg:hidden text-slate-600 p-2.5 hover:bg-slate-50 rounded-2xl transition-all">
              {isSidebarOpen ? <X size={26} /> : <MenuIcon size={26} />}
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                {getMenuTitle()}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                 <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                   Sistema de Análise de Leitura
                 </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
                <div className="flex items-center gap-2 justify-end mb-1">
                   <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Analista Master</p>
                   <ShieldCheck size={16} className="text-blue-600" />
                </div>
                <span className="bg-slate-100 text-[9px] font-black text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-200">
                  Full Access
                </span>
             </div>
          </div>
        </header>

        {/* Viewport Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/40 p-10 lg:p-14">
          <div className="mx-auto max-w-7xl">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
