import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  FileCheck,
  UserCheck,
  Receipt,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Stethoscope,
  ClipboardList,
  Eye,
  Pill,
  FileQuestion,
  ClipboardCheck,
  Send,
  ShieldCheck,
  BadgeCheck,
  Layers,
  BellRing,
  Scale,
  FileSearch,
  LogOut,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Custom Tooth icon component for dental items
const ToothIcon = ({ className }) => (
  <svg 
    className={className}
    viewBox="0 0 148.202 148.203" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M141.343,31.736c-2.917-12.577-11.417-21.793-24.606-26.677c-8.786-3.245-30.184-6.214-39.604,4.859 C46.763-8.078,30.749,1.725,19.98,13.292c-23.769,25.532-12.894,51.253-2.731,62.42c7.347,8.087,9.472,12.763,10.662,18.104 c0.268,1.175,0.874,4.646,0.904,5.389c1.878,44.476,17.043,48.287,20.669,48.555c1.057,0.305,2.098,0.444,3.105,0.444 c1.848,0,3.599-0.493,5.188-1.467c7.532-4.616,9.853-18.986,11.893-31.64c0.742-4.579,1.434-8.902,2.243-11.417 c1.403-4.354,2.563-5.347,2.552-5.498c1.011,0.45,2.716,3.708,2.904,4.992c0.28,1.918,0.481,4.402,0.706,7.186 c1.163,14.285,2.898,35.828,18.091,37.388c1.078,0.231,3.642,0.469,6.79-1.431c7.161-4.348,12.464-16.801,15.746-37.017 l0.493-3.233c1.182-8.104,2.819-19.211,9.512-26.25C136.441,71.742,145.775,50.859,141.343,31.736z M124.22,75.529 c-8.062,8.477-9.938,21.215-11.167,29.654l-0.475,3.13c-3.782,23.255-9.408,30.275-12.416,32.395 c-1.59,1.12-2.582,0.962-2.473,1.005l-0.706-0.141c-10.181-0.889-11.679-19.418-12.665-31.7c-0.244-2.947-0.457-5.571-0.749-7.599 c-0.299-2.047-3.197-9.853-8.525-10.297c-5.729-0.384-8.217,7.252-9.033,9.797c-0.956,2.978-1.659,7.307-2.469,12.337 c-1.559,9.633-3.909,24.198-9.006,27.328c-0.686,0.427-1.714,0.864-3.565,0.268l-0.941-0.146h-0.082 c-0.155,0-13.149-1.571-14.885-42.612c-0.061-1.431-0.815-5.468-1.041-6.491c-1.638-7.318-4.923-12.994-12.133-20.922 c-2.414-2.643-22.776-26.631,2.683-53.972C36.269,4.999,53.528-3.508,92.721,28.679c1.334,1.087,3.288,0.904,4.391-0.43 c1.096-1.333,0.901-3.285-0.427-4.39c-5.023-4.113-9.736-7.611-14.157-10.538c7.222-7.252,24.266-5.279,32.065-2.387 c11.296,4.177,18.256,11.651,20.697,22.229C139.011,49.293,131.259,68.143,124.22,75.529z"/>
  </svg>
);

const masterDataItems = [
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Providers', href: '/providers', icon: Building2 },
  { name: 'Insurers', href: '/insurers', icon: Shield },
];

// Admin-only items
const adminItems = [
  { name: 'Users', href: '/users', icon: Users },
];

// Merged Requests & Claims section
const requestsAndClaimsItems = [
  { name: 'General Requests', href: '/general-requests', icon: FileQuestion },
  { name: 'Dental Form', href: '/dental-form', icon: ToothIcon },
  { name: 'Eyesight Form', href: '/eyesight-form', icon: Eye },
  { name: 'Prior Authorizations', href: '/prior-authorizations', icon: ClipboardCheck },
  { name: 'Claim Submissions', href: '/claim-submissions', icon: Send },
  { name: 'Standard Approvals', href: '/standard-approvals', icon: FileCheck },
  { name: 'Dental Approvals', href: '/dental-approvals', icon: ToothIcon },
  { name: 'Eye Approvals', href: '/eye-approvals', icon: Eye },
];

// Eligibility section
const eligibilityItems = [
  { name: 'Eligibility', href: '/eligibility', icon: UserCheck },
  { name: 'NPHIES Eligibility', href: '/nphies-eligibility', icon: BadgeCheck },
];

// Claims & Payments section
const claimsPaymentsItems = [
  { name: 'Authorizations', href: '/authorizations', icon: ShieldCheck },
  { name: 'Claims', href: '/claims', icon: Receipt },
  { name: 'Claim Batches', href: '/claim-batches', icon: Layers },
  { name: 'Payment Notification', href: '/payments', icon: BellRing },
  { name: 'Payment Reconciliation', href: '/payment-reconciliations', icon: Scale },
];

