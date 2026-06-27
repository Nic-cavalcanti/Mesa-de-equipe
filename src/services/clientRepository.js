import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
});

function formatMoney(value) {
  if (value === null || value === undefined) return 'R$ 0';
  return money.format(Number(value));
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function mapClient(row) {
  const activeFlags = (row.client_flags ?? [])
    .filter((item) => item.is_active)
    .map((item) => item.flag);

  return {
    id: row.id,
    name: row.name,
    segment: row.segment ?? 'Cliente',
    owner: row.profiles?.full_name ?? 'Sem responsavel',
    initials: row.initials ?? row.name.slice(0, 2).toUpperCase(),
    health: row.health,
    priority: row.priority,
    openProcesses: row.processes?.length ?? 0,
    openOrders: row.orders?.length ?? 0,
    creditLimit: formatMoney(row.credit_limit),
    usedLimit: formatMoney(row.used_limit),
    nextDue: row.next_due ?? '',
    flags: activeFlags,
    summary: row.summary ?? '',
    contacts: (row.client_contacts ?? []).map((contact) => contact.name),
    processes: (row.processes ?? []).map((process) => ({
      title: process.title,
      status: process.status,
      category: process.category ?? 'Geral',
      due: process.due_text ?? '',
      priority: process.priority
    })),
    orders: (row.orders ?? []).map((order) => ({
      code: order.code,
      invoice: order.invoice ?? 'Pendente',
      shipment: formatDate(order.shipment_forecast),
      arrival: formatDate(order.arrival_forecast),
      delivery: formatDate(order.delivery_date),
      status: order.status
    })),
    history: (row.client_history ?? []).map((entry) => entry.description)
  };
}

export async function loadClientsFromDatabase() {
  if (!isSupabaseConfigured) {
    return { source: 'demo', clients: null, error: null };
  }

  const selectQuery = [
    '*',
    'profiles:owner_profile_id(full_name, role)',
    'client_contacts(name, email, phone)',
    'client_flags(flag, is_active)',
    'processes(title, status, category, due_text, priority)',
    'orders(code, invoice, shipment_forecast, arrival_forecast, delivery_date, status)',
    'client_history(description, created_at)'
  ].join(',');

  const { data, error } = await supabase
    .from('clients')
    .select(selectQuery)
    .order('created_at', { ascending: true });

  if (error) {
    return { source: 'demo', clients: null, error };
  }

  return { source: 'database', clients: data.map(mapClient), error: null };
}
