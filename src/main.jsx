import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardList, Eye, EyeOff, FileText, Home, Lock, PackageCheck, Send, ShieldAlert, UsersRound, X } from 'lucide-react';
import { clients as fallbackClients, team } from './data.js';
import { isSupabaseConfigured } from './lib/supabase.js';
import { getInitialSession, listenToAuthChanges, loadCurrentProfile, signInWithPassword, signOut } from './services/authRepository.js';
import { createClientRecord, loadClientsFromDatabase } from './services/clientRepository.js';
import { addClientTaskComment, addPersonalTaskComment, applyClientTaskAction, completeClientTask, completePersonalTask, createClientTask, createPersonalTask, loadClientTaskEvents, loadClientTasks, loadPersonalTasks, loadTeamProfiles, requestPersonalTaskExtension, reviewPersonalTaskExtension, updatePersonalTaskStatus } from './services/taskRepository.js';
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
  const [route, setRoute] = useState('agenda');
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [personalTasks, setPersonalTasks] = useState([]);
  const [clientTasks, setClientTasks] = useState([]);
  const [clientTaskEvents, setClientTaskEvents] = useState([]);
  const [taskError, setTaskError] = useState(null);
  const [dbClients, setDbClients] = useState(null);
  const [dataSource, setDataSource] = useState('demo');
  const [dbError, setDbError] = useState(null);
  const [selectedId, setSelectedId] = useState(fallbackClients[0].id);
  const [filter, setFilter] = useState('all');
  const [profileId, setProfileId] = useState('manager');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

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
  const selectedOrderTask = clientTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedOrderEvents = clientTaskEvents.filter((event) => event.taskId === selectedTaskId);

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
      setClientTaskEvents([]);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session) return;

    let active = true;
    setAuthError(null);
    setProfileLoading(true);

    loadCurrentProfile()
      .then((loadedProfile) => {
        if (active) setCurrentProfile(loadedProfile);
      })
      .catch((error) => {
        if (active) setAuthError(explainAuthError(error));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
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

    Promise.all([loadTeamProfiles(), loadPersonalTasks(), loadClientTasks(), loadClientTaskEvents()])
      .then(([profiles, tasks, clientTaskRows, eventRows]) => {
        if (!active) return;
        setTeamProfiles(profiles);
        setPersonalTasks(tasks);
        setClientTasks(clientTaskRows);
        setClientTaskEvents(eventRows);
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
    const [tasks, clientTaskRows, eventRows] = await Promise.all([loadPersonalTasks(), loadClientTasks(), loadClientTaskEvents()]);
    setPersonalTasks(tasks);
    setClientTasks(clientTaskRows);
    setClientTaskEvents(eventRows);
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

  async function handleUpdatePersonalTaskStatus(id, status) {
    await updatePersonalTaskStatus(id, status);
    await refreshTasks();
  }

  async function handleSavePersonalTaskComment(id, comments) {
    setTaskError(null);
    try {
      await addPersonalTaskComment(id, comments);
      await refreshTasks();
    } catch (error) {
      setTaskError(explainAuthError(error));
      throw error;
    }
  }

  async function handleRequestPersonalTaskExtension(id, dueDate, reason) {
    setTaskError(null);
    try {
      await requestPersonalTaskExtension(id, dueDate, reason);
      await refreshTasks();
    } catch (error) {
      setTaskError(explainAuthError(error));
      throw error;
    }
  }

  async function handleReviewPersonalTaskExtension(id, decision) {
    setTaskError(null);
    try {
      await reviewPersonalTaskExtension(id, decision);
      await refreshTasks();
    } catch (error) {
      setTaskError(explainAuthError(error));
      throw error;
    }
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
    if (!nextProfileId) closeDetail();
  }

  async function handleAddClientTaskComment(id, comment) {
    await addClientTaskComment(id, comment);
    await refreshTasks();
  }

  async function handleApplyClientTaskAction(id, action) {
    await applyClientTaskAction(id, action);
    await refreshTasks();
  }

  function openClient(client) {
    setSelectedId(client.id);
    setSelectedTaskId(null);
    setDrawerOpen(true);
  }

  function openOrderTask(task) {
    setSelectedId(task.clientId);
    setSelectedTaskId(task.id);
    setDrawerOpen(true);
  }

  function closeDetail() {
    setSelectedTaskId(null);
    setDrawerOpen(false);
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
      return matchesFilter;
    });
  }, [allowedClients, filter, profile]);

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
    if (!authError) return <AuthShell title="Carregando perfil" text="Preparando sua mesa de trabalho..." />;
    return <AuthShell title="Perfil pendente" text={authError} action={<button className="primary" onClick={() => signOut()}>Sair</button>} />;
  }

  const routeTitles = {
    clients: 'Clientes',
    agenda: 'Agenda',
    orders: 'Pedidos',
    tireReserve: 'Reserva de pneus',
    stockReserve: 'Sem estoque',
    reports: 'Relatorios'
  };
  const title = routeTitles[route] ?? 'Visao geral';
  const bannerText = route === 'agenda'
    ? profile.id === 'manager' ? 'Gestores veem e criam atividades para toda a equipe.' : 'Sua agenda e privada: so voce e gestores conseguem ver.'
    : route === 'orders' ? 'Pedidos reunem as atividades operacionais por numero de pedido e restricao.'
    : route === 'tireReserve' ? 'Pedidos reservados para separar pneus antes da proxima etapa.'
    : route === 'stockReserve' ? 'Pedidos aguardando estoque para acompanhamento sem perder visibilidade.'
    : route === 'reports' ? 'Relatorios consolidam bloqueios, pedidos e carga da equipe.'
    : profile.canSeeFinancial ? 'Voce esta vendo informacoes financeiras e operacionais.' : 'Valores de limite, uso de credito e bloqueios financeiros estao ocultos neste perfil.';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div><strong>Mesa da Equipe</strong><span>Gestao por cliente</span></div>
        </div>

        <nav className="nav">
          <button className={route === 'agenda' ? 'active' : ''} onClick={() => setRoute('agenda')}><CalendarDays size={18} />Agenda</button>
          <button className={route === 'clients' ? 'active' : ''} onClick={() => setRoute('clients')}><UsersRound size={18} />Clientes</button>
          <button className={route === 'orders' ? 'active' : ''} onClick={() => setRoute('orders')}><PackageCheck size={18} />Pedidos</button>
          <button className={route === 'tireReserve' ? 'active' : ''} onClick={() => setRoute('tireReserve')}><Lock size={18} />Reserva pneus</button>
          <button className={route === 'stockReserve' ? 'active' : ''} onClick={() => setRoute('stockReserve')}><ShieldAlert size={18} />Sem estoque</button>
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
          <div className="userIdentity">
            <div className="avatar photo">{profile.user.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
            <div><strong>{profile.user}</strong><span>{profile.email || profile.label}</span></div>
          </div>
          {isSupabaseConfigured && <button className="logoutButton" onClick={() => signOut()}>Sair</button>}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p>Bom dia, {profile.user.split(' ')[0]}!</p><h1>{title}</h1></div>
          <div className="actions">
            {route === 'agenda' && <button className="primary" onClick={() => setShowTaskForm(true)}>+ Nova atividade</button>}
            {route === 'clients' && profile.id === 'manager' && <button className="primary" onClick={() => setShowClientForm((current) => !current)}>+ Novo cliente</button>}
          </div>
        </header>

        <section className="permissionBanner">
          {route === 'agenda' ? <CalendarDays size={17} /> : profile.canSeeFinancial ? <Eye size={17} /> : <EyeOff size={17} />}
          <span>{bannerText}</span>
        </section>

        {taskError && <p className="dbWarning">{taskError}</p>}
        {route === 'clients' && showClientForm && <ClientCreateForm onCreate={handleCreateClient} onCancel={() => setShowClientForm(false)} />}

        <MainContent
          route={route}
          metrics={metrics}
          filter={filter}
          setFilter={setFilter}
          visibleClients={visibleClients}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          openClient={openClient}
          openOrderTask={openOrderTask}
          profile={profile}
          currentProfile={currentProfile}
          teamProfiles={teamProfiles}
          personalTasks={personalTasks}
          clientTasks={clientTasks}
          showTaskForm={showTaskForm}
          onCloseTaskForm={() => setShowTaskForm(false)}
          onCreatePersonalTask={handleCreatePersonalTask}
          onCompletePersonalTask={handleCompletePersonalTask}
          onUpdatePersonalTaskStatus={handleUpdatePersonalTaskStatus}
          onSavePersonalTaskComment={handleSavePersonalTaskComment}
          onRequestPersonalTaskExtension={handleRequestPersonalTaskExtension}
          onReviewPersonalTaskExtension={handleReviewPersonalTaskExtension}
        />
      </main>

      <ClientPanel
        client={selected}
        profile={profile}
        clientTasks={selectedClientTasks}
        teamProfiles={teamProfiles}
        onCreateClientTask={handleCreateClientTask}
        selectedTask={selectedOrderTask}
        selectedTaskEvents={selectedOrderEvents}
        onOpenTask={setSelectedTaskId}
        onCompleteClientTask={handleCompleteClientTask}
        onAddClientTaskComment={handleAddClientTaskComment}
        onApplyClientTaskAction={handleApplyClientTaskAction}
        open={drawerOpen}
        onClose={closeDetail}
      />
      
    </div>
  );
}

