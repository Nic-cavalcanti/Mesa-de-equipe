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
    currentStep: row.current_step ?? '',
    nextStep: row.next_step ?? '',
    assignedName: row.assigned_profile?.full_name ?? 'Equipe'
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
    .select('id, title, description, due_date, status, priority, assigned_profile_id, assigned_profile:assigned_profile_id(full_name)')
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

export async function completeClientTask(id) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { error } = await supabase
    .from('client_tasks')
    .update({
      status: 'Concluida',
      completed_by: userData.user.id,
      completed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function loadClientTasks() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('client_tasks')
    .select('id, client_id, title, status, priority, current_step, next_step, client:client_id(name), assigned_profile:assigned_profile_id(full_name)')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(mapClientTask);
}
