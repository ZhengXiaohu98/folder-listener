import { LayoutDashboard, Settings, Info, PanelRight, ScrollText, X, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import packageJson from '../../../package.json';

export type TabType = 'Dashboard' | 'Settings' | 'Logs';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const navItems: { icon: LucideIcon; label: TabType }[] = [
    { icon: LayoutDashboard, label: 'Dashboard' },
    { icon: ScrollText, label: 'Logs' },
    { icon: Settings, label: 'Settings' },
  ];

  useEffect(() => {
    if (!isAboutOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAboutOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAboutOpen]);

  return (
    <>
      <aside className={cn("w-64 h-full bg-back-200 flex flex-col pt-8 pb-6 shrink-0 md:relative absolute z-10 left-0 top-0 transition duration-300", isSidebarOpen ? 'translate-x-0' : 'md:translate-x-0 -translate-x-full')}>
        <div>
          {/* toggle sidebar */}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="cursor-pointer md:hidden fixed right-3 top-3 z-20">
            <PanelRight className={cn('size-5 transition', isSidebarOpen && 'rotate-180')} />
          </button>
          {/* Brand */}
          <div className="flex items-center gap-1 mb-10 px-3">
            <img src="/logo.png" alt="logo" className="w-10 h-10 shrink-0" />
            <h1 className="font-semibold text-primary leading-tight transition-colors text-lg italic font-serif">Folder Listener</h1>
          </div>

          {/* Nav Menu */}
          <nav className="flex-1 flex flex-col gap-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => onTabChange(item.label)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 relative cursor-pointer",
                    isActive
                      ? "text-accent bg-accent/10"
                      : "text-secondary hover:text-primary hover:bg-back-300"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[95%] bg-accent rounded-r-full shadow-[0_0_8px_var(--accent)] opacity-80" />
                  )}
                  <Icon className={cn("w-4 h-4", isActive ? "text-accent" : "text-tertiary")} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        {/* Bottom Action */}
        <div className="px-3 mt-auto">
          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-secondary hover:text-primary hover:bg-back-300 transition-colors cursor-pointer"
          >
            <Info className="w-4 h-4" />
            About
          </button>
        </div>
      </aside>
      {/* overlay */}
      <button onClick={() => setIsSidebarOpen(true)} className={cn("cursor-pointer md:hidden fixed left-3 top-3 z-20 ", isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 transition duration-300 delay-300')}>
        <PanelRight className={cn('size-5 transition', isSidebarOpen && 'rotate-180')} />
      </button>
      {isAboutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black-100/45 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setIsAboutOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="relative w-full max-w-sm rounded-lg border border-bc-100 bg-back-100 p-6 text-primary shadow-soft"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close about dialog"
              onClick={() => setIsAboutOpen(false)}
              className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-back-300 hover:text-primary cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="min-w-0">
              <h2 id="about-title" className="text-lg font-semibold leading-tight">
                Folder Listener
              </h2>
              <p className="mt-1 text-sm text-secondary">Version {packageJson.version}</p>
            </div>

            <div className="mt-6 rounded-md border border-bc-100 bg-back-200 p-4">
              <p className="text-xs font-medium uppercase text-tertiary">Developer</p>
              <a
                href="https://github.com/ZhengXiaohu98"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
              >
                <ExternalLink className="size-4" />
                Xiaohu Zheng
              </a>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
