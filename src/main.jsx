import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Eye, EyeOff, FileText, Home, Lock, PackageCheck, Search, Send, ShieldAlert, UsersRound, X } from 'lucide-react';
import { clients as fallbackClients, team } from './data.js';
import { loadClientsFromDatabase } from './services/clientRepository.js';
import './styles.css';

const profiles = {
  manager: {
    label: 'Gestora',
    user: 'Nicole Silva',
    note: 'Acesso total',
    visibleOwners: 'all',
    canSeeFinancial: true,
    canSeeSensitiveFlags: true,
    canSeeAllClients: true
  },
  collaborator: {
    label: 'Colaborador',
    user: 'Duda',
    note: 'Clientes atribuídos',
    visibleOwners: ['Duda'],
    canSeeFinancial: false,
    canSeeSensitiveFlags: false,
    canSeeAllClients: false
  },
  finance: {
    label: 'Financeiro',
    user: 'Caio',
    note: 'Limite e fiscal',
    visibleOwners: 'all',
    canSeeFinancial: true,
    canSeeSensitiveFlags: true,
    canSeeAllClients: true
  },
  logistics: {
    label: 'Logística',
    user: 'Bia',
    note: 'Pedidos e entrega',
    visibleOwners: 'all',
    canSeeFinancial: false,
    canSeeSensitiveFlags: true,
    canSeeAllClients: true
  }
};

const flagConfig = {
  'Segura entrega': { tone: 'danger', icon: PackageCheck, sensitive: false },
  'Nao emite nota fiscal': { tone: 'warning', icon: FileText, sensitive: true },
  'Solicita limite': { tone: 'info', icon: CircleDollarSign, sensitive: true }
};

