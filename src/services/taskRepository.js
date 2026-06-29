import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

function mapProfile(row) {
  return {
    id: row.id,
    name: row.full_name,
    role: row.role
  };
}

function mapPersonalTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    dueDate: row.due_date ?? '',
    status: row.status,
    priority: row.priority,
    attachmentName: row.attachment_name ?? '',
    attachmentUrl: row.attachment_url ?? '',
    assignedId: row.assigned_profile_id,
    assignedName: row.assigned_profile?.full_name ?? 'Sem responsavel'
  };
}

function mapClientTask(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client?.name ?? 'Cliente',
    title: row.title,
    status: row.status,
    priority: row.priority,
    orderNumber: row.order_number ?? '',
    restrictionStatus: row.restriction_status ?? 'Sem restricoes',
    notes: row.notes ?? '',
    attachmentName: row.attachment_name ?? '',
    attachmentUrl: row.attachment_url ?? '',
    assignedId: row.assigned_profile_id ?? '',
    nextProfileId: row.next_profile_id ?? '',
    currentStep: row.current_step ?? '',
    nextStep: row.next_step ?? '',
    assignedName: row.assigned_profile?.full_name ?? 'Equipe',
    nextProfileName: row.next_profile?.full_name ?? ''
  };
}

export async function loadTeamProfiles() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data.map(mapProfile);
}

export async function loadPersonalTasks() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('personal_tasks')
    .select('id, title, description, due_date, status, priority, attachment_name, attachment_url, assigned_profile_id, assigned_profile:profiles!personal_tasks_assigned_profile_id_fkey(full_name)')
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data.map(mapPersonalTask);
}

export async function createPersonalTask(task) {
  const { error } = await supabase.from('personal_tasks').insert({
    title: task.title,
    description: task.description || null,
    due_date: task.dueDate || null,
    priority: task.priority,
    attachment_name: task.attachmentName || null,
    attachment_url: task.attachmentUrl || null,
    assigned_profile_id: task.assignedId,
    created_by: task.createdBy
  });

  if (error) throw error;
}

export async function completePersonalTask(id) {
  const { error } = await supabase
    .from('personal_tasks')
    .update({ status: 'Concluida' })
    .eq('id', id);

  if (error) throw error;
}

export async function createClientTask(task) {
  const { error } = await supabase.from('client_tasks').insert({
    client_id: task.clientId,
    order_number: task.orderNumber,
    title: task.title,
    assigned_profile_id: task.assignedId || null,
    next_profile_id: task.nextProfileId || null,
    current_step: task.currentStep || null,
    next_step: task.nextStep || null,
    restriction_status: task.restrictionStatus || 'Sem restricoes',
    notes: task.notes || null,
    attachment_name: task.attachmentName || null,
    attachment_url: task.attachmentUrl || null,
    priority: task.priority || 'Media',
    created_by: task.createdBy
  });

  if (error) throw error;
}

export async function completeClientTask(id, nextProfileId = null) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const updates = nextProfileId ? {
    status: 'Em andamento',
    assigned_profile_id: nextProfileId,
    next_profile_id: null,
    current_step: 'Encaminhado',
    next_step: null,
    completed_by: userData.user.id,
    completed_at: new Date().toISOString()
  } : {
    status: 'Concluida',
    completed_by: userData.user.id,
    completed_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('client_tasks')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function loadClientTasks() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('client_tasks')
    .select('id, client_id, order_number, title, status, priority, restriction_status, notes, attachment_name, attachment_url, assigned_profile_id, next_profile_id, current_step, next_step, client:clients!client_tasks_client_id_fkey(name), assigned_profile:profiles!client_tasks_assigned_profile_id_fkey(full_name), next_profile:profiles!client_tasks_next_profile_id_fkey(full_name)')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(mapClientTask);
}
