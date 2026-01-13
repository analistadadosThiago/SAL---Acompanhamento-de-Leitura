
import React, { useState } from 'react';
import { LayoutGrid, Search, Menu as MenuIcon, X, BarChart3, Database } from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#001529] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo Section - Professional Branding */}
          <div className="flex items-center gap-3 border-b border-white/10 px-6 py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/20">
               <Database size={24} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">SAL</span>
              <span className="text-[10px] font-medium text-blue-300 uppercase tracking-wider mt-1.5">
                Sistema de Análise de Leitura
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 space-y-2 p-4 mt-4">
            <button
              onClick={() => setActiveMenu(Menu.INICIO)}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-4 text-sm font-bold transition-all ${
                activeMenu === Menu.INICIO 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutGrid size={22} />
              Início
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONSULTA_TECNICA)}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-4 text-sm font-bold transition-all ${
                activeMenu === Menu.CONSULTA_TECNICA 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Search size={22} />
              Consulta Técnica
            </button>
          </nav>

          {/* Footer Info */}
          <div className="p-6 border-t border-white/10">
            <div className="flex items-center gap-3 text-slate-500">
               <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[10px] uppercase font-black tracking-widest">Base de Dados Conectada</span>
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
              <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                {activeMenu === Menu.INICIO ? 'Dashboard Analítico' : 'Consulta de Instalações'}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {activeMenu === Menu.INICIO ? 'Monitoramento de Desempenho e Impedimentos' : 'Busca Técnica e Histórico de Consumo'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800">Operador Técnico</p>
                <p className="text-[10px] font-medium text-slate-400 uppercase">Acesso Autorizado</p>
             </div>
             <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                <BarChart3 size={20} />
             </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 lg:p-12">
          <div className="mx-auto max-w-7xl">
            {activeMenu === Menu.INICIO ? <Dashboard /> : <TechnicalSearch />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
