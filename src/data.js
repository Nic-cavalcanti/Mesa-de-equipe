export const clients = [
  {
    id: 1,
    name: 'Aurora Trading',
    segment: 'Distribuidor',
    owner: 'Natalia',
    initials: 'AT',
    health: 'Atencao',
    priority: 'Alta',
    openProcesses: 4,
    openOrders: 3,
    creditLimit: 'R$ 85.000',
    usedLimit: 'R$ 72.400',
    nextDue: 'Amanha',
    flags: ['Segura entrega', 'Solicita limite'],
    summary: 'Cliente com proposta em aprovacao e limite comercial em revisao. Entrega deve aguardar liberacao financeira.',
    contacts: ['Marina Costa', 'Rafael Lima'],
    processes: [
      { title: 'Atualizar proposta comercial', status: 'A fazer', category: 'Vendas', due: 'Amanha', priority: 'Alta' },
      { title: 'Solicitar aumento de limite', status: 'Em andamento', category: 'Financeiro', due: 'Hoje', priority: 'Alta' },
      { title: 'Validar condicoes de entrega', status: 'Aguardando', category: 'Logistica', due: 'Sexta', priority: 'Media' }
    ],
    orders: [
      { code: 'PED-1048', invoice: 'NF 7821', shipment: '27/06/2026', arrival: '30/06/2026', delivery: '01/07/2026', status: 'Segurar' },
      { code: 'PED-1052', invoice: 'Pendente', shipment: '29/06/2026', arrival: '03/07/2026', delivery: '04/07/2026', status: 'Aguardando limite' }
    ],
    history: ['Natalia marcou Segura entrega', 'Financeiro solicitou limite adicional', 'Proposta atualizada apos reuniao']
  },
  {
    id: 2,
    name: 'Duda Materiais',
    segment: 'Revenda',
    owner: 'Duda',
    initials: 'DM',
    health: 'Estavel',
    priority: 'Media',
    openProcesses: 2,
    openOrders: 1,
    creditLimit: 'R$ 42.000',
    usedLimit: 'R$ 19.800',
    nextDue: 'Sexta-feira',
    flags: ['Nao emite nota fiscal'],
    summary: 'Cliente aguardando conferencia documental antes da emissao de nota fiscal.',
    contacts: ['Paulo Duarte'],
    processes: [
      { title: 'Revisar lista de pendencias do suporte', status: 'Entrada', category: 'Operacao', due: 'Sexta', priority: 'Media' },
      { title: 'Conferir dados fiscais', status: 'Aguardando', category: 'Fiscal', due: 'Hoje', priority: 'Alta' }
    ],
    orders: [
      { code: 'PED-1049', invoice: 'Bloqueada', shipment: '28/06/2026', arrival: '02/07/2026', delivery: '03/07/2026', status: 'Nota bloqueada' }
    ],
    history: ['Fiscal bloqueou emissao da nota', 'Duda solicitou documentos atualizados']
  },
  {
    id: 3,
    name: 'Caio & Cia',
    segment: 'Atacado',
    owner: 'Caio',
    initials: 'CC',
    health: 'Saudavel',
    priority: 'Baixa',
    openProcesses: 1,
    openOrders: 2,
    creditLimit: 'R$ 120.000',
    usedLimit: 'R$ 44.600',
    nextDue: 'Hoje',
    flags: [],
    summary: 'Operacao normal, com pedidos em acompanhamento de entrega.',
    contacts: ['Caio Martins'],
    processes: [
      { title: 'Conferir notas antes do envio', status: 'Em andamento', category: 'Financeiro', due: 'Hoje', priority: 'Media' }
    ],
    orders: [
      { code: 'PED-1051', invoice: 'NF 7834', shipment: 'Hoje', arrival: '29/06/2026', delivery: '30/06/2026', status: 'Em rota' }
    ],
    history: ['Pedido liberado para transporte', 'Nota fiscal conferida']
  }
];

export const team = [
  { name: 'Natalia', role: 'Gestao', load: 86 },
  { name: 'Duda', role: 'Operacao', load: 62 },
  { name: 'Caio', role: 'Financeiro', load: 48 },
  { name: 'Bia', role: 'Marketing', load: 57 },
  { name: 'Leo', role: 'Conteudo', load: 44 }
];
