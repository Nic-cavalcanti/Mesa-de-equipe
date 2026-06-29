import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Eye, EyeOff, FileText, Home, Lock, PackageCheck, Search, Send, ShieldAlert, UsersRound, X } from 'lucide-react';
import { clients as fallbackClients, team } from './data.js';
import { isSupabaseConfigured } from './lib/supabase.js';
import { getInitialSession, listenToAuthChanges, loadCurrentProfile, signInWithPassword, signOut } from './services/authRepository.js';
import { createClientRecord, loadClientsFromDatabase } from './services/clientRepository.js';
import { completeClientTask, completePersonalTask, createClientTask, createPersonalTask, loadClientTasks, loadPersonalTasks, loadTeamProfiles } from './services/taskRepository.js';
import './styles.css';

const profilePermissions = {
  manager: {
    label: 'Gestora',
    fallbackUser: 'Nicole Silva',
    note: 'Acesso total',
    visibleOwners: 'all',
    canSeeFinancial: true,
    canSeeSensitiveFlags: true,
    canSeeAllClients: true
  },
  collaborator: {
    label: 'Colaborador',
    fallbackUser: 'Colaborador',
    note: 'Clientes e processos compartilhados',
    visibleOwners: 'all',
    canSeeFinancial: false,
    canSeeSensitiveFlags: false,
    canSeeAllClients: true
  },
  finance: {
    label: 'Financeiro',
    fallbackUser: 'Caio',
    note: 'Limite e fiscal',
    visibleOwners: 'all',
    canSeeFinancial: true,
    canSeeSensitiveFlags: true,
    canSeeAllClients: true
  },
  logistics: {
    label: 'Logistica',
    fallbackUser: 'Bia',
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

function explainAuthError(error) {
  const message = error?.message ?? String(error ?? '');
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) return 'E-mail ou senha nao conferem com o usuario criado no Supabase.';
  if (lower.includes('email not confirmed')) return 'Seu e-mail ainda nao esta confirmado no Supabase. Abra o usuario e marque como confirmado.';
  if (lower.includes('fetch') || lower.includes('failed to fetch')) return 'Nao consegui conversar com o Supabase. Confira as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel e faca um novo deploy.';
  if (lower.includes('row') || lower.includes('json object requested')) return 'Login aceito, mas o perfil ainda nao foi criado na tabela profiles para este usuario.';

  return message || 'Nao consegui entrar agora. Confira o e-mail, a senha e as configuracoes do Supabase.';
}

function App() {
  const [route, setRoute] = useState('clients');
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [personalTasks, setPersonalTasks] = useState([]);
  const [clientTasks, setClientTasks] = useState([]);
  const [taskError, setTaskError] = useState(null);
  const [dbClients, setDbClients] = useState(null);
  const [dataSource, setDataSource] = useState('demo');
  const [dbError, setDbError] = useState(null);
  const [selectedId, setSelectedId] = useState(fallbackClients[0].id);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState('manager');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);

  const realProfileId = currentProfile?.role ?? profileId;
  const profile = useMemo(() => {
    const permission = profilePermissions[realProfileId] ?? profilePermissions.collaborator;
    return {
      ...permission,
      user: currentProfile?.full_name ?? permission.fallbackUser,
      email: session?.user?.email ?? '',
      id: realProfileId
    };
  }, [currentProfile, realProfileId, session]);

  const appClients = dbClients ?? fallbackClients;
  const selected = appClients.find((client) => client.id === selectedId) ?? appClients[0] ?? fallbackClients[0];
  const selectedClientTasks = clientTasks.filter((task) => task.clientId === selected?.id);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    getInitialSession()
      .then((initialSession) => {
        if (active) setSession(initialSession);
      })
      .catch((error) => {
        if (active) setAuthError(explainAuthError(error));
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    const unsubscribe = listenToAuthChanges((nextSession) => {
      setSession(nextSession);
      setCurrentProfile(null);
      setDbClients(null);
      setTeamProfiles([]);
      setPersonalTasks([]);
      setClientTasks([]);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session) return;

    let active = true;

    loadCurrentProfile()
      .then((loadedProfile) => {
        if (active) setCurrentProfile(loadedProfile);
      })
      .catch((error) => {
        if (active) setAuthError(explainAuthError(error));
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (isSupabaseConfigured && !session) return;

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
  }, [session]);

  useEffect(() => {
    if (!currentProfile) return;

    let active = true;

    Promise.all([loadTeamProfiles(), loadPersonalTasks(), loadClientTasks()])
      .then(([profiles, tasks, clientTaskRows]) => {
        if (!active) return;
        setTeamProfiles(profiles);
        setPersonalTasks(tasks);
        setClientTasks(clientTaskRows);
      })
      .catch((error) => {
        if (active) setTaskError(explainAuthError(error));
      });

    return () => {
      active = false;
    };
  }, [currentProfile]);

  async function refreshClients() {
    const result = await loadClientsFromDatabase();
    if (result.clients) setDbClients(result.clients);
    setDataSource(result.source);
    setDbError(result.error);
  }

  async function refreshTasks() {
    if (!isSupabaseConfigured) return;
    const [tasks, clientTaskRows] = await Promise.all([loadPersonalTasks(), loadClientTasks()]);
    setPersonalTasks(tasks);
    setClientTasks(clientTaskRows);
  }

  async function handleCreateClient(client) {
    await createClientRecord(client);
    await refreshClients();
    setShowClientForm(false);
  }

  async function handleCreatePersonalTask(task) {
    await createPersonalTask({ ...task, createdBy: currentProfile.id });
    await refreshTasks();
  }

  async function handleCompletePersonalTask(id) {
    await completePersonalTask(id);
    await refreshTasks();
  }

  async function handleCreateClientTask(task) {
    await createClientTask({ ...task, createdBy: currentProfile.id });
    await refreshTasks();
  }

  async function handleCompleteClientTask(id, nextProfileId) {
    await completeClientTask(id, nextProfileId);
    await refreshTasks();
  }

  function openClient(client) {
    setSelectedId(client.id);
    setDrawerOpen(true);
  }

  function changeProfile(id) {
    setProfileId(id);
    const nextProfile = profilePermissions[id];
    const nextClients = nextProfile.visibleOwners === 'all' ? appClients : appClients.filter((client) => nextProfile.visibleOwners.includes(client.owner));
    if (!nextClients.some((client) => client.id === selectedId)) setSelectedId(nextClients[0]?.id ?? appClients[0]?.id ?? fallbackClients[0].id);
    setDrawerOpen(false);
  }

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
    { label: 'Clientes visiveis', value: visibleClients.length, hint: profile.canSeeAllClients ? 'visao completa' : 'somente atribuidos', icon: UsersRound },
    { label: 'Com bloqueio', value: visibleClients.filter((client) => getVisibleFlags(client, profile).length).length, hint: 'pedem atencao', icon: ShieldAlert, tone: 'danger' },
    { label: 'Segura entrega', value: visibleClients.filter((client) => client.flags.includes('Segura entrega')).length, hint: 'nao liberar envio', icon: Lock, tone: 'warning' },
    { label: 'Solicita limite', value: profile.canSeeFinancial ? visibleClients.filter((client) => client.flags.includes('Solicita limite')).length : '-', hint: profile.canSeeFinancial ? 'financeiro' : 'restrito', icon: CircleDollarSign, tone: 'info' },
    { label: 'Pedidos abertos', value: visibleClients.reduce((sum, client) => sum + client.openOrders, 0), hint: 'em acompanhamento', icon: PackageCheck }
  ];

  if (authLoading) return <AuthShell title="Carregando acesso" text="Conferindo sua sessao com seguranca..." />;
  if (isSupabaseConfigured && !session) return <LoginScreen error={authError} onError={setAuthError} />;
  if (isSupabaseConfigured && session && !currentProfile) {
    return <AuthShell title="Perfil pendente" text={authError || 'Seu login existe, mas ainda precisamos cadastrar seu perfil de acesso na tabela profiles.'} action={<button className="primary" onClick={() => signOut()}>Sair</button>} />;
  }

  const title = route === 'agenda' ? 'Minha Agenda' : route === 'clients' ? 'Clientes' : route === 'orders' ? 'Pedidos' : 'Visao geral';
  const bannerText = route === 'agenda'
    ? profile.id === 'manager' ? 'Gestores veem e criam atividades para toda a equipe.' : 'Sua agenda e privada: so voce e gestores conseguem ver.'
    : profile.canSeeFinancial ? 'Voce esta vendo informacoes financeiras e operacionais.' : 'Valores de limite, uso de credito e bloqueios financeiros estao ocultos neste perfil.';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div><strong>Mesa da Equipe</strong><span>Gestao por cliente</span></div>
        </div>

        <nav className="nav">
          <button className={route === 'home' ? 'active' : ''} onClick={() => setRoute('home')}><Home size={18} />Inicio</button>
          <button className={route === 'clients' ? 'active' : ''} onClick={() => setRoute('clients')}><UsersRound size={18} />Clientes</button>
          <button className={route === 'agenda' ? 'active' : ''} onClick={() => setRoute('agenda')}><CalendarDays size={18} />Minha Agenda</button>
          <button className={route === 'orders' ? 'active' : ''} onClick={() => setRoute('orders')}><PackageCheck size={18} />Pedidos</button>
          <button className={route === 'calendar' ? 'active' : ''} onClick={() => setRoute('calendar')}><CalendarDays size={18} />Calendario</button>
          <button className={route === 'reports' ? 'active' : ''} onClick={() => setRoute('reports')}><ClipboardList size={18} />Relatorios</button>
        </nav>

        <section className="accessBox">
          <span className="muted">Perfil de visualizacao</span>
          {isSupabaseConfigured ? (
            <strong className="lockedProfile">{profile.label}</strong>
          ) : (
            <div className="profileGrid">
              {Object.entries(profilePermissions).map(([id, item]) => (
                <button key={id} className={profileId === id ? 'active' : ''} onClick={() => changeProfile(id)}>{item.label}</button>
              ))}
            </div>
          )}
          <p>{profile.note}</p>
        </section>

        <div className="userCard">
          <div className="avatar photo">{profile.user.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
          <div><strong>{profile.user}</strong><span>{profile.email || profile.label}</span></div>
          {isSupabaseConfigured && <button className="logoutButton" onClick={() => signOut()}>Sair</button>}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p>Bom dia, {profile.user.split(' ')[0]}!</p><h1>{title}</h1></div>
          <div className="actions">
            <label className="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, processo, pessoa, documento..." /></label>
            <button className="bell"><Bell size={18} /><span>3</span></button>
            <button className="primary" onClick={() => setShowClientForm((current) => !current)}>+ Novo cliente</button>
          </div>
        </header>

        <section className="permissionBanner">
          {route === 'agenda' ? <CalendarDays size={17} /> : profile.canSeeFinancial ? <Eye size={17} /> : <EyeOff size={17} />}
          <span>{bannerText}</span>
        </section>

        {taskError && <p className="dbWarning">{taskError}</p>}
        {showClientForm && <ClientCreateForm onCreate={handleCreateClient} onCancel={() => setShowClientForm(false)} />}

        {route === 'agenda' ? (
          <AgendaView
            profile={profile}
            currentProfile={currentProfile}
            teamProfiles={teamProfiles}
            personalTasks={personalTasks}
            onCreate={handleCreatePersonalTask}
            onComplete={handleCompletePersonalTask}
          />
        ) : (
          <ClientWorkspace
            metrics={metrics}
            filter={filter}
            setFilter={setFilter}
            visibleClients={visibleClients}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            openClient={openClient}
            profile={profile}
          />
        )}
      </main>

      <ClientPanel
        client={selected}
        profile={profile}
        clientTasks={selectedClientTasks}
        teamProfiles={teamProfiles}
        onCreateClientTask={handleCreateClientTask}
        onCompleteClientTask={handleCompleteClientTask}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      {drawerOpen && <button className="drawerBackdrop" aria-label="Fechar detalhes" onClick={() => setDrawerOpen(false)} />}
    </div>
  );
}

function ClientCreateForm({ onCreate, onCancel }) {
  const [form, setForm] = useState({ clientCode: '', name: '', cnpj: '', segment: '', priority: 'Media', summary: '' });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await onCreate(form);
    setForm({ clientCode: '', name: '', cnpj: '', segment: '', priority: 'Media', summary: '' });
  }

  return (
    <form className="taskComposer clientComposer" onSubmit={submit}>
      <div><h2>Cadastrar cliente</h2><p>Use o ID interno para localizar rapidamente o cadastro depois.</p></div>
      <div className="taskFormGrid">
        <label>ID do cliente<input value={form.clientCode} onChange={(event) => update('clientCode', event.target.value)} placeholder="Ex.: CLI-1024" /></label>
        <label>Nome<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nome do cliente" required /></label>
        <label>CNPJ opcional<input value={form.cnpj} onChange={(event) => update('cnpj', event.target.value)} placeholder="00.000.000/0000-00" /></label>
      </div>
      <div className="taskFormGrid">
        <label>Segmento<input value={form.segment} onChange={(event) => update('segment', event.target.value)} placeholder="Distribuidor, varejo..." /></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => update('priority', event.target.value)}><option>Alta</option><option>Media</option><option>Baixa</option></select></label>
        <label>Resumo<input value={form.summary} onChange={(event) => update('summary', event.target.value)} placeholder="Observacao inicial" /></label>
      </div>
      <div className="formActions"><button className="primary">Salvar cliente</button><button type="button" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

function ClientWorkspace({ metrics, filter, setFilter, visibleClients, selectedId, setSelectedId, openClient, profile }) {
  const filters = [
    ['all', 'Todos'],
    ['blocked', 'Com bloqueio'],
    ['delivery', 'Segura entrega'],
    ['invoice', 'Nao emite nota fiscal'],
    ['limit', 'Solicita limite'],
    ['healthy', 'Sem bloqueio']
  ];

  return (
    <>
      <section className="metrics">{metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</section>

      <section className="filters">
        {filters.map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}
      </section>

      <section className="toolbar">
        <button>Segmento <ChevronDown size={14} /></button>
        <button>Responsavel <ChevronDown size={14} /></button>
        <button>Prioridade <ChevronDown size={14} /></button>
        <button>Status operacional <ChevronDown size={14} /></button>
        <span>Visualizacao</span>
        <button className="active">Clientes</button>
        <button>Pedidos</button>
        <button>Timeline</button>
      </section>

      <section className="clientGrid">
        {visibleClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            profile={profile}
            selected={client.id === selectedId}
            onSelect={() => setSelectedId(client.id)}
            onOpen={() => openClient(client)}
          />
        ))}
      </section>

      <section className="overview">
        <article><h2>Carga por colaborador</h2>{team.map((member) => <LoadRow key={member.name} member={member} />)}</article>
        <article><h2>Bloqueios visiveis</h2><div className="donut"></div><p><i className="dot danger"></i>Segura entrega</p><p><i className="dot warning"></i>Nota fiscal</p><p><i className="dot info"></i>Limite</p></article>
        <article><h2>Protecao</h2><strong className="largeNumber">4</strong><span>perfis simulados</span><p className="muted">Agenda pessoal fica privada por usuario.</p></article>
      </section>
    </>
  );
}

function AgendaView({ profile, currentProfile, teamProfiles, personalTasks, onCreate, onComplete }) {
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'Media', assignedId: currentProfile?.id ?? '', attachmentUrl: '', attachmentName: '' });
  const canManageAll = profile.id === 'manager';
  const assignableProfiles = canManageAll ? teamProfiles : teamProfiles.filter((item) => item.id === currentProfile?.id);
  const defaultAssignedId = form.assignedId || currentProfile?.id || assignableProfiles[0]?.id || '';
  const filteredTasks = personalTasks.filter((task) => canManageAll && ownerFilter !== 'all' ? task.assignedId === ownerFilter : true);
  const openTasks = filteredTasks.filter((task) => task.status !== 'Concluida');
  const doneTasks = filteredTasks.filter((task) => task.status === 'Concluida');

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitTask(event) {
    event.preventDefault();
    const assignedId = canManageAll ? defaultAssignedId : currentProfile.id;
    await onCreate({ ...form, assignedId });
    setForm({ title: '', description: '', dueDate: '', priority: 'Media', assignedId, attachmentUrl: '', attachmentName: '' });
  }

  return (
    <section className="agendaView">
      <form className="taskComposer" onSubmit={submitTask}>
        <div><h2>Nova atividade</h2><p>{canManageAll ? 'Crie para voce, Pablo ou qualquer colaborador.' : 'Crie uma atividade para sua propria agenda.'}</p></div>
        <label>Titulo<input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Ex.: Revisar credito do cliente" required /></label>
        <label>Descricao<input value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Contexto rapido" /></label>
        <label>Anexo<input value={form.attachmentUrl} onChange={(event) => updateForm('attachmentUrl', event.target.value)} placeholder="Link do arquivo" /></label>
        <div className="taskFormGrid">
          <label>Prazo<input type="date" value={form.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} /></label>
          <label>Prioridade<select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}><option>Alta</option><option>Media</option><option>Baixa</option></select></label>
          {canManageAll && (
            <label>Responsavel<select value={defaultAssignedId} onChange={(event) => updateForm('assignedId', event.target.value)}>{assignableProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          )}
        </div>
        <button className="primary">Criar atividade</button>
      </form>

      {canManageAll && (
        <section className="agendaFilter">
          <span>Ver agenda</span>
          <button className={ownerFilter === 'all' ? 'active' : ''} onClick={() => setOwnerFilter('all')}>Todos</button>
          {teamProfiles.map((item) => <button key={item.id} className={ownerFilter === item.id ? 'active' : ''} onClick={() => setOwnerFilter(item.id)}>{item.name}</button>)}
        </section>
      )}

      <div className="taskColumns">
        <article><h2>Pendentes <span>{openTasks.length}</span></h2>{openTasks.map((task) => <TaskCard key={task.id} task={task} canComplete onComplete={() => onComplete(task.id)} />)}{!openTasks.length && <p className="emptyState">Nada pendente por aqui.</p>}</article>
        <article><h2>Finalizadas <span>{doneTasks.length}</span></h2>{doneTasks.map((task) => <TaskCard key={task.id} task={task} />)}{!doneTasks.length && <p className="emptyState">As concluidas aparecerao aqui.</p>}</article>
      </div>
    </section>
  );
}