function App() {
  const [route, setRoute] = useState('clients');
  const [dbClients, setDbClients] = useState(null);
  const [dataSource, setDataSource] = useState('demo');
  const [dbError, setDbError] = useState(null);
  const [selectedId, setSelectedId] = useState(fallbackClients[0].id);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState('manager');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const profile = profiles[profileId];
  const appClients = dbClients ?? fallbackClients;
  const selected = appClients.find((client) => client.id === selectedId) ?? appClients[0] ?? fallbackClients[0];

  useEffect(() => {
    let active = true;

    loadClientsFromDatabase().then((result) => {
      if (!active) return;
      if (result.clients) setDbClients(result.clients);
      setDataSource(result.source);
      setDbError(result.error);
    });

    return () => {
      active = false;
    };
  }, []);

  const allowedClients = useMemo(() => {
    if (profile.visibleOwners === 'all') return appClients;
    return appClients.filter((client) => profile.visibleOwners.includes(client.owner));
  }, [profile, appClients]);

  const visibleClients = useMemo(() => {
    return allowedClients.filter((client) => {
      const visibleFlags = getVisibleFlags(client, profile);
      const matchesFilter = filter === 'all' ||
        (filter === 'blocked' && visibleFlags.length > 0) ||
        (filter === 'delivery' && client.flags.includes('Segura entrega')) ||
        (filter === 'invoice' && visibleFlags.includes('Nao emite nota fiscal')) ||
        (filter === 'limit' && visibleFlags.includes('Solicita limite')) ||
        (filter === 'healthy' && visibleFlags.length === 0);
      const text = [client.name, client.segment, client.owner, ...visibleFlags].join(' ').toLowerCase();
      return matchesFilter && text.includes(query.toLowerCase());
    });
  }, [allowedClients, filter, query, profile]);

  const metrics = [
    { label: 'Clientes visíveis', value: visibleClients.length, hint: profile.canSeeAllClients ? 'visao completa' : 'somente atribuídos', icon: UsersRound },
    { label: 'Com bloqueio', value: visibleClients.filter((c) => getVisibleFlags(c, profile).length).length, hint: 'pedem atencao', icon: ShieldAlert, tone: 'danger' },
    { label: 'Segura entrega', value: visibleClients.filter((c) => c.flags.includes('Segura entrega')).length, hint: 'nao liberar envio', icon: Lock, tone: 'warning' },
    { label: 'Solicita limite', value: profile.canSeeFinancial ? visibleClients.filter((c) => c.flags.includes('Solicita limite')).length : '—', hint: profile.canSeeFinancial ? 'financeiro' : 'restrito', icon: CircleDollarSign, tone: 'info' },
    { label: 'Pedidos abertos', value: visibleClients.reduce((sum, client) => sum + client.openOrders, 0), hint: 'em acompanhamento', icon: PackageCheck }
  ];

  function openClient(client) {
    setSelectedId(client.id);
    setDrawerOpen(true);
  }

  function changeProfile(id) {
    setProfileId(id);
    const nextProfile = profiles[id];
    const nextClients = nextProfile.visibleOwners === 'all' ? appClients : appClients.filter((client) => nextProfile.visibleOwners.includes(client.owner));
    if (!nextClients.some((client) => client.id === selectedId)) setSelectedId(nextClients[0]?.id ?? appClients[0]?.id ?? fallbackClients[0].id);
    setDrawerOpen(false);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">M</div><div><strong>Mesa da Equipe</strong><span>Gestao por cliente</span></div></div>
        <nav className="nav">
          <button className={route === 'home' ? 'active' : ''} onClick={() => setRoute('home')}><Home size={18} />Inicio</button>
          <button className={route === 'clients' ? 'active' : ''} onClick={() => setRoute('clients')}><UsersRound size={18} />Clientes</button>
          <button className={route === 'orders' ? 'active' : ''} onClick={() => setRoute('orders')}><PackageCheck size={18} />Pedidos</button>
          <button className={route === 'calendar' ? 'active' : ''} onClick={() => setRoute('calendar')}><CalendarDays size={18} />Calendario</button>
          <button className={route === 'reports' ? 'active' : ''} onClick={() => setRoute('reports')}><ClipboardList size={18} />Relatorios</button>
        </nav>
        <section className="accessBox">
          <span className="muted">Perfil de visualizacao</span>
          <div className="profileGrid">
            {Object.entries(profiles).map(([id, item]) => <button key={id} className={profileId === id ? 'active' : ''} onClick={() => changeProfile(id)}>{item.label}</button>)}
          </div>
          <p>{profile.note}</p>
        </section>
        <div className="userCard"><div className="avatar photo">{profile.user.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><strong>{profile.user}</strong><span>{profile.label}</span></div></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p>Bom dia, {profile.user.split(' ')[0]}!</p><h1>{route === 'clients' ? 'Clientes' : route === 'orders' ? 'Pedidos' : 'Visao geral'}</h1></div>
          <div className="actions">
            <label className="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, processo, pessoa, documento..." /></label>
            <button className="bell"><Bell size={18} /><span>3</span></button>
            <button className="primary">+ Novo cliente</button>
          </div>
        </header>

        <section className="permissionBanner">
          {profile.canSeeFinancial ? <Eye size={17} /> : <EyeOff size={17} />}
          <span>{profile.canSeeFinancial ? 'Você está vendo informações financeiras e operacionais.' : 'Valores de limite, uso de crédito e bloqueios financeiros estão ocultos neste perfil.'}</span>
        </section>

        <section className="metrics">{metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</section>

        <section className="filters">
          {[
            ['all', 'Todos'], ['blocked', 'Com bloqueio'], ['delivery', 'Segura entrega'], ['invoice', 'Nao emite nota fiscal'], ['limit', 'Solicita limite'], ['healthy', 'Sem bloqueio']
          ].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}
        </section>

        <section className="toolbar">
          <button>Segmento <ChevronDown size={14} /></button><button>Responsavel <ChevronDown size={14} /></button><button>Prioridade <ChevronDown size={14} /></button><button>Status operacional <ChevronDown size={14} /></button>
          <span>Visualizacao</span><button className="active">Clientes</button><button>Pedidos</button><button>Timeline</button>
        </section>

        <section className="clientGrid">{visibleClients.map((client) => <ClientCard key={client.id} client={client} profile={profile} selected={client.id === selectedId} onSelect={() => setSelectedId(client.id)} onOpen={() => openClient(client)} />)}</section>

        <section className="overview">
          <article><h2>Carga por colaborador</h2>{team.map((member) => <LoadRow key={member.name} member={member} />)}</article>
          <article><h2>Bloqueios visíveis</h2><div className="donut"></div><p><i className="dot danger"></i>Segura entrega</p><p><i className="dot warning"></i>Nota fiscal</p><p><i className="dot info"></i>Limite</p></article>
          <article><h2>Proteção</h2><strong className="largeNumber">4</strong><span>perfis simulados</span><p className="muted">A próxima etapa é conectar isso a login real.</p></article>
        </section>
      </main>

      <ClientPanel client={selected} profile={profile} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {drawerOpen && <button className="drawerBackdrop" aria-label="Fechar detalhes" onClick={() => setDrawerOpen(false)} />}
    </div>
  );
}

function getVisibleFlags(client, profile) {
  return client.flags.filter((flag) => profile.canSeeSensitiveFlags || !flagConfig[flag]?.sensitive);
}

function Metric({ metric }) { const Icon = metric.icon; return <article className="metric"><Icon className={metric.tone ?? ''} size={24} /><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.hint}</small></article>; }

function ClientCard({ client, profile, selected, onSelect, onOpen }) {
  const flags = getVisibleFlags(client, profile);
  return <article className={selected ? 'clientCard selected' : 'clientCard'} onClick={onSelect}>
    <div className="clientTop"><div><span className="muted">Cliente</span><h3>{client.name}</h3></div><div className="avatar">{client.initials}</div></div>
    <div className="chips"><span>{client.segment}</span><span className={client.priority === 'Alta' ? 'danger' : client.priority === 'Media' ? 'warning' : 'success'}>{client.priority}</span><span>{client.health}</span></div>
    <p>{client.summary}</p>
    <div className="flagList">{flags.length ? flags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Sem bloqueios visíveis</span>}</div>
    <div className="cardFooter"><span>{client.openProcesses} processos</span><span>{client.openOrders} pedidos</span><span>{client.nextDue}</span></div>
    <button className="detailsButton" type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Ver detalhes</button>
  </article>;
}

function Flag({ label }) { const config = flagConfig[label] ?? { tone: 'info', icon: AlertTriangle }; const Icon = config.icon; return <span className={'flag ' + config.tone}><Icon size={13} />{label}</span>; }
function LoadRow({ member }) { return <div className="loadRow"><span>{member.name}</span><div><i style={{ width: member.load + '%' }} /></div><strong>{member.load}%</strong></div>; }

function ClientPanel({ client, profile, open, onClose }) {
  const visibleFlags = getVisibleFlags(client, profile);
  return <aside className={open ? 'panel open' : 'panel'} aria-hidden={!open}>
    <button className="closePanel" type="button" onClick={onClose}><X size={18} /></button>
    <div className="panelPriority"><span className={client.priority === 'Alta' ? 'dot danger' : 'dot warning'} />{client.priority} prioridade</div>
    <div className="panelHead"><div><h2>{client.name}</h2><span>{client.segment}</span></div><div className="avatar">{client.initials}</div></div>
    <div className="statusRail"><Step done label="Cadastro" /><Step done={client.flags.length === 0} active={client.flags.length > 0} label="Analise" /><Step label="Liberacao" /><Step label="Entrega" /></div>
    <section className="panelSection"><h3>Status operacional</h3><div className="flagList panelFlags">{visibleFlags.length ? visibleFlags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Sem bloqueios visíveis</span>}</div></section>
    <section className="detailGrid"><div><span>Responsavel</span><strong>{client.owner}</strong></div><div><span>Proximo prazo</span><strong>{client.nextDue}</strong></div><div><span>Limite</span><strong>{profile.canSeeFinancial ? client.creditLimit : 'Restrito'}</strong></div><div><span>Utilizado</span><strong>{profile.canSeeFinancial ? client.usedLimit : 'Restrito'}</strong></div></section>
    <section className="panelSection"><h3>Processos</h3>{client.processes.map((process) => <div className="lineItem" key={process.title}><strong>{process.title}</strong><span>{process.category} - {process.status} - {process.due}</span></div>)}</section>
    <section className="panelSection"><h3>Pedidos</h3>{client.orders.map((order) => <div className="lineItem" key={order.code}><strong>{order.code} - {order.status}</strong><span>{profile.canSeeFinancial ? order.invoice : 'Nota restrita'} - entrega {order.delivery}</span></div>)}</section>
    <section className="panelSection"><h3>Historico</h3>{client.history.map((item) => <p className="history" key={item}>{item}</p>)}</section>
    <div className="commentBox">Escrever comentario...<button><Send size={16} /></button></div>
  </aside>;
}
function Step({ label, done, active }) { return <div className={active ? 'step active' : done ? 'step done' : 'step'}><i />{label}</div>; }
createRoot(document.getElementById('root')).render(<App />);