function MainContent({ route, metrics, filter, setFilter, visibleClients, selectedId, setSelectedId, openClient, openOrderTask, profile, currentProfile, teamProfiles, personalTasks, clientTasks, showTaskForm, onCloseTaskForm, onCreatePersonalTask, onCompletePersonalTask, onUpdatePersonalTaskStatus, onSavePersonalTaskComment, onRequestPersonalTaskExtension, onReviewPersonalTaskExtension }) {
  if (route === 'agenda') {
    return <AgendaView profile={profile} currentProfile={currentProfile} teamProfiles={teamProfiles} personalTasks={personalTasks} showTaskForm={showTaskForm} onCloseTaskForm={onCloseTaskForm} onCreate={onCreatePersonalTask} onComplete={onCompletePersonalTask} onUpdateStatus={onUpdatePersonalTaskStatus} onSaveComment={onSavePersonalTaskComment} onRequestExtension={onRequestPersonalTaskExtension} onReviewExtension={onReviewPersonalTaskExtension} />;
  }

  if (route === 'orders') {
    return <OrdersView clientTasks={clientTasks} openClient={openClient} openOrderTask={openOrderTask} clients={visibleClients} />;
  }

  if (route === 'tireReserve') {
    return <ReservationView title="Reserva de pneus" description="Pedidos separados para reservar pneus antes da proxima etapa." status="Reserva de pneus" clientTasks={clientTasks} openOrderTask={openOrderTask} />;
  }

  if (route === 'stockReserve') {
    return <ReservationView title="Pedidos sem estoque" description="Pedidos que precisam ficar reservados ate entrada de estoque." status="Pedido sem estoque" clientTasks={clientTasks} openOrderTask={openOrderTask} />;
  }

  if (route === 'calendar') {
    return <CalendarView personalTasks={personalTasks} clientTasks={clientTasks} />;
  }

  if (route === 'reports') {
    return <ReportsView metrics={metrics} clientTasks={clientTasks} personalTasks={personalTasks} clients={visibleClients} teamProfiles={teamProfiles} />;
  }

  if (route === 'home') {
    return <HomeView metrics={metrics} clientTasks={clientTasks} personalTasks={personalTasks} clients={visibleClients} />;
  }

  return <ClientWorkspace metrics={metrics} visibleClients={visibleClients} selectedId={selectedId} setSelectedId={setSelectedId} openClient={openClient} openOrderTask={openOrderTask} profile={profile} clientTasks={clientTasks} />;
}