function TaskCard({ task, canComplete, onComplete }) {
  return (
    <div className={task.status === 'Concluida' ? 'taskCard done' : 'taskCard'}>
      <div><strong>{task.title}</strong><span>{task.assignedName}</span></div>
      {task.description && <p>{task.description}</p>}
      {task.attachmentUrl && <a className="attachmentLink" href={task.attachmentUrl} target="_blank" rel="noreferrer">{task.attachmentName || 'Abrir anexo'}</a>}
      <footer><span>{task.dueDate || 'Sem prazo'}</span><span>{task.priority}</span>{canComplete && <button onClick={onComplete}><CheckCircle2 size={14} />Finalizar</button>}</footer>
    </div>
  );
}

function getVisibleFlags(client, profile) {
  return client.flags.filter((flag) => profile.canSeeSensitiveFlags || !flagConfig[flag]?.sensitive);
}

function AuthShell({ title, text, action }) {
  return <main className="authPage"><section className="authCard"><div className="brandMark">M</div><h1>{title}</h1><p>{text}</p>{action}</section></main>;
}

function LoginScreen({ error, onError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    onError(null);

    try {
      await signInWithPassword(email, password);
    } catch (loginError) {
      onError(explainAuthError(loginError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <form className="authCard" onSubmit={handleSubmit}>
        <div className="brandMark">M</div>
        <h1>Mesa da Equipe</h1>
        <p>Entre com seu acesso para visualizar clientes, pedidos e bloqueios conforme seu perfil.</p>
        <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" required /></label>
        <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required /></label>
        {error && <strong className="authError">{error}</strong>}
        <button className="primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}

function Metric({ metric }) {
  const Icon = metric.icon;
  return <article className="metric"><Icon className={metric.tone ?? ''} size={24} /><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.hint}</small></article>;
}

function ClientCard({ client, profile, selected, onSelect, onOpen }) {
  const flags = getVisibleFlags(client, profile);
  return (
    <article className={selected ? 'clientCard selected' : 'clientCard'} onClick={onSelect}>
      <div className="clientTop"><div><span className="muted">{client.clientCode || 'Cliente'}</span><h3>{client.name}</h3></div><div className="avatar">{client.initials}</div></div>
      <div className="chips"><span>{client.segment}</span>{client.cnpj && <span>{client.cnpj}</span>}<span className={client.priority === 'Alta' ? 'danger' : client.priority === 'Media' ? 'warning' : 'success'}>{client.priority}</span><span>{client.health}</span></div>
      <p>{client.summary}</p>
      <div className="flagList">{flags.length ? flags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Sem bloqueios visiveis</span>}</div>
      <div className="cardFooter"><span>{client.openProcesses} processos</span><span>{client.openOrders} pedidos</span><span>{client.nextDue}</span></div>
      <button className="detailsButton" type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Ver detalhes</button>
    </article>
  );
}

function Flag({ label }) {
  const config = flagConfig[label] ?? { tone: 'info', icon: AlertTriangle };
  const Icon = config.icon;
  return <span className={'flag ' + config.tone}><Icon size={13} />{label}</span>;
}

function LoadRow({ member }) {
  return <div className="loadRow"><span>{member.name}</span><div><i style={{ width: member.load + '%' }} /></div><strong>{member.load}%</strong></div>;
}

function ClientPanel({ client, profile, clientTasks, teamProfiles, onCreateClientTask, onCompleteClientTask, open, onClose }) {
  const visibleFlags = getVisibleFlags(client, profile);
  return (
    <aside className={open ? 'panel open' : 'panel'} aria-hidden={!open}>
      <button className="closePanel" type="button" onClick={onClose}><X size={18} /></button>
      <div className="panelPriority"><span className={client.priority === 'Alta' ? 'dot danger' : 'dot warning'} />{client.priority} prioridade</div>
      <div className="panelHead"><div><h2>{client.name}</h2><span>{client.segment}</span></div><div className="avatar">{client.initials}</div></div>
      <div className="statusRail"><Step done label="Cadastro" /><Step done={client.flags.length === 0} active={client.flags.length > 0} label="Analise" /><Step label="Liberacao" /><Step label="Entrega" /></div>
      <section className="panelSection"><h3>Status operacional</h3><div className="flagList panelFlags">{visibleFlags.length ? visibleFlags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Sem bloqueios visiveis</span>}</div></section>
      <section className="detailGrid"><div><span>ID</span><strong>{client.clientCode || '-'}</strong></div><div><span>CNPJ</span><strong>{client.cnpj || 'Nao informado'}</strong></div><div><span>Responsavel</span><strong>{client.owner}</strong></div><div><span>Proximo prazo</span><strong>{client.nextDue}</strong></div><div><span>Limite</span><strong>{profile.canSeeFinancial ? client.creditLimit : 'Restrito'}</strong></div><div><span>Utilizado</span><strong>{profile.canSeeFinancial ? client.usedLimit : 'Restrito'}</strong></div></section>
      <section className="panelSection"><h3>Processos</h3>{client.processes.map((process) => <div className="lineItem" key={process.title}><strong>{process.title}</strong><span>{process.category} - {process.status} - {process.due}</span></div>)}</section>
      <section className="panelSection"><h3>Atividades do cliente</h3><ClientTaskForm client={client} teamProfiles={teamProfiles} onCreate={onCreateClientTask} />{clientTasks.length ? clientTasks.map((task) => <ClientTaskLine key={task.id} task={task} teamProfiles={teamProfiles} onComplete={onCompleteClientTask} />) : <p className="history">Nenhuma atividade de cliente cadastrada ainda.</p>}</section>
      <section className="panelSection"><h3>Pedidos</h3>{client.orders.map((order) => <div className="lineItem" key={order.code}><strong>{order.code} - {order.status}</strong><span>{profile.canSeeFinancial ? order.invoice : 'Nota restrita'} - entrega {order.delivery}</span></div>)}</section>
      <section className="panelSection"><h3>Historico</h3>{client.history.map((item) => <p className="history" key={item}>{item}</p>)}</section>
      <div className="commentBox">Escrever comentario...<button><Send size={16} /></button></div>
    </aside>
  );
}

function ClientTaskForm({ client, teamProfiles, onCreate }) {
  const [form, setForm] = useState({ orderNumber: '', title: '', assignedId: '', nextProfileId: '', currentStep: '', nextStep: '', restrictionStatus: 'Sem restricoes', notes: '', attachmentName: '', attachmentUrl: '', priority: 'Media' });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await onCreate({ ...form, clientId: client.id });
    setForm({ orderNumber: '', title: '', assignedId: '', nextProfileId: '', currentStep: '', nextStep: '', restrictionStatus: 'Sem restricoes', notes: '', attachmentName: '', attachmentUrl: '', priority: 'Media' });
  }

  return (
    <form className="miniTaskForm" onSubmit={submit}>
      <label>Pedido<input value={form.orderNumber} onChange={(event) => update('orderNumber', event.target.value)} placeholder="Numero do pedido" required /></label>
      <label>Atividade<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ex.: Conferir pagamento" required /></label>
      <label>Status<select value={form.restrictionStatus} onChange={(event) => update('restrictionStatus', event.target.value)}><option>Nao entregar</option><option>Aguardando pagamento</option><option>Nao faturar</option><option>Aguardando NF de transferencia</option><option>Sem restricoes</option></select></label>
      <label>Responsavel<select value={form.assignedId} onChange={(event) => update('assignedId', event.target.value)}><option value="">Equipe</option>{teamProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Proximo<select value={form.nextProfileId} onChange={(event) => update('nextProfileId', event.target.value)}><option value="">Entrega/final</option>{teamProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Observacoes<input value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Detalhes importantes" /></label>
      <label>Anexo<input value={form.attachmentUrl} onChange={(event) => update('attachmentUrl', event.target.value)} placeholder="Link do arquivo" /></label>
      <button className="detailsButton">Criar atividade</button>
    </form>
  );
}

function ClientTaskLine({ task, teamProfiles, onComplete }) {
  return (
    <div className="lineItem actionLine">
      <strong>{task.title}</strong>
      <span>Pedido {task.orderNumber} - {task.restrictionStatus} - {task.assignedName}</span>
      {task.notes && <p className="history">{task.notes}</p>}
      {task.attachmentUrl && <a className="attachmentLink" href={task.attachmentUrl} target="_blank" rel="noreferrer">{task.attachmentName || 'Abrir anexo'}</a>}
      {task.status !== 'Concluida' && <button onClick={() => onComplete(task.id, task.nextProfileId)}><CheckCircle2 size={14} />{task.nextProfileId ? 'Passar para proximo' : 'Encaminhar para entrega'}</button>}
    </div>
  );
}

function Step({ label, done, active }) {
  return <div className={active ? 'step active' : done ? 'step done' : 'step'}><i />{label}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