// Tools section
const toolsItems = [
  { name: 'Response Viewer', href: '/response-viewer', icon: FileSearch },
  { name: 'Medicine Search', href: '/medicines', icon: Pill },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState(true);
  const [requestsAndClaimsOpen, setRequestsAndClaimsOpen] = useState(true);
  const [eligibilityOpen, setEligibilityOpen] = useState(true);
  const [claimsPaymentsOpen, setClaimsPaymentsOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);
  const location = useLocation();

  const isSuperAdmin = user?.email === 'eng.anasshamia@gmail.com';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
    const isMasterDataActive = masterDataItems.some(item => location.pathname === item.href) ||
      (isSuperAdmin && adminItems.some(item => location.pathname === item.href));

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
            {/* Admin-only items */}
            {isSuperAdmin && adminItems.map((item) => {
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
          requestsAndClaimsOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
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

  const renderEligibilitySection = (isMobile = false) => {
    const isEligibilityActive = eligibilityItems.some(item => location.pathname === item.href);

    return (
      <div className="mb-6">
        <button
          onClick={() => setEligibilityOpen(!eligibilityOpen)}
          className={cn(
            "group flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
            "border-l-4 border-transparent",
            isEligibilityActive
              ? "bg-gradient-to-r from-primary-purple/10 to-primary-purple/5 text-primary-purple border-l-primary-purple"
              : "text-gray-700 hover:bg-gray-50 hover:text-primary-purple hover:border-l-primary-purple/50"
          )}
        >
          <UserCheck
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
              isEligibilityActive
                ? "text-primary-purple"
                : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
            )}
          />
          <span className="tracking-wide">Eligibility</span>
          <div className={cn(
            "ml-auto transition-transform duration-300",
            eligibilityOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-purple" />
          </div>
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          eligibilityOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4">
            {eligibilityItems.map((item) => {
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

  const renderClaimsPaymentsSection = (isMobile = false) => {
    const isClaimsPaymentsActive = claimsPaymentsItems.some(item => location.pathname === item.href);

    return (
      <div className="mb-6">
        <button
          onClick={() => setClaimsPaymentsOpen(!claimsPaymentsOpen)}
          className={cn(
            "group flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
            "border-l-4 border-transparent",
            isClaimsPaymentsActive
              ? "bg-gradient-to-r from-primary-purple/10 to-primary-purple/5 text-primary-purple border-l-primary-purple"
              : "text-gray-700 hover:bg-gray-50 hover:text-primary-purple hover:border-l-primary-purple/50"
          )}
        >
          <Receipt
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
              isClaimsPaymentsActive
                ? "text-primary-purple"
                : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
            )}
          />
          <span className="tracking-wide">Claims & Payments</span>
          <div className={cn(
            "ml-auto transition-transform duration-300",
            claimsPaymentsOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-purple" />
          </div>
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          claimsPaymentsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4">
            {claimsPaymentsItems.map((item) => {
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

  const renderToolsSection = (isMobile = false) => {
    const isToolsActive = toolsItems.some(item => location.pathname === item.href);

    return (
      <div className="mb-6">
        <button
          onClick={() => setToolsOpen(!toolsOpen)}
          className={cn(
            "group flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
            "border-l-4 border-transparent",
            isToolsActive
              ? "bg-gradient-to-r from-primary-purple/10 to-primary-purple/5 text-primary-purple border-l-primary-purple"
              : "text-gray-700 hover:bg-gray-50 hover:text-primary-purple hover:border-l-primary-purple/50"
          )}
        >
          <FileSearch
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
              isToolsActive
                ? "text-primary-purple"
                : "text-gray-400 group-hover:text-primary-purple group-hover:scale-110"
            )}
          />
          <span className="tracking-wide">Tools</span>
          <div className={cn(
            "ml-auto transition-transform duration-300",
            toolsOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary-purple" />
          </div>
        </button>

        <div className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          toolsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4">
            {toolsItems.map((item) => {
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

            {/* Requests and Claims Section */}
            {renderRequestsAndClaimsSection(true)}

            {/* Operations */}
            <div className="pt-4 border-t border-gray-100">
              <div className="px-4 mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operations</h3>
              </div>
              
              {/* Eligibility Section */}
              {renderEligibilitySection(true)}

              {/* Claims & Payments Section */}
              {renderClaimsPaymentsSection(true)}

              {/* Tools Section */}
              {renderToolsSection(true)}
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

            {/* Requests and Claims Section */}
            {renderRequestsAndClaimsSection(false)}

            {/* Operations */}
            <div className="pt-4 border-t border-gray-100">
              <div className="px-4 mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operations</h3>
              </div>
              
              {/* Eligibility Section */}
              {renderEligibilitySection(false)}

              {/* Claims & Payments Section */}
              {renderClaimsPaymentsSection(false)}

              {/* Tools Section */}
              {renderToolsSection(false)}
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
                    {[...masterDataItems, ...requestsAndClaimsItems, ...eligibilityItems, ...claimsPaymentsItems, ...toolsItems].find(item => item.href === location.pathname || location.pathname.startsWith(item.href + '/'))?.name || 'Dashboard'}
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
              {user && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{user.email}</span>
                </div>
              )}
              <div className="h-6 w-px bg-gray-200"></div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors font-medium"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
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
