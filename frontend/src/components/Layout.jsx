import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  FileCheck,
  UserCheck,
  Receipt,
  Package,
  CreditCard,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Stethoscope,
  BarChart3,
  FileText,
  ClipboardList,
  Eye,
  Pill
} from 'lucide-react';
import { cn } from '@/lib/utils';

const masterDataItems = [
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Providers', href: '/providers', icon: Building2 },
  { name: 'Insurers', href: '/insurers', icon: Shield },
];

const requestsItems = [
  { name: 'General Requests', href: '/general-requests', icon: ClipboardList },
  { name: 'Dental Form', href: '/dental-form', icon: Stethoscope },
  { name: 'Eyesight Form', href: '/eyesight-form', icon: Stethoscope },
];

const requestsAndClaimsItems = [
  { name: 'Standard Approvals', href: '/standard-approvals', icon: FileText },
  { name: 'Dental Approvals', href: '/dental-approvals', icon: Stethoscope },
  { name: 'Eye Approvals', href: '/eye-approvals', icon: Eye },
];

const otherNavigation = [
  { name: 'Authorizations', href: '/authorizations', icon: FileCheck },
  { name: 'Eligibility', href: '/eligibility', icon: UserCheck },
  { name: 'NPHIES Eligibility', href: '/nphies-eligibility', icon: Shield },
  { name: 'Claims', href: '/claims', icon: Receipt },
  { name: 'Claim Batches', href: '/claim-batches', icon: Package },
  { name: 'Payment Notification', href: '/payments', icon: CreditCard },
  { name: 'Response Viewer', href: '/response-viewer', icon: BarChart3 },
  { name: 'Medicine Search', href: '/medicines', icon: Pill },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState(true);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [requestsAndClaimsOpen, setRequestsAndClaimsOpen] = useState(true);
  const location = useLocation();

  const renderNavigationItem = (item, isActive, onClick) => (
    <Link
      key={item.name}
      to={item.href}
      className={cn(
        "group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ease-in-out transform",
        "before:absolute before:left-0 before:top-1/2 before:transform before:-translate-y-1/2 before:w-1 before:h-6 before:bg-transparent before:rounded-r-full before:transition-all before:duration-300",
        isActive
          ? "bg-gradient-to-r from-primary-purple to-accent-purple text-white before:bg-white scale-105"
          : "text-gray-600 hover:bg-gray-50 hover:text-primary-purple hover:scale-102 before:hover:bg-primary-purple"
      )}
      onClick={onClick}
    >
      <item.icon
        className={cn(
          "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
          isActive
          ? "text-white"
          : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
        )}
      />
      <span className="font-semibold tracking-wide">{item.name}</span>
    </Link>
  );

  const renderMasterDataSection = (isMobile = false) => {
    const isMasterDataActive = masterDataItems.some(item => location.pathname === item.href);

    return (
      <div className="mb-6">
        <button
          onClick={() => setMasterDataOpen(!masterDataOpen)}
          className={cn(
            "group flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
            "border-l-4 border-transparent",
            isMasterDataActive
              ? "bg-gradient-to-r from-primary-purple/10 to-primary-purple/5 text-primary-purple border-l-primary-purple"
              : "text-gray-700 hover:bg-gray-50 hover:text-primary-purple hover:border-l-primary-purple/50"
          )}
        >
          <Database
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
              isMasterDataActive
                ? "text-primary-purple"
                : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
            )}
          />
          <span className="tracking-wide">Master Data</span>
            <div className={cn(
            "ml-auto transition-transform duration-300",
            masterDataOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-purple" />
          </div>
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          masterDataOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4">
            {masterDataItems.map((item) => {
              const isActive = location.pathname === item.href;
              return renderNavigationItem(
                item,
                isActive,
                isMobile ? () => setSidebarOpen(false) : undefined
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderRequestsSection = (isMobile = false) => {
    const isRequestsActive = requestsItems.some(item => location.pathname === item.href);

    return (
      <div className="mb-6">
        <button
          onClick={() => setRequestsOpen(!requestsOpen)}
          className={cn(
            "group flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
            "border-l-4 border-transparent",
            isRequestsActive
              ? "bg-gradient-to-r from-primary-purple/10 to-primary-purple/5 text-primary-purple border-l-primary-purple"
              : "text-gray-700 hover:bg-gray-50 hover:text-primary-purple hover:border-l-primary-purple/50"
          )}
        >
          <Stethoscope
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
              isRequestsActive
                ? "text-primary-purple"
                : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
            )}
          />
          <span className="tracking-wide">Requests</span>
            <div className={cn(
            "ml-auto transition-transform duration-300",
            requestsOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-purple" />
          </div>
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          requestsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4">
            {requestsItems.map((item) => {
              const isActive = location.pathname === item.href;
              return renderNavigationItem(
                item,
                isActive,
                isMobile ? () => setSidebarOpen(false) : undefined
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderRequestsAndClaimsSection = (isMobile = false) => {
    const isRequestsAndClaimsActive = requestsAndClaimsItems.some(item => location.pathname === item.href || location.pathname.startsWith(item.href));

    return (
      <div className="mb-6">
        <button
          onClick={() => setRequestsAndClaimsOpen(!requestsAndClaimsOpen)}
          className={cn(
            "group flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
            "border-l-4 border-transparent",
            isRequestsAndClaimsActive
              ? "bg-gradient-to-r from-primary-purple/10 to-primary-purple/5 text-primary-purple border-l-primary-purple"
              : "text-gray-700 hover:bg-gray-50 hover:text-primary-purple hover:border-l-primary-purple/50"
          )}
        >
          <ClipboardList
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
              isRequestsAndClaimsActive
                ? "text-primary-purple"
                : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
            )}
          />
          <span className="tracking-wide">Requests & Claims</span>
            <div className={cn(
            "ml-auto transition-transform duration-300",
            requestsAndClaimsOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-purple" />
          </div>
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          requestsAndClaimsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4">
            {requestsAndClaimsItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              return renderNavigationItem(
                item,
                isActive,
                isMobile ? () => setSidebarOpen(false) : undefined
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 relative overflow-hidden">
      {/* Mobile sidebar overlay */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden transition-all duration-300",
        sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 bg-black transition-opacity duration-300",
            sidebarOpen ? "bg-opacity-50" : "bg-opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <div className={cn(
          "fixed inset-y-0 left-0 w-80 transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-full flex-col bg-white border-r border-gray-200">
            {/* Header */}
            <div className="flex-shrink-0 flex h-20 items-center justify-between px-6 border-b border-gray-100 bg-gradient-to-r from-primary-purple to-accent-purple">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <img src="/logo.svg" alt="Xacta Solutions" className="h-10 w-auto object-contain" />
                </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="px-4 space-y-2 pb-6">
            {/* Dashboard */}
            <Link
              to="/"
              className={cn(
                    "group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 transform",
                    "before:absolute before:left-0 before:top-1/2 before:transform before:-translate-y-1/2 before:w-1 before:h-6 before:bg-transparent before:rounded-r-full before:transition-all before:duration-300",
                location.pathname === "/"
                      ? "bg-gradient-to-r from-primary-purple to-accent-purple text-white before:bg-white scale-105"
                      : "text-gray-600 hover:bg-gray-50 hover:text-primary-purple hover:scale-102 before:hover:bg-primary-purple"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <LayoutDashboard
                className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
                      location.pathname === "/"
                        ? "text-white"
                        : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
                    )}
                  />
                  <span className="font-semibold tracking-wide">Dashboard</span>
            </Link>

            {/* Master Data Section */}
            {renderMasterDataSection(true)}

            {/* Requests Section */}
            {renderRequestsSection(true)}

            {/* Requests and Claims Section */}
            {renderRequestsAndClaimsSection(true)}

            {/* Other Navigation Items */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="px-4 mb-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operations</h3>
                  </div>
            {otherNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return renderNavigationItem(
                item, 
                isActive, 
                () => setSidebarOpen(false)
              );
            })}
                </div>
              </div>
          </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col">
        <div className="flex flex-col h-full bg-white border-r border-gray-200/50">
          {/* Header */}
          <div className="flex-shrink-0 flex h-24 items-center px-6 border-b border-gray-100 bg-gradient-to-r from-primary-purple to-accent-purple">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img src="/logo.svg" alt="Xacta Solutions" className="h-18 w-auto object-contain" />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="px-4 space-y-2">
            {/* Dashboard */}
            <Link
              to="/"
              className={cn(
                  "group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 transform",
                  "before:absolute before:left-0 before:top-1/2 before:transform before:-translate-y-1/2 before:w-1 before:h-6 before:bg-transparent before:rounded-r-full before:transition-all before:duration-300",
                location.pathname === "/"
                    ? "bg-gradient-to-r from-primary-purple to-accent-purple text-white before:bg-white scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-primary-purple hover:scale-102 before:hover:bg-primary-purple"
              )}
            >
              <LayoutDashboard
                className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
                    location.pathname === "/"
                      ? "text-white"
                      : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
                  )}
                />
                <span className="font-semibold tracking-wide">Dashboard</span>
            </Link>

            {/* Master Data Section */}
            {renderMasterDataSection(false)}

            {/* Requests Section */}
            {renderRequestsSection(false)}

            {/* Requests and Claims Section */}
            {renderRequestsAndClaimsSection(false)}

            {/* Other Navigation Items */}
              <div className="pt-4 border-t border-gray-100">
                <div className="px-4 mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operations</h3>
                </div>
            {otherNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return renderNavigationItem(item, isActive);
            })}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-80">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 border-b border-gray-200/50">
          <div className="flex h-20 items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                className="lg:hidden text-gray-600 hover:text-primary-purple hover:bg-gray-100 p-2 rounded-lg transition-all duration-200"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-wide">
                    {[...masterDataItems, ...requestsItems, ...requestsAndClaimsItems, ...otherNavigation].find(item => item.href === location.pathname || location.pathname.startsWith(item.href + '/'))?.name || 'Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">Xacta Solutions</p>
                </div>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span className="font-medium">System Online</span>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200"></div>
              <div className="bg-white rounded-lg p-2 border border-gray-100">
                <Stethoscope className="h-5 w-5 text-primary-purple" />
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 relative z-10">
          <div className="py-8">
            <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden p-4">
              {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
