
import React, { useState } from 'react';
import { LayoutGrid, Search, Menu as MenuIcon, X, BarChart3 } from 'lucide-react';
import { Menu } from './types';
import Dashboard from './components/Dashboard';
import TechnicalSearch from './components/TechnicalSearch';

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<Menu>(Menu.INICIO);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex items-center gap-3 border-b px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-200">
              <BarChart3 size={22} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-blue-900 leading-none">SAL</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                Sistema de Análise de Leitura
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            <button
              onClick={() => setActiveMenu(Menu.INICIO)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                activeMenu === Menu.INICIO 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
              }`}
            >
              <LayoutGrid size={20} />
              Início
            </button>
            <button
              onClick={() => setActiveMenu(Menu.CONSULTA_TECNICA)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                activeMenu === Menu.CONSULTA_TECNICA 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
              }`}
            >
              <Search size={20} />
              Consulta Técnica
            </button>
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <p className="text-center text-[10px] font-medium text-slate-400 uppercase tracking-widest">© 2024 SAL Monitoring</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="lg:hidden text-slate-600 p-1 hover:bg-slate-100 rounded-md transition-colors">
              {isSidebarOpen ? <X size={20} /> : <MenuIcon size={20} />}
            </button>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {activeMenu === Menu.INICIO ? 'Painel de Desempenho Analítico' : 'Consulta Técnica de Instalações'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-xs font-bold text-slate-800">Operador SAL</span>
                <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                   <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                   Online
                </span>
             </div>
             <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-black text-sm border-2 border-white shadow-sm">
                JD
             </div>
          </div>
        </header>

        {/* Dynamic View */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeMenu === Menu.INICIO ? <Dashboard /> : <TechnicalSearch />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