function HomeView({ metrics, clientTasks, personalTasks, clients }) {
  const openClientTasks = clientTasks.filter((task) => task.status !== 'Concluida');
  const openPersonalTasks = personalTasks.filter((task) => task.status !== 'Concluida');

  return (
    <section className="routeSurface">
      <section className="metrics">{metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</section>
      <div className="splitSurface">
        <article><h2>Pedidos em acompanhamento</h2>{openClientTasks.slice(0, 5).map((task) => <CompactOrder key={task.id} task={task} />)}{!openClientTasks.length && <p className="emptyState">Nenhum pedido em aberto.</p>}</article>
        <article><h2>Agenda em aberto</h2>{openPersonalTasks.slice(0, 5).map((task) => <TaskCard key={task.id} task={task} />)}{!openPersonalTasks.length && <p className="emptyState">Nenhuma atividade pendente.</p>}</article>
        <article><h2>Clientes recentes</h2>{clients.slice(0, 5).map((client) => <p className="listLine" key={client.id}><strong>{client.name}</strong><span>{client.clientCode || client.segment}</span></p>)}</article>
      </div>
    </section>
  );
}

function OrdersView({ clientTasks, openClient, openOrderTask, clients }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const openTasks = clientTasks.filter((task) => task.status !== 'Concluida');
  const completedTasks = clientTasks.filter((task) => task.status === 'Concluida');

  return (
    <section className="routeSurface">
      <div className="sectionTitle"><div><h2>Pedidos em aberto</h2><p>Apenas pedidos pendentes de finalizacao aparecem aqui.</p></div><strong>{openTasks.length} pendentes</strong></div>
      <div className="orderBoard singleBoard">
        <article><h2>Pendentes</h2>{openTasks.map((task) => <OrderCard key={task.id} task={task} onOpen={() => openOrderTask(task)} />)}{!openTasks.length && <p className="emptyState">Nenhum pedido pendente.</p>}</article>
      </div>
      <section className="completedOrdersBox">
        <button type="button" onClick={() => setShowCompleted((current) => !current)}>
          <span>Pedidos concluidos reservados</span>
          <strong>{completedTasks.length}</strong>
        </button>
        {showCompleted && (
          <div className="completedOrdersList">
            {completedTasks.map((task) => <OrderCard key={task.id} task={task} done onOpen={() => openOrderTask(task)} />)}
            {!completedTasks.length && <p className="emptyState">Nenhum pedido concluido ainda.</p>}
          </div>
        )}
      </section>
    </section>
  );
}

function ReservationView({ title, description, status, clientTasks, openOrderTask }) {
  const tasks = clientTasks.filter((task) => task.status !== 'Concluida' && task.restrictionStatus === status);

  return (
    <section className="routeSurface">
      <div className="sectionTitle"><div><h2>{title}</h2><p>{description}</p></div><strong>{tasks.length} pedidos</strong></div>
      <div className="orderBoard singleBoard reserveBoard">
        <article><h2>Em acompanhamento</h2>{tasks.map((task) => <OrderCard key={task.id} task={task} onOpen={() => openOrderTask(task)} />)}{!tasks.length && <p className="emptyState">Nenhum pedido nesta reserva.</p>}</article>
      </div>
    </section>
  );
}

function OrderCard({ task, done, onOpen }) {
  return (
    <button className={done ? 'orderCard done' : 'orderCard'} onClick={onOpen}>
      <span className="orderClientLabel">Cliente</span>
      <strong className="orderClientName">{task.clientName || 'Cliente nao informado'}</strong>
      <small>Pedido {task.orderNumber || '-'} · {task.title}</small>
      <em>{task.restrictionStatus} · {task.assignedName}{task.nextProfileName ? ' -> ' + task.nextProfileName : ''}</em>
    </button>
  );
}

function CompactOrder({ task }) {
  return <p className="listLine"><strong>Pedido {task.orderNumber || '-'}</strong><span>{task.clientName} - {task.restrictionStatus}</span></p>;
}

function CalendarView({ personalTasks, clientTasks }) {
  const openPersonal = personalTasks.filter((task) => task.status !== 'Concluida');
  const openOrders = clientTasks.filter((task) => task.status !== 'Concluida');

  return (
    <section className="routeSurface">
      <div className="sectionTitle"><div><h2>Calendario de trabalho</h2><p>Prazos pessoais e pedidos que precisam de acompanhamento.</p></div></div>
      <div className="calendarGrid">
        <article><h2>Atividades com prazo</h2>{openPersonal.map((task) => <TaskCard key={task.id} task={task} />)}{!openPersonal.length && <p className="emptyState">Nenhum prazo pessoal aberto.</p>}</article>
        <article><h2>Pedidos sem finalizar</h2>{openOrders.map((task) => <CompactOrder key={task.id} task={task} />)}{!openOrders.length && <p className="emptyState">Nenhum pedido pendente.</p>}</article>
      </div>
    </section>
  );
}

function ReportsView({ metrics, clientTasks, personalTasks, clients, teamProfiles }) {
  const blockedOrders = clientTasks.filter((task) => task.restrictionStatus && task.restrictionStatus !== 'Sem restricoes' && task.status !== 'Concluida');
  const doneOrders = clientTasks.filter((task) => task.status === 'Concluida');
  const openPersonal = personalTasks.filter((task) => task.status !== 'Concluida');
  const openClientTasks = clientTasks.filter((task) => task.status !== 'Concluida');
  const workload = teamProfiles.map((member) => ({
    ...member,
    personal: openPersonal.filter((task) => task.assignedId === member.id || task.participants?.some((participant) => participant.id === member.id)).length,
    orders: openClientTasks.filter((task) => task.assignedId === member.id).length
  }));

  return (
    <section className="routeSurface">
      <section className="metrics">{metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</section>
      <div className="reportGrid">
        <article><h2>Pedidos com restricao</h2><strong className="largeNumber">{blockedOrders.length}</strong><span>na operacao</span></article>
        <article><h2>Pedidos finalizados</h2><strong className="largeNumber">{doneOrders.length}</strong><span>no fluxo</span></article>
        <article><h2>Atividades abertas</h2><strong className="largeNumber">{openPersonal.length}</strong><span>na agenda</span></article>
        <article><h2>Clientes cadastrados</h2><strong className="largeNumber">{clients.length}</strong><span>ativos na base</span></article>
      </div>
      <div className="reportGrid operationalGrid">
        <article><h2>Carga por colaborador</h2>{workload.map((item) => <p className="listLine" key={item.id}><strong>{item.name}</strong><span>{item.personal} atividades</span></p>)}{!workload.length && <p className="emptyState">Equipe ainda nao carregada.</p>}</article>
        <article><h2>Pedidos parados</h2>{openClientTasks.slice(0, 6).map((task) => <p className="listLine" key={task.id}><strong>{task.clientName}</strong><span>{task.assignedName}</span></p>)}{!openClientTasks.length && <p className="emptyState">Nenhum pedido aberto.</p>}</article>
      </div>
    </section>
  );
}

function ClientCreateForm({ onCreate, onCancel }) {
  const [form, setForm] = useState({ clientCode: '', name: '', cnpj: '', uf: '', segment: '', priority: 'Media', summary: '' });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onCreate(form);
      setForm({ clientCode: '', name: '', cnpj: '', uf: '', segment: '', priority: 'Media', summary: '' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="taskComposer clientComposer" onSubmit={submit}>
      <div><h2>Cadastrar cliente</h2><p>Use o ID interno para localizar rapidamente o cadastro depois.</p></div>
      <div className="taskFormGrid">
        <label>ID do cliente<input value={form.clientCode} onChange={(event) => update('clientCode', event.target.value)} placeholder="Ex.: CLI-1024" /></label>
        <label>Nome<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nome do cliente" required /></label>
        <label>CNPJ opcional<input value={form.cnpj} onChange={(event) => update('cnpj', event.target.value)} placeholder="00.000.000/0000-00" /></label>
        <label>UF<input value={form.uf} onChange={(event) => update('uf', event.target.value.toUpperCase().slice(0, 2))} placeholder="CE" maxLength={2} /></label>
      </div>
      <div className="taskFormGrid">
        <label>Segmento<input value={form.segment} onChange={(event) => update('segment', event.target.value)} placeholder="Distribuidor, varejo..." /></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => update('priority', event.target.value)}><option>Alta</option><option>Media</option><option>Baixa</option></select></label>
        <label>Resumo<input value={form.summary} onChange={(event) => update('summary', event.target.value)} placeholder="Observacao inicial" /></label>
      </div>
      <div className="formActions"><button className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar cliente'}</button><button type="button" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

function ClientWorkspace({ metrics, visibleClients, selectedId, setSelectedId, openClient, openOrderTask, profile, clientTasks }) {
  const [stageFilter, setStageFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const openTasks = clientTasks.filter((task) => task.status !== 'Concluida');
  const normalizedSearch = clientSearch.trim().toLowerCase();
  const searchedClients = visibleClients.filter((client) => {
    if (!normalizedSearch) return true;
    return [client.name, client.clientCode, client.cnpj].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
  });
  const orderGroups = [
    { id: 'pay', title: 'Aguardando pagamento', tasks: openTasks.filter((task) => task.restrictionStatus === 'Aguardando pagamento') },
    { id: 'delivery', title: 'Entrega nao liberada', tasks: openTasks.filter((task) => task.restrictionStatus === 'Nao entregar' || task.restrictionStatus === 'Nao faturar') },
    { id: 'transfer', title: 'Aguardando NF de transferencia', tasks: openTasks.filter((task) => task.restrictionStatus === 'Aguardando NF de transferencia') },
    { id: 'released', title: 'Pedidos liberados para entrega', tasks: openTasks.filter((task) => task.restrictionStatus === 'Sem restricoes') },
    { id: 'tireReserve', title: 'Reserva de pneus', tasks: openTasks.filter((task) => task.restrictionStatus === 'Reserva de pneus') },
    { id: 'stockReserve', title: 'Pedidos sem estoque', tasks: openTasks.filter((task) => task.restrictionStatus === 'Pedido sem estoque') }
  ];
  const visibleOrderGroups = stageFilter === 'all' ? orderGroups : orderGroups.filter((group) => group.id === stageFilter);

  return (
    <section className="clientWorkspaceClean">
      <section className="clientSearchBar">
        <label>Buscar cliente<input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Digite nome, ID ou CNPJ" /></label>
      </section>

      <section className="clientSummaryGrid">
        <button type="button" className={stageFilter === 'all' ? 'summaryCard active' : 'summaryCard'} onClick={() => setStageFilter('all')}><strong>Clientes cadastrados</strong><em>{visibleClients.length}</em></button>
        {orderGroups.map((group) => <button type="button" className={stageFilter === group.id ? 'summaryCard clickable active' : 'summaryCard clickable'} key={group.id} onClick={() => setStageFilter(group.id)}><strong>{group.title}</strong><em>{group.tasks.length}</em></button>)}
      </section>

      <section className="orderStageGrid">
        {visibleOrderGroups.map((group) => (
          <article key={group.id}>
            <h2>{group.title} <span>{group.tasks.length}</span></h2>
            {group.tasks.map((task) => <OrderCard key={task.id} task={task} onOpen={() => openOrderTask(task)} />)}
            {!group.tasks.length && <p className="emptyState">Nada nesta etapa.</p>}
          </article>
        ))}
      </section>

      <section className="clientListPanel">
        <div className="sectionTitle compact"><div><h2>Clientes</h2><p>Lista para localizar por nome, ID ou CNPJ e abrir o cadastro.</p></div><strong>{searchedClients.length}</strong></div>
        <div className="clientList">
          {searchedClients.map((client) => (
            <ClientListRow
              key={client.id}
              client={client}
              profile={profile}
              selected={client.id === selectedId}
              onSelect={() => setSelectedId(client.id)}
              onOpen={() => openClient(client)}
            />
          ))}
          {!searchedClients.length && <p className="emptyState">Nenhum cliente encontrado.</p>}
        </div>
      </section>
    </section>
  );
}

function AgendaView({ profile, currentProfile, teamProfiles, personalTasks, showTaskForm, onCloseTaskForm, onCreate, onComplete, onUpdateStatus, onSaveComment, onRequestExtension, onReviewExtension }) {
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', comments: '', dueDate: '', priority: 'Media', assignedId: currentProfile?.id ?? '', participantIds: [], attachmentUrl: '', attachmentName: '' });
  const canManageAll = profile.id === 'manager';
  const assignableProfiles = canManageAll ? teamProfiles : teamProfiles.filter((item) => item.id === currentProfile?.id);
  const defaultAssignedId = form.assignedId || currentProfile?.id || assignableProfiles[0]?.id || '';
  const filteredTasks = personalTasks.filter((task) => {
    const isParticipant = task.participants?.some((item) => item.id === ownerFilter);
    const matchesOwner = canManageAll && ownerFilter !== 'all' ? task.assignedId === ownerFilter || isParticipant : true;
    const matchesDate = dateFilter ? task.dueDate === dateFilter : true;
    return matchesOwner && matchesDate;
  });
  const columns = buildAgendaColumns(filteredTasks);
  const pendingExtensions = personalTasks.filter((task) => task.extensionStatus === 'Solicitada');

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleParticipant(profileId) {
    setForm((current) => {
      const exists = current.participantIds.includes(profileId);
      return {
        ...current,
        participantIds: exists ? current.participantIds.filter((id) => id !== profileId) : [...current.participantIds, profileId]
      };
    });
  }

  async function submitTask(event) {
    event.preventDefault();
    const assignedId = canManageAll ? defaultAssignedId : currentProfile.id;
    await onCreate({ ...form, assignedId });
    setForm({ title: '', description: '', comments: '', dueDate: '', priority: 'Media', assignedId, participantIds: [], attachmentUrl: '', attachmentName: '' });
    onCloseTaskForm();
  }

  return (
    <section className="agendaView">
      {showTaskForm && (
        <div className="modalBackdrop" onClick={onCloseTaskForm}>
          <form className="taskComposer floatingComposer" onSubmit={submitTask} onClick={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><h2>Nova atividade</h2><p>{canManageAll ? 'Crie para voce, Pablo ou qualquer colaborador.' : 'Crie uma atividade para sua propria agenda.'}</p></div><button type="button" onClick={onCloseTaskForm}><X size={16} /></button></div>
            <label>Titulo<input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Ex.: Revisar credito do cliente" required /></label>
            <label>Observacoes<input value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Contexto rapido" /></label>
            <label>Anexo<input value={form.attachmentUrl} onChange={(event) => updateForm('attachmentUrl', event.target.value)} placeholder="Link do arquivo" /></label>
            <div className="taskFormGrid">
              <label>Prazo<input type="date" value={form.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} /></label>
              <label>Prioridade<select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}><option>Alta</option><option>Media</option><option>Baixa</option></select></label>
              {canManageAll && (
                <label>Responsavel<select value={defaultAssignedId} onChange={(event) => updateForm('assignedId', event.target.value)}>{assignableProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              )}
            </div>
            <fieldset className="participantPicker">
              <legend>Convidados</legend>
              <div>
                {teamProfiles.filter((item) => item.id !== defaultAssignedId).map((item) => (
                  <label key={item.id}><input type="checkbox" checked={form.participantIds.includes(item.id)} onChange={() => toggleParticipant(item.id)} />{item.name}</label>
                ))}
              </div>
            </fieldset>
            <button className="primary">Criar atividade</button>
          </form>
        </div>
      )}

      <section className="agendaControls">
        <label>Calendario<input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
        {dateFilter && <button type="button" onClick={() => setDateFilter('')}>Limpar data</button>}
        {canManageAll && (
          <div className="agendaFilter">
            <span>Ver agenda</span>
            <button type="button" className={ownerFilter === 'all' ? 'active' : ''} onClick={() => setOwnerFilter('all')}>Todos</button>
            {teamProfiles.map((item) => <button type="button" key={item.id} className={ownerFilter === item.id ? 'active' : ''} onClick={() => setOwnerFilter(item.id)}>{item.name}</button>)}
          </div>
        )}
      </section>

      {canManageAll && pendingExtensions.length > 0 && (
        <section className="approvalPanel">
          <div className="sectionTitle compact"><div><h2>Prorrogacoes pendentes</h2><p>Pedidos de prazo aguardando decisao de gestao.</p></div><strong>{pendingExtensions.length}</strong></div>
          <div className="approvalList">
            {pendingExtensions.map((task) => (
              <article key={task.id} className="approvalItem">
                <div><strong>{task.title}</strong><span>{task.assignedName} pediu ate {formatDate(task.extensionDueDate)}</span><p>{task.extensionReason || 'Sem justificativa informada.'}</p></div>
                <div className="approvalActions"><button type="button" onClick={() => onReviewExtension(task.id, 'approved')}>Aprovar</button><button type="button" className="dangerAction" onClick={() => onReviewExtension(task.id, 'rejected')}>Recusar</button></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="agendaColumns coloredColumns">
        {columns.map((column) => (
          <article key={column.id} className={'agendaColumn ' + column.id}>
            <h2>{column.label} <span>{column.tasks.length}</span></h2>
            {column.tasks.map((task) => <TaskCard key={task.id} task={task} canComplete canReviewExtension={canManageAll} onComplete={() => onComplete(task.id)} onUpdateStatus={onUpdateStatus} onSaveComment={onSaveComment} onRequestExtension={onRequestExtension} onReviewExtension={onReviewExtension} />)}
            {!column.tasks.length && <p className="emptyState">Nada por aqui.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function buildAgendaColumns(tasks) {
  const notDone = tasks.filter((task) => task.status !== 'Concluida');
  return [
    { id: 'new', label: 'Novas', tasks: notDone.filter((task) => task.status === 'A fazer' && !isOverdue(task)) },
    { id: 'doing', label: 'Em andamento', tasks: notDone.filter((task) => task.status === 'Em andamento' && !isOverdue(task)) },
    { id: 'late', label: 'Atrasadas', tasks: notDone.filter(isOverdue) },
    { id: 'done', label: 'Finalizadas', tasks: tasks.filter((task) => task.status === 'Concluida') }
  ];
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'Concluida') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + 'T00:00:00');
  return due < today;
}

function dueText(task) {
  if (!task.dueDate) return 'Sem prazo';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + 'T00:00:00');
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return 'Atrasada ha ' + Math.abs(days) + ' dia(s)';
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanha';
  return days + ' dias restantes';
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value + 'T00:00:00').toLocaleDateString('pt-BR');
}

function TaskCard({ task, canComplete, canReviewExtension, onComplete, onUpdateStatus, onSaveComment, onRequestExtension, onReviewExtension }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState(task.comments ?? '');
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDueDate, setExtensionDueDate] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [savingExtension, setSavingExtension] = useState(false);
  const [savedComment, setSavedComment] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const hasExtraInfo = Boolean(task.description || task.comments || task.extensionStatus || task.attachmentUrl || task.participants?.length);

  useEffect(() => {
    setComment(task.comments ?? '');
    setSavedComment(false);
    setExtensionReason(task.extensionReason ?? '');
    setExtensionDueDate(task.extensionDueDate ?? '');
  }, [task.id, task.comments, task.extensionReason, task.extensionDueDate]);

  async function saveComment(event) {
    event.preventDefault();
    setSavingComment(true);
    setSavedComment(false);
    try {
      await onSaveComment(task.id, comment);
      setSavedComment(true);
      setCommentOpen(false);
      setExpanded(true);
    } finally {
      setSavingComment(false);
    }
  }

  async function saveExtensionRequest(event) {
    event.preventDefault();
    setSavingExtension(true);
    try {
      await onRequestExtension(task.id, extensionDueDate, extensionReason);
      setExtensionOpen(false);
      setExpanded(true);
    } finally {
      setSavingExtension(false);
    }
  }

  return (
    <div className={task.status === 'Concluida' ? 'taskCard done' : isOverdue(task) ? 'taskCard overdue' : task.status === 'Em andamento' ? 'taskCard doing' : 'taskCard'}>
      <div className="taskCardHead">
        <strong>{task.title}</strong>
        <span>Responsavel: {task.assignedName}</span>
        <span>Prazo: {dueText(task)}</span>
        <span>Prioridade: {task.priority}</span>
      </div>

      <div className="taskCardSummary">
        <span>Status: {task.status}</span>
        {task.participants?.length > 0 && <span>Convidados: {task.participants.length}</span>}
        {task.comments && <span>Comentario registrado</span>}
        {task.extensionStatus && <span>Prorrogacao solicitada</span>}
      </div>

      <button type="button" className="expandTaskButton" onClick={() => setExpanded((current) => !current)}>
        {expanded ? 'Ver menos' : hasExtraInfo ? 'Ver mais' : 'Expandir'}
      </button>

      {expanded && (
        <div className="taskCardDetails">
          {task.description && <p>{task.description}</p>}
          {task.participants?.length > 0 && <p className="participantLine">Com: {task.participants.map((item) => item.name).join(', ')}</p>}
          {task.comments && <p className="commentPreview">{task.comments}</p>}
          {task.extensionStatus && <p className="extensionNotice">Prorrogacao {task.extensionStatus.toLowerCase()}{task.extensionDueDate ? ' para ' + formatDate(task.extensionDueDate) : ''}: {task.extensionReason || 'sem justificativa informada'}</p>}
          {canReviewExtension && task.extensionStatus === 'Solicitada' && <div className="approvalActions inlineApproval"><button type="button" onClick={() => onReviewExtension(task.id, 'approved')}>Aprovar prazo</button><button type="button" className="dangerAction" onClick={() => onReviewExtension(task.id, 'rejected')}>Recusar</button></div>}
          {task.attachmentUrl && <a className="attachmentLink" href={task.attachmentUrl} target="_blank" rel="noreferrer">{task.attachmentName || 'Abrir anexo'}</a>}
          {onUpdateStatus && <label className="statusControl">Status<select value={task.status} onChange={(event) => onUpdateStatus(task.id, event.target.value)}><option>A fazer</option><option>Em andamento</option><option>Concluida</option></select></label>}
          {onSaveComment && <div className="commentActions"><button type="button" onClick={() => setCommentOpen(true)}>{task.comments ? 'Editar comentario' : 'Comentar'}</button>{savedComment && <span>Comentario salvo</span>}</div>}
          {onRequestExtension && task.status !== 'Concluida' && <button type="button" className="extensionButton" onClick={() => setExtensionOpen(true)}>Solicitar prorrogacao</button>}
          {canComplete && task.status !== 'Concluida' && <button type="button" className="completeButton" onClick={onComplete}><CheckCircle2 size={14} />Finalizar</button>}
        </div>
      )}

      {commentOpen && (
        <div className="modalBackdrop commentBackdrop" onClick={() => setCommentOpen(false)}>
          <form className="commentModal" onSubmit={saveComment} onClick={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><h2>Comentario</h2><p>{task.title}</p></div><button type="button" onClick={() => setCommentOpen(false)}><X size={16} /></button></div>
            <label>Observacao<textarea value={comment} onChange={(event) => { setComment(event.target.value); setSavedComment(false); }} placeholder="Escreva uma observacao sobre esta atividade" autoFocus /></label>
            <div className="modalActions"><button type="button" onClick={() => setCommentOpen(false)}>Cancelar</button><button className="primary" disabled={savingComment}>{savingComment ? 'Enviando...' : 'Enviar comentario'}</button></div>
          </form>
        </div>
      )}
      {extensionOpen && (
        <div className="modalBackdrop commentBackdrop" onClick={() => setExtensionOpen(false)}>
          <form className="commentModal" onSubmit={saveExtensionRequest} onClick={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><h2>Solicitar prorrogacao</h2><p>{task.title}</p></div><button type="button" onClick={() => setExtensionOpen(false)}><X size={16} /></button></div>
            <label>Novo prazo<input type="date" value={extensionDueDate} onChange={(event) => setExtensionDueDate(event.target.value)} required /></label>
            <label>Justificativa<textarea value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} placeholder="Explique o motivo da prorrogacao" required autoFocus /></label>
            <div className="modalActions"><button type="button" onClick={() => setExtensionOpen(false)}>Cancelar</button><button className="primary" disabled={savingExtension}>{savingExtension ? 'Enviando...' : 'Enviar solicitacao'}</button></div>
          </form>
        </div>
      )}
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

function ClientListRow({ client, profile, selected, onSelect, onOpen }) {
  const flags = getVisibleFlags(client, profile);
  const mainFlag = flags[0] || 'Sem restricoes';

  return (
    <button type="button" className={selected ? 'clientListRow selected' : 'clientListRow'} onClick={() => { onSelect(); onOpen(); }}>
      <span>{client.clientCode || 'Sem ID'}</span>
      <strong>{client.name}</strong>
      <em>{client.cnpj || 'CNPJ nao informado'}</em>
      <small>{client.uf ? client.uf + ' · ' : ''}{client.priority} · {client.health} · {mainFlag}</small>
    </button>
  );
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

function ClientPanel({ client, profile, clientTasks, teamProfiles, onCreateClientTask, selectedTask, selectedTaskEvents, onOpenTask, onCompleteClientTask, onAddClientTaskComment, onApplyClientTaskAction, open, onClose }) {
  const visibleFlags = getVisibleFlags(client, profile);
  if (!open) return null;

  if (selectedTask) {
    return <OrderDetailPage task={selectedTask} client={client} teamProfiles={teamProfiles} events={selectedTaskEvents} onBack={() => onOpenTask(null)} onClose={onClose} onComplete={onCompleteClientTask} onAddComment={onAddClientTaskComment} onApplyAction={onApplyClientTaskAction} />;
  }

  return (
    <section className="detailPage">
      <header className="detailHeader">
        <div><span>Cliente</span><h1>{client.name}</h1><p>{client.clientCode || 'Sem ID'} · {client.cnpj || 'CNPJ nao informado'} · {client.segment}</p></div>
        <button className="closePanel" type="button" onClick={onClose}><X size={18} /></button>
      </header>

      <div className="detailLayout">
        <main className="detailMain">
          <section className="detailBlock highlightBlock">
            <h2>Status operacional</h2>
            <div className="flagList panelFlags">{visibleFlags.length ? visibleFlags.map((flag) => <Flag key={flag} label={flag} />) : <span className="okFlag"><CheckCircle2 size={14} />Sem bloqueios visiveis</span>}</div>
            <p>{client.summary}</p>
          </section>

          <section className="detailBlock">
            <div className="sectionTitle compact"><div><h2>Pedidos e atividades</h2><p>Clique em um pedido para abrir a ficha completa.</p></div><strong>{clientTasks.length}</strong></div>
            <div className="orderListFull">
              {clientTasks.length ? clientTasks.map((task) => <OrderRow key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />) : <p className="emptyState">Nenhum pedido cadastrado para este cliente.</p>}
            </div>
          </section>

          <section className="detailBlock">
            <h2>Novo pedido / atividade</h2>
            <ClientTaskForm client={client} teamProfiles={teamProfiles} onCreate={onCreateClientTask} />
          </section>
        </main>

        <aside className="detailSide">
          <section className="detailBlock"><h2>Dados do cliente</h2><div className="detailGrid"><div><span>ID</span><strong>{client.clientCode || '-'}</strong></div><div><span>CNPJ</span><strong>{client.cnpj || 'Nao informado'}</strong></div><div><span>Prioridade</span><strong>{client.priority}</strong></div><div><span>Saude</span><strong>{client.health}</strong></div><div><span>Limite</span><strong>{profile.canSeeFinancial ? client.creditLimit : 'Restrito'}</strong></div><div><span>Utilizado</span><strong>{profile.canSeeFinancial ? client.usedLimit : 'Restrito'}</strong></div></div></section>
          <section className="detailBlock"><h2>Historico</h2>{client.history.map((item) => <p className="history" key={item}>{item}</p>)}{!client.history.length && <p className="emptyState">Sem historico ainda.</p>}</section>
        </aside>
      </div>
    </section>
  );
}

function OrderRow({ task, onOpen }) {
  return (
    <button className="orderRow" onClick={onOpen}>
      <div><span>Pedido {task.orderNumber || '-'}</span><strong>{task.title}</strong><small>{task.clientName}</small></div>
      <div><em>{task.restrictionStatus}</em><span>{task.assignedName}{task.nextProfileName ? ' -> ' + task.nextProfileName : ''}</span></div>
    </button>
  );
}

function OrderDetailPage({ task, client, teamProfiles, events, onBack, onClose, onComplete, onAddComment, onApplyAction }) {
  const [nextProfileId, setNextProfileId] = useState(task.nextProfileId || '');
  const [forwarding, setForwarding] = useState(false);
  const [comment, setComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const actionButtons = [
    ['payment_confirmed', 'Confirmar pagamento'],
    ['billing_released', 'Liberar faturamento'],
    ['waiting_transfer_nf', 'Aguardar NF transferencia'],
    ['hold_delivery', 'Bloquear entrega']
  ];

  async function handleForward() {
    setForwarding(true);
    try {
      await onComplete(task.id, nextProfileId);
    } finally {
      setForwarding(false);
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setSavingComment(true);
    try {
      await onAddComment(task.id, comment.trim());
      setComment('');
    } finally {
      setSavingComment(false);
    }
  }

  async function applyAction(action) {
    setForwarding(true);
    try {
      await onApplyAction(task.id, action);
    } finally {
      setForwarding(false);
    }
  }

  return (
    <section className="detailPage">
      <header className="detailHeader">
        <div><span>Pedido {task.orderNumber || '-'}</span><h1>{task.title}</h1><p>{client.name} · {task.restrictionStatus}</p></div>
        <div className="detailActions"><button type="button" onClick={onBack}>Voltar ao cliente</button><button className="closePanel" type="button" onClick={onClose}><X size={18} /></button></div>
      </header>

      <div className="detailLayout">
        <main className="detailMain">
          <section className="detailBlock highlightBlock">
            <h2>Resumo do pedido</h2>
            <div className="orderMetaGrid"><div><span>Status</span><strong>{task.status}</strong></div><div><span>Restricao</span><strong>{task.restrictionStatus}</strong></div><div><span>Responsavel atual</span><strong>{task.assignedName}</strong></div><div><span>Proximo</span><strong>{task.nextProfileName || 'Entrega/final'}</strong></div></div>
            {task.notes && <p>{task.notes}</p>}
            {task.attachmentUrl && <a className="attachmentLink" href={task.attachmentUrl} target="_blank" rel="noreferrer">{task.attachmentName || 'Abrir anexo'}</a>}
          </section>

          <section className="detailBlock">
            <h2>Acoes rapidas</h2>
            <div className="guidedActions">
              {actionButtons.map(([id, label]) => <button type="button" key={id} disabled={forwarding} onClick={() => applyAction(id)}>{label}</button>)}
            </div>
          </section>

          <section className="detailBlock conversationBlock">
            <h2>Historico e comentarios</h2>
            <form className="orderCommentForm" onSubmit={submitComment}>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Escreva uma atualizacao sobre este pedido" />
              <button className="primary" disabled={savingComment}>{savingComment ? 'Enviando...' : 'Adicionar comentario'}</button>
            </form>
            <div className="eventTimeline">
              {events.length ? events.map((event) => <EventItem key={event.id} event={event} />) : <p className="emptyState">O historico deste pedido comeca nas proximas movimentacoes.</p>}
            </div>
          </section>
        </main>

        <aside className="detailSide">
          <section className="detailBlock"><h2>Encaminhamento</h2><label className="statusControl">Proximo responsavel<select value={nextProfileId} onChange={(event) => setNextProfileId(event.target.value)}><option value="">Entrega/final</option>{teamProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" className="primary wideButton" disabled={forwarding} onClick={handleForward}>{forwarding ? 'Salvando...' : nextProfileId ? 'Passar para proximo' : 'Encaminhar para entrega'}</button></section>
          <section className="detailBlock"><h2>Cliente</h2><p className="listLine"><strong>{client.name}</strong><span>{client.clientCode || client.segment}</span></p><p className="listLine"><strong>CNPJ</strong><span>{client.cnpj || 'Nao informado'}</span></p></section>
        </aside>
      </div>
    </section>
  );
}

function EventItem({ event }) {
  const date = event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  return (
    <article className={'eventItem ' + event.type}>
      <div><strong>{event.description}</strong><span>{event.authorName} · {date}</span></div>
      {event.comment && <p>{event.comment}</p>}
    </article>
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
      <label>Status<select value={form.restrictionStatus} onChange={(event) => update('restrictionStatus', event.target.value)}><option>Nao entregar</option><option>Aguardando pagamento</option><option>Nao faturar</option><option>Aguardando NF de transferencia</option><option>Sem restricoes</option><option>Reserva de pneus</option><option>Pedido sem estoque</option></select></label>
      <label>Responsavel<select value={form.assignedId} onChange={(event) => update('assignedId', event.target.value)}><option value="">Equipe</option>{teamProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Proximo<select value={form.nextProfileId} onChange={(event) => update('nextProfileId', event.target.value)}><option value="">Entrega/final</option>{teamProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Observacoes<input value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Detalhes importantes" /></label>
      <label>Anexo<input value={form.attachmentUrl} onChange={(event) => update('attachmentUrl', event.target.value)} placeholder="Link do arquivo" /></label>
      <button className="detailsButton">Criar atividade</button>
    </form>
  );
}

function Step({ label, done, active }) {
  return <div className={active ? 'step active' : done ? 'step done' : 'step'}><i />{label}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
