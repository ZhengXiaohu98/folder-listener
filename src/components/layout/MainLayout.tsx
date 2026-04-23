import React from 'react';
import { Sidebar, TabType } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function MainLayout({ children, activeTab, onTabChange }: MainLayoutProps) {
  return (
    <div className="relative flex w-screen h-screen overflow-hidden bg-back-100 text-primary font-sans transition-colors">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <main className="flex-1 h-full overflow-y-auto relative">
        <div className="p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
