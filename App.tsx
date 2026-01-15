
import React, { useState } from 'react';
import { LayoutGrid, Search, Menu as MenuIcon, X, BarChart3, Database, ShieldCheck, Activity, Users } from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';
import LeituristaControl from './components/LeituristaControl';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderContent = () => {
    switch(activeMenu) {
      case Menu.INICIO: return <Dashboard />;
      case Menu.CONSULTA_TECNICA: return <TechnicalSearch />;
      case Menu.CONTROLE_LEITURISTA: return <LeituristaControl />;
      default: return <Dashboard />;
    }
  };

  const getMenuTitle = () => {
    switch(activeMenu) {
      case Menu.INICIO: return 'Dashboard Analítico';
      case Menu.CONSULTA_TECNICA: return 'Consulta';
      case Menu.CONTROLE_LEITURISTA: return 'Controle de Leiturista';
      default: return 'SAL';
    }
  };

  const getMenuSubtitle = () => {
    switch(activeMenu) {
      case Menu.INICIO: return 'Monitoramento de Leituristas e Impedimentos';
      case Menu.CONSULTA_TECNICA: return 'Consulte aqui seus Dados';
      case Menu.CONTROLE_LEITURISTA: return 'Gestão de Performance e Ocorrências';
      default: return '';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar - Cor alterada para Preto #000000 conforme solicitação */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-[#000000] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex items-center gap-4 border-b border-white/10 px-6 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-xl shadow-blue-500/20 flex-shrink-0">
               <Activity size={28} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white leading-tight uppercase">SAL</span>
              <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider leading-tight">
                Sistema de Análise de Leitura
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 space-y-2 p-4 mt-6">
            <button
              onClick={() => setActiveMenu(Menu.INICIO)}
              className={`flex w-full items-center gap-4 rounded-xl px-5 py-4 text-sm font-semibold transition-all ${
                activeMenu === Menu.INICIO 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutGrid size={20} />
              Início
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONSULTA_TECNICA)}
              className={`flex w-full items-center gap-4 rounded-xl px-5 py-4 text-sm font-semibold transition-all ${
                activeMenu === Menu.CONSULTA_TECNICA 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Search size={20} />
              Consulta
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONTROLE_LEITURISTA)}
              className={`flex w-full items-center gap-4 rounded-xl px-5 py-4 text-sm font-semibold transition-all ${
                activeMenu === Menu.CONTROLE_LEITURISTA 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Users size={20} />
              Controle de Leiturista
            </button>
          </nav>

          {/* Footer Info */}
          <div className="p-6 border-t border-white/10">
            <div className="flex items-center gap-3 text-slate-500 bg-white/5 p-4 rounded-xl">
               <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
               <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Database Live</span>
                  <span className="text-[9px] text-slate-500">Supabase Professional</span>
               </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header Area */}
        <header className="flex h-20 items-center justify-between border-b bg-white px-8 shadow-sm z-10">
          <div className="flex items-center gap-6">
            <button onClick={toggleSidebar} className="lg:hidden text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
              {isSidebarOpen ? <X size={24} /> : <MenuIcon size={24} />}
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {getMenuTitle()}
              </h1>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                {getMenuSubtitle()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2 justify-end">
                   Analista
                   <ShieldCheck size={14} className="text-blue-600" />
                </p>
                <p className="text-[10px] font-medium text-slate-400 uppercase">Status: Online</p>
             </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-10">
          <div className="mx-auto max-w-7xl">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
