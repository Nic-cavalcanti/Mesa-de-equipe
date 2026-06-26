import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, FileText, Home, Lock, PackageCheck, Search, Send, ShieldAlert, UsersRound } from 'lucide-react';
import { clients, team } from './data.js';
import './styles.css';

const flagConfig = {
  'Segura entrega': { tone: 'danger', icon: PackageCheck },
  'Nao emite nota fiscal': { tone: 'warning', icon: FileText },
  'Solicita limite': { tone: 'info', icon: CircleDollarSign }
};

function App() {
  const [route, setRoute] = useState('clients');
  const [selectedId, setSelectedId] = useState(clients[0].id);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const selected = clients.find((client) => client.id === selectedId) ?? clients[0];

  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesFilter = filter === 'all' ||
        (filter === 'blocked' && client.flags.length > 0) ||
        (filter === 'delivery' && client.flags.includes('Segura entrega')) ||
        (filter === 'invoice' && client.flags.includes('Nao emite nota fiscal')) ||
        (filter === 'limit' && client.flags.includes('Solicita limite')) ||
        (filter === 'healthy' && client.flags.length === 0);
      const text = [client.name, client.segment, client.owner, ...client.flags].join(' ').toLowerCase();
      return matchesFilter && text.includes(query.toLowerCase());
    });
  }, [filter, query]);

  const metrics = [
    { label: 'Clientes ativos', value: clients.length, hint: '+2 este mes', icon: UsersRound },
    { label: 'Com bloqueio', value: clients.filter((c) => c.flags.length).length, hint: 'pedem atencao', icon: ShieldAlert, tone: 'danger' },
    { label: 'Segura entrega', value: clients.filter((c) => c.flags.includes('Segura entrega')).length, hint: 'nao liberar envio', icon: Lock, tone: 'warning' },
    { label: 'Solicita limite', value: clients.filter((c) => c.flags.includes('Solicita limite')).length, hint: 'financeiro', icon: CircleDollarSign, tone: 'info' },
    { label: 'Pedidos abertos', value: clients.reduce((sum, client) => sum + client.openOrders, 0), hint: 'em acompanhamento', icon: PackageCheck }
  ];

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
        <div className="roleSwitch"><button className="active">Gestora</button><button>Colaborador</button></div>
        <div className="userCard"><div className="avatar photo">NS</div><div><strong>Nicole Silva</strong><span>Gestora</span></div></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p>Bom dia, Nicole!</p><h1>{route === 'clients' ? 'Clientes' : route === 'orders' ? 'Pedidos' : 'Visao geral'}</h1></div>
          <div className="actions">
            <label className="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, processo, pessoa, documento..." /></label>
            <button className="bell"><Bell size={18} /><span>3</span></button>
            <button className="primary">+ Novo cliente</button>
          </div>
        </header>

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

        <section className="clientGrid">{visibleClients.map((client) => <ClientCard key={client.id} client={client} selected={client.id === selectedId} onSelect={() => setSelectedId(client.id)} />)}</section>

        <section className="overview">
          <article><h2>Carga por colaborador</h2>{team.map((member) => <LoadRow key={member.name} member={member} />)}</article>
          <article><h2>Bloqueios mais comuns</h2><div className="donut"></div><p><i className="dot danger"></i>Segura entrega</p><p><i className="dot warning"></i>Nao emite nota fiscal</p><p><i className="dot info"></i>Solicita limite</p></article>
          <article><h2>Operacao da semana</h2><strong className="largeNumber">28</strong><span>acoes concluidas</span><div className="sparkline"></div></article>
        </section>
      </main>

      <ClientPanel client={selected} />
    </div>
  );
}

function Metric({ metric }) { const Icon = metric.icon; return <article className="metric"><Icon className={metric.tone ?? ''} size={24} /><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.hint}</small></article>; }

function ClientCard({ client, selected, onSelect }) {
  return <button className={selected ? 'clientCard selected' : 'clientCard'} onClick={onSelect}>
    <div className="clientTop"><div><span className="muted">Cliente</span><h3>{client.name}</h3></div><div className="avatar">{client.initials}</div></div>
    <div className="chips"><span>{client.segment}</span><span className={client.priority === 'Alta' ? 'danger' : client.priority === 'Media' ? 'warning' : 'success'}>{client.priority}</span><span>{client.health}</span></div>
    <p>{client.summary}</p>
    <div className="flagList">{client.flags.length ? client.flags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Sem bloqueios</span>}</div>
    <div className="cardFooter"><span>{client.openProcesses} processos</span><span>{client.openOrders} pedidos</span><span>{client.nextDue}</span></div>
  </button>;
}

function Flag({ label }) { const config = flagConfig[label] ?? { tone: 'info', icon: AlertTriangle }; const Icon = config.icon; return <span className={'flag ' + config.tone}><Icon size={13} />{label}</span>; }
function LoadRow({ member }) { return <div className="loadRow"><span>{member.name}</span><div><i style={{ width: member.load + '%' }} /></div><strong>{member.load}%</strong></div>; }

function ClientPanel({ client }) {
  return <aside className="panel">
    <div className="panelPriority"><span className={client.priority === 'Alta' ? 'dot danger' : 'dot warning'} />{client.priority} prioridade</div>
    <div className="panelHead"><div><h2>{client.name}</h2><span>{client.segment}</span></div><div className="avatar">{client.initials}</div></div>
    <div className="statusRail"><Step done label="Cadastro" /><Step done={client.flags.length === 0} active={client.flags.length > 0} label="Analise" /><Step label="Liberacao" /><Step label="Entrega" /></div>
    <section className="panelSection"><h3>Status operacional</h3><div className="flagList panelFlags">{client.flags.length ? client.flags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Cliente liberado</span>}</div></section>
    <section className="detailGrid"><div><span>Responsavel</span><strong>{client.owner}</strong></div><div><span>Proximo prazo</span><strong>{client.nextDue}</strong></div><div><span>Limite</span><strong>{client.creditLimit}</strong></div><div><span>Utilizado</span><strong>{client.usedLimit}</strong></div></section>
    <section className="panelSection"><h3>Processos</h3>{client.processes.map((process) => <div className="lineItem" key={process.title}><strong>{process.title}</strong><span>{process.category} · {process.status} · {process.due}</span></div>)}</section>
    <section className="panelSection"><h3>Pedidos</h3>{client.orders.map((order) => <div className="lineItem" key={order.code}><strong>{order.code} · {order.status}</strong><span>{order.invoice} · entrega {order.delivery}</span></div>)}</section>
    <section className="panelSection"><h3>Historico</h3>{client.history.map((item) => <p className="history" key={item}>{item}</p>)}</section>
    <div className="commentBox">Escrever comentario...<button><Send size={16} /></button></div>
  </aside>;
}
function Step({ label, done, active }) { return <div className={active ? 'step active' : done ? 'step done' : 'step'}><i />{label}</div>; }
createRoot(document.getElementById('root')).render(<App />);
