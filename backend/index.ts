import { db, router, json, error, requireAuth, secrets, storage } from '@appdeploy/sdk';

type Product = {
  id?: string;
  name: string; brand: string; category: string; sku: string; stock: number;
  cashPrice: number; deposit: number; installmentAmount: number; installmentTotal: number; installmentFrequency: string; installmentPeriods: number; supplierCost: number; imagePath?: string; pricingUpdatedAt?: string; pricingUpdatedBy?: string;
  supplierId?: string; imei: string; serialNumber: string; status: string;
  storage?: string; ram?: string; camera?: string; battery?: string; network?: string; condition?: string;
  display?: string; os?: string; processor?: string; chipset?: string; series?: string; badges?: string[]; createdAt?: string;
};
type Customer = { name: string; phone: string; idNumber: string; location: string };
type Sale = {
  customerId: string; customerName: string; productId: string; productName: string;
  saleType: 'cash' | 'installment'; amount: number; balance: number; status: string; createdAt: string;
};
type Contract = {
  id?: string;
  customerId?: string; customerName: string; productId?: string; productName: string;
  deviceIdentifier: string; total: number; deposit: number; balance: number; frequency: string;
  installmentAmount: number; nextPayment: string; status: string;
};
type Payment = {
  contractId: string; customerName: string; amount: number; method: string; reference: string; paidAt: string;
};
type Application = {
  customerName: string; phone: string; idNumber: string; location: string; productId: string;
  productName: string; saleType: 'cash' | 'installment'; deposit: number; frequency: string;
  installmentAmount: number; note: string; status: string; createdAt: string;
};
type Supplier = { name: string; phone: string; email: string; location: string; notes: string; status: string };
type ReturnRecord = {
  saleId?: string; contractId?: string; customerName: string; productId?: string;
  productName: string; amount: number; reason: string; status: string; createdAt: string;
};
type AuditEvent = {
  action: string; entity: string; entityId?: string; actorId?: string; actorEmail?: string;
  details: string; createdAt: string;
};

const list = async <T>(table: string) => (await db.list<T>(table, { limit: 500 })).items;
const add = async (table: string, record: Record<string, unknown>) => {
  const [id] = await db.add(table, [record]);
  if (!id) throw new Error('Could not save record');
  return id;
};
const generateInventorySerial = (brand: string) => {
  const safeBrand = String(brand || 'GEN').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const entropy = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
  return 'TL360-' + safeBrand + '-' + date + '-' + entropy;
};
const ROLE_PERMISSIONS: Record<string, string[]> = { owner: ['*'], manager: ['dashboard','products','customers','sales','contracts','payments','applications','reports','operations','communications'], sales: ['dashboard','products:read','customers','sales','applications','reports'], collections: ['dashboard','customers','contracts','payments','applications:read','reports','operations:read','communications:read'], inventory: ['dashboard','products:read','products','suppliers','returns','reports','operations:read'], viewer: ['dashboard','products:read','customers','sales:read','contracts:read','payments:read','applications:read','reports'] };
const routeKey = (ctx: any) => { const path = String(ctx.event?.rawPath || ctx.event?.path || ''); const method = String(ctx.event?.requestContext?.http?.method || ctx.event?.httpMethod || 'GET').toUpperCase(); if (path.includes('/staff/roles')) return 'roles'; if (path.includes('/products')) return method === 'GET' ? 'products:read' : 'products'; if (path.includes('/customers')) return 'customers'; if (path.includes('/sales')) return method === 'GET' ? 'sales:read' : 'sales'; if (path.includes('/contracts')) return method === 'GET' ? 'contracts:read' : 'contracts'; if (path.includes('/payments')) return method === 'GET' ? 'payments:read' : 'payments'; if (path.includes('/applications')) return method === 'GET' ? 'applications:read' : 'applications'; if (path.includes('/suppliers')) return method === 'GET' ? 'suppliers' : 'suppliers'; if (path.includes('/returns')) return method === 'GET' ? 'returns:read' : 'returns'; if (path.includes('/communications')) return method === 'GET' ? 'communications:read' : 'communications'; if (path.includes('/audit') || path.includes('/reminders') || path.includes('/v6/ops')) return 'operations:read'; if (path.includes('/profitability')) return 'reports'; if (path.includes('/portfolio') || path.includes('/customer-statement') || path.includes('/_healthcheck')) return 'dashboard'; return 'dashboard'; };
const SEEDED_STAFF_ADMINS = [
  { email: 'kimdedzooh95@gmail.com', name: 'DEDAN KIM', role: 'owner' },
  { email: 'carolkaburu34@gmail.com', name: 'Carol kaburu', role: 'manager' }
] as const;
const getRole = async (ctx: any) => {
  const users = await list<any>('staff_roles');
  const email = String(ctx.user?.email || '').trim().toLowerCase();
  const seeded = SEEDED_STAFF_ADMINS.find(u => u.email === email);
  let byEmail = users.find(u => String(u.email || '').toLowerCase() === email);
  if (!byEmail && seeded) {
    const id = await add('staff_roles', {
      userId: ctx.user?.userId || '', email, name: seeded.name, role: seeded.role,
      status: 'Active', seeded: true, createdAt: new Date().toISOString()
    });
    byEmail = { id, userId: ctx.user?.userId || '', email, name: seeded.name, role: seeded.role, status: 'Active' };
  }
  if (byEmail) {
    if (!byEmail.userId && ctx.user?.userId) {
      await db.update('staff_roles', [{ id: byEmail.id, record: { ...byEmail, userId: ctx.user.userId, name: byEmail.name || ctx.user?.name || '' } }]);
    }
    return byEmail.role;
  }
  if (!users.length) {
    await add('staff_roles', { userId: ctx.user?.userId || '', email, name: ctx.user?.name || '', role: 'owner', status: 'Active', createdAt: new Date().toISOString() });
    return 'owner';
  }
  return 'viewer';
};
const roleGuard = async (ctx: any) => { const role = await getRole(ctx); if (routeKey(ctx) === 'roles' && role !== 'owner') return error('Owner permission required', 403); const record = (await db.list<any>('staff_roles',{limit:500})).items.find(u => String(u.email||'').toLowerCase() === String(ctx.user?.email||'').toLowerCase()); if (record?.status === 'Inactive') return error('Staff account is inactive',403); const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer; const key = routeKey(ctx); if (allowed.includes('*') || allowed.includes(key) || allowed.includes(key.split(':')[0])) { ctx.user = { ...ctx.user, role }; return; } return error('Your staff role does not have permission for this action', 403); };
const protectedRoutes = [requireAuth(), roleGuard];
const audit = async (ctx: any, action: string, entity: string, entityId: string | undefined, details: string) => {
  await add('audit_log', {
    action, entity, entityId: entityId || '', actorId: ctx.user?.userId || '',
    actorEmail: ctx.user?.email || '', details, createdAt: new Date().toISOString()
  });
};
const resolveProductImageUrls = async (products: Product[]) => {
  const stored = await storage.list({ prefix: 'product-images/', limit: 500 });
  const paths = products.map(p => p.imagePath || stored.paths.find(path => path.startsWith('product-images/' + p.id + '.')) || '').filter(Boolean);
  const signed = paths.length ? await storage.url(paths) : [];
  return products.map(p => {
    const path = p.imagePath || stored.paths.find(item => item.startsWith('product-images/' + p.id + '.')) || '';
    return { ...p, imagePath: path, imageUrl: signed.find(item => item.path === path)?.url || '' };
  });
};
const normalizePhone = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('7')) return '254' + digits;
  return digits;
};
const secretStatus = async () => {
  const names = await secrets.listSecretNames();
  const required = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL'];
  return {
    configured: required.every(name => names.includes(name)),
    names: required.filter(name => names.includes(name)),
    missing: required.filter(name => !names.includes(name))
  };
};
const darajaBase = async () => {
  const names = await secrets.listSecretNames();
  return names.includes('MPESA_ENV') && (await secrets.readSecret('MPESA_ENV')).toLowerCase() === 'production'
    ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
};
const getMpesaToken = async () => {
  const key = await secrets.readSecret('MPESA_CONSUMER_KEY');
  const secret = await secrets.readSecret('MPESA_CONSUMER_SECRET');
  const basic = btoa(key + ':' + secret);
  const response = await fetch((await darajaBase()) + '/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: 'Basic ' + basic }
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.errorMessage || 'Could not authenticate with M-Pesa');
  return data.access_token as string;
};
const timestamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getUTCFullYear().toString() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
};
const addDaysToDate = (dateValue: string, days: number) => {
  const d = new Date(dateValue + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const advanceNextPayment = (contract: Contract) => {
  const days = contract.frequency === 'Daily' ? 1 : contract.frequency === 'Weekly' ? 7 : 30;
  const todayValue = new Date().toISOString().slice(0, 10);
  const base = contract.nextPayment && contract.nextPayment >= todayValue ? contract.nextPayment : todayValue;
  return addDaysToDate(base, days);
};
const getCustomerPhone = async (contract: Contract) => {
  if (contract.customerId) {
    const [customer] = await db.get<Customer>('customers', [contract.customerId]);
    if (customer?.phone) return normalizePhone(customer.phone);
  }
  const customer = (await list<Customer>('customers')).find(c => c.name === contract.customerName);
  return normalizePhone(customer?.phone || '');
};
const communicationStatus = async () => {
  const names = await secrets.listSecretNames();
  return {
    sms: names.includes('AT_API_KEY') && names.includes('AT_USERNAME'),
    whatsapp: names.includes('WHATSAPP_API_URL') && names.includes('WHATSAPP_TOKEN'),
    senderId: names.includes('AT_SENDER_ID'),
    missingSms: ['AT_API_KEY', 'AT_USERNAME'].filter(n => !names.includes(n)),
    missingWhatsApp: ['WHATSAPP_API_URL', 'WHATSAPP_TOKEN'].filter(n => !names.includes(n))
  };
};
const communicationSettings = async () => {
  const { items } = await db.list<any>('communication_settings', { limit: 1 });
  const [saved] = items;
  return saved || { defaultChannel: 'SMS', overdueEnabled: true, dueSoonEnabled: true, paymentConfirmationEnabled: true };
};
const sendSms = async (phone: string, message: string) => {
  const names = await secrets.listSecretNames();
  if (!names.includes('AT_API_KEY') || !names.includes('AT_USERNAME')) throw new Error('SMS provider is not configured');
  const env = names.includes('AT_ENV') ? await secrets.readSecret('AT_ENV') : 'production';
  const endpoint = env.toLowerCase() === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';
  const form = new URLSearchParams();
  form.set('username', await secrets.readSecret('AT_USERNAME'));
  form.set('to', phone);
  form.set('message', message);
  if (names.includes('AT_SENDER_ID')) form.set('from', await secrets.readSecret('AT_SENDER_ID'));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apiKey: await secrets.readSecret('AT_API_KEY'), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error('SMS provider error: ' + responseText.slice(0, 240));
  return responseText.slice(0, 500);
};
const sendWhatsApp = async (phone: string, message: string) => {
  const names = await secrets.listSecretNames();
  if (!names.includes('WHATSAPP_API_URL') || !names.includes('WHATSAPP_TOKEN')) throw new Error('WhatsApp provider is not configured');
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message }
  };
  if (names.includes('WHATSAPP_FROM')) body.from = await secrets.readSecret('WHATSAPP_FROM');
  const response = await fetch(await secrets.readSecret('WHATSAPP_API_URL'), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await secrets.readSecret('WHATSAPP_TOKEN'), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error('WhatsApp provider error: ' + responseText.slice(0, 240));
  return responseText.slice(0, 500);
};
const sendCustomerCommunication = async (contract: Contract, type: string, message: string, channel?: string) => {
  const phone = await getCustomerPhone(contract);
  if (!phone) throw new Error('Customer phone number is missing');
  const settings = await communicationSettings();
  const selected = channel || settings.defaultChannel || 'SMS';
  const channels = selected === 'Both' ? ['SMS', 'WhatsApp'] : [selected];
  const results: Array<{ channel: string; status: string; error?: string }> = [];
  for (const current of channels) {    try {
      if (current === 'WhatsApp') await sendWhatsApp(phone, message);
      else await sendSms(phone, message);
      results.push({ channel: current, status: 'Sent' });
    } catch (e) {
      results.push({ channel: current, status: 'Failed', error: e instanceof Error ? e.message : 'Send failed' });
    }
  }
  const overall = results.some(r => r.status === 'Sent') ? 'Sent' : 'Failed';
  await add('communication_log', {
    contractId: contract.id || '', customerName: contract.customerName, phone, type,
    channel: selected, status: overall, results, message, createdAt: new Date().toISOString()
  });
  return { status: overall, results };
};
const buildPaymentMessage = (contract: Contract, amount: number, reference: string) => {
  const account = 'TL360-' + String(contract.id || '').slice(0, 12);
  const remaining = Math.max(Number(contract.balance || 0) - amount, 0);
  const next = remaining > 0 ? advanceNextPayment(contract) : 'Completed';
  return 'TechLipa360 payment received. ' + contract.productName + ': KSh ' + amount.toLocaleString('en-KE') +
    ' received. Receipt: ' + (reference || 'Pending reference') + '. Balance: KSh ' + remaining.toLocaleString('en-KE') +
    '. Next payment: ' + next + '. Pay via M-Pesa PayBill MPESA_SHORTCODE, Account ' + account + '.';
};
const runReminderSweep = async (mode: 'overdue' | 'dueSoon') => {
  const settings = await communicationSettings();
  if ((mode === 'overdue' && settings.overdueEnabled === false) || (mode === 'dueSoon' && settings.dueSoonEnabled === false)) return { processed: 0 };
  const contracts = (await list<Contract>('contracts')).filter(c => c.status === 'Active' && Number(c.balance || 0) > 0);
  const todayValue = new Date().toISOString().slice(0, 10);
  const soon = addDaysToDate(todayValue, 3);
  const matches = mode === 'overdue'
    ? contracts.filter(c => c.nextPayment && c.nextPayment < todayValue)
    : contracts.filter(c => c.nextPayment && c.nextPayment >= todayValue && c.nextPayment <= soon);
  const logs = await list<any>('communication_log');
  let processed = 0;
  for (const contract of matches.slice(0, 100)) {
    const type = mode === 'overdue' ? 'overdue-reminder' : 'due-soon-reminder';
    const already = logs.some(l => l.contractId === contract.id && l.type === type && String(l.createdAt || '').slice(0, 10) === todayValue && l.status === 'Sent');
    if (already) continue;
    const dueText = mode === 'overdue' ? 'is overdue' : 'is due soon';
    const message = 'Hello ' + contract.customerName + ', your TechLipa360 Lipa Mdogo payment for ' + contract.productName +
      ' ' + dueText + '. Amount: KSh ' + Number(contract.installmentAmount || 0).toLocaleString('en-KE') +
      '. Balance: KSh ' + Number(contract.balance || 0).toLocaleString('en-KE') +
      '. Due date: ' + contract.nextPayment + '. Pay via M-Pesa PayBill MPESA_SHORTCODE, Account TL360-' + String(contract.id || '').slice(0, 12) + '. Thank you.';
    try {
      const result = await sendCustomerCommunication(contract, type, message);
      if (result.status === 'Sent') processed++;
    } catch (e) {
      console.warn('Reminder send failed', e);
    }
  }
  return { processed };
};

export const handler = router({
  'GET /api/storefront/products': [async () => { const products = (await list<Product>('products')).filter(p => p.status !== 'Inactive' && p.status !== 'Archived'); const items = await resolveProductImageUrls(products); return json({ items }); }],
  'POST /api/storefront/applications': [async ({ body }) => {
    const b = body as Partial<Application>;
    if (!b.customerName || !b.phone || !b.idNumber || !b.productId || !b.saleType) return error('Name, phone, ID, device and sale type are required', 400);
    const [p] = await db.get<Product>('products', [b.productId]);
    if (!p || p.stock <= 0) return error('Selected device is no longer available', 409);
    const deposit = Number(b.deposit || 0);
    if (b.saleType === 'installment' && (deposit <= 0 || deposit >= p.installmentTotal)) return error('Enter a valid deposit below the Lipa Mdogo total', 400);
    const id = await add('applications', {
      customerName: b.customerName, phone: b.phone, idNumber: b.idNumber, location: b.location || '',
      productId: b.productId, productName: p.name, saleType: b.saleType, deposit,
      frequency: b.saleType === 'installment' ? (p.installmentFrequency || 'Monthly') : '', installmentAmount: b.saleType === 'installment' ? Math.round((Number(p.installmentAmount || ((p.installmentTotal - p.deposit) / Math.max(Number(p.installmentPeriods || 1), 1))) * 100)) / 100 : 0,
      note: b.note || '', status: 'Pending', createdAt: new Date().toISOString()
    });
    return json({ id, status: 'Pending' }, 201);
  }],
  'GET /api/storefront/status': [async ({ query }) => {
    if (!query.phone || !query.idNumber) return error('Phone and ID number are required', 400);
    const apps = (await list<Application>('applications')).filter(a => a.phone === query.phone && a.idNumber === query.idNumber);
    const contracts = (await list<Contract>('contracts')).filter(c => apps.some(a => a.customerName === c.customerName));
    return json({
      applications: apps.map(a => ({ productName: a.productName, status: a.status, createdAt: a.createdAt })),
      contracts: contracts.map(c => ({ productName: c.productName, balance: c.balance, nextPayment: c.nextPayment, status: c.status, frequency: c.frequency }))
    });
  }],
  'GET /api/_healthcheck': [...protectedRoutes, async () => json({ message: 'Success' })],
  'POST /api/staff/check-email': [async (ctx) => { const b = ctx.body as any; const email = String(b?.email || '').trim().toLowerCase(); if (!email || !email.includes('@')) return error('A valid email is required',400); const users = await list<any>('staff_roles'); const seeded = SEEDED_STAFF_ADMINS.find(u => u.email === email); const record = users.find(u => String(u.email || '').trim().toLowerCase() === email); const authorized = Boolean((record ? String(record.status || 'Active') === 'Active' : false) || seeded); return json({ authorized }); }],  'GET /api/me/role': [requireAuth(), async (ctx) => { const role = await getRole(ctx); return json({ role, permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer, email: ctx.user?.email || '', name: ctx.user?.name || '' }); }],
  'GET /api/staff/roles': [requireAuth(), roleGuard, async () => { const users = await list<any>('staff_roles'); return json({ items: users.map(u => ({ id: u.id, userId: u.userId, email: u.email, name: u.name, role: u.role, status: u.status || 'Active', createdAt: u.createdAt })) }); }],
  'POST /api/staff/roles': [requireAuth(), roleGuard, async (ctx) => { const b = ctx.body as any; const roles = ['owner','manager','sales','collections','inventory','viewer']; const role = String(b.role || 'viewer'); if (!b.email || !roles.includes(role)) return error('Email and a valid role are required',400); const email = String(b.email).trim().toLowerCase(); const users = await list<any>('staff_roles'); if (users.some(u => String(u.email||'').toLowerCase() === email)) return error('A staff account for this email already exists',409); const id = await add('staff_roles',{userId:'',email,name:b.name||'',role,status:'Active',createdAt:new Date().toISOString()}); await audit(ctx,'ASSIGN_ROLE','staff',id,'Staff role assigned: '+role+' to '+email); return json({id,role},201); }],
  'POST /api/staff/roles/:id': [requireAuth(), roleGuard, async (ctx) => { const [u] = await db.get<any>('staff_roles',[ctx.params.id]); if(!u) return error('Staff account not found',404); const roles=['owner','manager','sales','collections','inventory','viewer']; const role=String((ctx.body as any)?.role||''); if(!roles.includes(role)) return error('Invalid role',400); if(String(u.email).toLowerCase()===String(ctx.user?.email||'').toLowerCase() && role!=='owner') return error('You cannot remove your own owner role',400); await db.update('staff_roles',[{id:ctx.params.id,record:{...u,role}}]); await audit(ctx,'CHANGE_ROLE','staff',ctx.params.id,'Staff role changed to '+role); return json({updated:true}); }],
  'POST /api/staff/roles/:id/status': [requireAuth(), roleGuard, async (ctx) => { const [u] = await db.get<any>('staff_roles',[ctx.params.id]); if(!u) return error('Staff account not found',404); if(String(u.email).toLowerCase()===String(ctx.user?.email||'').toLowerCase()) return error('You cannot deactivate your own account',400); const status=String((ctx.body as any)?.status||'Inactive'); if(!['Active','Inactive'].includes(status)) return error('Invalid status',400); await db.update('staff_roles',[{id:ctx.params.id,record:{...u,status}}]); await audit(ctx,status==='Active'?'ACTIVATE_STAFF':'DEACTIVATE_STAFF','staff',ctx.params.id,'Staff account status changed to '+status); return json({updated:true}); }],

  'GET /api/applications': [...protectedRoutes, async () => json({ items: await list<Application>('applications') })],
  'POST /api/applications/:id/approve': [...protectedRoutes, async (ctx) => {
    const [a] = await db.get<Application>('applications', [ctx.params.id]);
    if (!a) return error('Application not found', 404);
    if (a.status !== 'Pending') return error('Application is already processed', 409);
    const [p] = await db.get<Product>('products', [a.productId]);
    if (!p || p.stock <= 0) return error('Device is no longer in stock', 409);
    const customerId = await add('customers', { name: a.customerName, phone: a.phone, idNumber: a.idNumber, location: a.location });
    const saleId = await add('sales', {
      customerId, customerName: a.customerName, productId: a.productId, productName: p.name,
      saleType: a.saleType, amount: a.saleType === 'cash' ? p.cashPrice : a.deposit,
      balance: a.saleType === 'cash' ? 0 : p.installmentTotal - a.deposit,
      status: a.saleType === 'cash' ? 'Paid' : 'Active', createdAt: new Date().toISOString()
    });
    let contractId: string | null = null;
    if (a.saleType === 'installment') contractId = await add('contracts', {
      customerId, customerName: a.customerName, productId: a.productId, productName: p.name,
      deviceIdentifier: p.imei || p.serialNumber || p.sku, total: p.installmentTotal, deposit: a.deposit,
      balance: p.installmentTotal - a.deposit, frequency: p.installmentFrequency || 'Monthly',
      installmentAmount: Math.round((Number(p.installmentAmount || ((p.installmentTotal - p.deposit) / Math.max(Number(p.installmentPeriods || 1), 1))) * 100)) / 100,
      nextPayment: new Date(Date.now() + 86400000).toISOString().slice(0, 10), status: 'Active'
    });
    const [stockSaved] = await db.update('products', [{ id: a.productId, record: { ...p, stock: Math.max(p.stock - 1, 0) } }]); if (!stockSaved) return error('Application approved but stock update failed. Contact an administrator.', 500);
    await db.update('applications', [{ id: ctx.params.id, record: { ...a, status: 'Approved', customerId, saleId, contractId } }]);
    await audit(ctx, 'APPROVE', 'application', ctx.params.id, 'Application approved and sale workflow created');
    return json({ approved: true, customerId, contractId });
  }],
  'GET /api/products': [...protectedRoutes, async (ctx) => { const products = (await list<Product>('products')).filter(p => p.status !== 'Archived'); const hydrated = []; for (const p of products) { if (!p.serialNumber) { const serial = generateInventorySerial(p.brand || 'GEN'); await db.update('products', [{ id: p.id, record: { ...p, serialNumber: serial, imei: '' } }]); await audit(ctx, 'UPDATE', 'product', p.id, 'Automatic inventory serial assigned'); hydrated.push({ ...p, serialNumber: serial, imei: '' }); } else hydrated.push({ ...p, imei: '' }); } const items = await resolveProductImageUrls(hydrated); return json({ items }); }],
  'POST /api/products': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<Product>;
    if (!b.name || Number(b.cashPrice) <= 0) return error('Device name and cash price are required', 400);
    const deposit = Math.max(Number(b.deposit || 0), 0);
    const installmentAmount = Number(b.installmentAmount || 0);
    if (installmentAmount <= 0) return error('Installment amount is required', 400);
    const cashPrice = Number(b.cashPrice);
    if (deposit <= 0 || deposit >= cashPrice) return error('Downpayment must be greater than 0 and below the current price', 400);
    const installmentPeriods = Math.max(1, Math.min(3650, Math.ceil((cashPrice - deposit) / installmentAmount)));
    const installmentTotal = cashPrice;
    const existingProducts = await list<Product>('products');
    const norm = (v:unknown) => String(v || '').trim().toLowerCase().replace(/\s+/g,' ');
    const matching = existingProducts.find(p => p.status !== 'Archived' && norm(p.name) === norm(b.name) && norm(p.brand) === norm(b.brand) && norm(p.storage) === norm(b.storage) && norm(p.ram) === norm(b.ram) && norm(p.condition || 'New') === norm(b.condition || 'New'));
    if (matching) {
      const addedUnits = Number(b.stock);
      if (!Number.isInteger(addedUnits) || addedUnits <= 0) return error('Enter a valid number of units to add', 400);
      const updatedStock = Number(matching.stock || 0) + addedUnits;
      await db.update('products', [{ id: matching.id, record: { ...matching, stock: updatedStock } }]);
      await audit(ctx, 'RESTOCK', 'product', matching.id, 'Added '+addedUnits+' units; stock is now '+updatedStock);
      return json({ id: matching.id, updated: true, stock: updatedStock, message: 'Existing product stock increased; no duplicate listing created' });
    }
    const id = await add('products', {
      name: b.name, brand: b.brand || '', category: b.category || 'Other', sku: b.sku || '',
      stock: Number(b.stock || 0), cashPrice, supplierCost: Number(b.supplierCost || 0),
      supplierId: b.supplierId || '', deposit,
      installmentAmount,
      installmentTotal,
      installmentFrequency: 'Daily',
      installmentPeriods,
      imei: '', serialNumber: generateInventorySerial(String(b.brand || 'GEN')), status: 'Active', imagePath: '',
      storage: String(b.storage || ''), ram: String(b.ram || ''), camera: String(b.camera || ''),
      battery: String(b.battery || ''), network: String(b.network || ''), condition: String(b.condition || 'New'),
      display: String(b.display || ''), os: String(b.os || ''), processor: String(b.processor || ''),
      chipset: String(b.chipset || ''), series: String(b.series || ''),
      badges: Array.isArray(b.badges) ? b.badges.map(x => String(x).trim()).filter(Boolean).slice(0, 8) : [], createdAt: new Date().toISOString(), pricingUpdatedAt: new Date().toISOString(), pricingUpdatedBy: ctx.user?.email || ''
    });
    await audit(ctx, 'CREATE', 'product', id, 'Product added to inventory');
    return json({ id }, 201);
  }],
  'POST /api/products/:id/update': [...protectedRoutes, async (ctx) => { const [product] = await db.get<Product>('products', [ctx.params.id]); if (!product) return error('Product not found', 404); const b = ctx.body as Partial<Product>; if (!b.name || Number(b.stock) < 0) return error('Device name and valid stock are required', 400); const record = { ...product, name: String(b.name).trim(), brand: String(b.brand || ''), category: String(b.category || 'Other'), stock: Number(b.stock || 0), supplierCost: Number(b.supplierCost || 0), storage: String(b.storage || ''), ram: String(b.ram || ''), camera: String(b.camera || ''), battery: String(b.battery || ''), network: String(b.network || ''), condition: String(b.condition || 'New'), display: String(b.display || ''), os: String(b.os || ''), processor: String(b.processor || ''), chipset: String(b.chipset || ''), series: String(b.series || ''), badges: Array.isArray(b.badges) ? b.badges.map(x => String(x).trim()).filter(Boolean).slice(0, 8) : [] }; await db.update('products', [{ id: product.id, record }]); await audit(ctx, 'UPDATE', 'product', product.id, 'Product details edited'); return json({ updated: true, product: record }); }],
  'POST /api/products/:id/status': [...protectedRoutes, async (ctx) => { const [product] = await db.get<Product>('products', [ctx.params.id]); if (!product) return error('Product not found', 404); const status = String((ctx.body as any)?.status || '') === 'Active' ? 'Active' : 'Inactive'; await db.update('products', [{ id: product.id, record: { ...product, status } }]); await audit(ctx, 'UPDATE', 'product', product.id, 'Product status changed to ' + status); return json({ updated: true, status }); }],
  'POST /api/products/:id/delete': [...protectedRoutes, async (ctx) => { const [product] = await db.get<Product>('products', [ctx.params.id]); if (!product) return error('Product not found', 404); const [saved] = await db.update('products', [{ id: ctx.params.id, record: { ...product, status: 'Archived', stock: 0, archivedAt: new Date().toISOString() } }]); if (!saved) return error('Could not remove this product from inventory. Please try again.', 409); await audit(ctx, 'ARCHIVE', 'product', product.id, 'Product and all its units removed from active inventory'); return json({ archived: true, removedUnits: product.stock }); }],
  'POST /api/products/:id/pricing': [...protectedRoutes, async (ctx) => { const [product] = await db.get<Product>('products', [ctx.params.id]); if (!product) return error('Product not found', 404); const b = ctx.body as any; const cashPrice = Number(b?.cashPrice || 0); const deposit = Number(b?.deposit || 0); const installmentAmount = Number(b?.installmentAmount || 0); if (cashPrice <= 0 || deposit <= 0 || deposit >= cashPrice || installmentAmount <= 0) return error('Enter a valid current price, downpayment and daily payment', 400); const installmentPeriods = Math.max(1, Math.min(3650, Math.ceil((cashPrice - deposit) / installmentAmount))); const record = { ...product, cashPrice, deposit, installmentAmount, installmentTotal: cashPrice, installmentFrequency: 'Daily', installmentPeriods, pricingUpdatedAt: new Date().toISOString(), pricingUpdatedBy: ctx.user?.email || '' }; await db.update('products', [{ id: product.id, record }]); await audit(ctx, 'UPDATE', 'product', product.id, 'Weekly pricing updated: price KSh ' + cashPrice + ', downpayment KSh ' + deposit + ', daily payment KSh ' + installmentAmount + ', duration ' + installmentPeriods + ' days'); return json({ updated: true, cashPrice, deposit, installmentAmount, installmentTotal: cashPrice, installmentPeriods, durationDays: installmentPeriods }); }],
  'POST /api/products/:id/image': [...protectedRoutes, async (ctx) => { const b = ctx.body as any; const [product] = await db.get<Product>('products', [ctx.params.id]); if (!product) return error('Product not found', 404); const data = String(b?.data || ''); const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/); if (!match) return error('Use a JPG, PNG or WebP image', 400); if (match[2].length > 7000000) return error('Image is too large. Choose a smaller image.', 413); const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg'; const path = 'product-images/' + ctx.params.id + '.' + ext; const ok = await storage.write([{ path, content: match[2], contentType: match[1] }]); if (!ok[0]) return error('Could not save product image', 500); if (product.imagePath && product.imagePath !== path) await storage.delete([product.imagePath]); const record = { ...product, imagePath: path }; await db.update('products', [{ id: product.id, record }]); const [{ url: imageUrl }] = await storage.url([path]); await audit(ctx, 'UPDATE', 'product', product.id, 'Product image uploaded or replaced'); return json({ imageUrl }); }],
  'DELETE /api/products/:id/image': [...protectedRoutes, async (ctx) => { const [product] = await db.get<Product>('products', [ctx.params.id]); if (!product) return error('Product not found', 404); if (product.imagePath) await storage.delete([product.imagePath]); await db.update('products', [{ id: product.id, record: { ...product, imagePath: '' } }]); await audit(ctx, 'UPDATE', 'product', product.id, 'Product image removed'); return json({ removed: true }); }],
  'GET /api/customers': [...protectedRoutes, async () => json({ items: await list<Customer>('customers') })],
  'POST /api/customers': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<Customer>;
    if (!b.name || !b.phone || !b.idNumber) return error('Name, phone and ID number are required', 400);
    const id = await add('customers', { name: b.name, phone: b.phone, idNumber: b.idNumber, location: b.location || '' });
    await audit(ctx, 'CREATE', 'customer', id, 'Customer account created');
    return json({ id }, 201);
  }],
  'GET /api/sales': [...protectedRoutes, async () => json({ items: await list<Sale>('sales') })],
  'POST /api/sales': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<Sale>;
    if (!b.customerId || !b.productId || !b.saleType) return error('Customer, product and sale type are required', 400);
    const [product] = await db.get<Product>('products', [b.productId]);
    if (!product || Number(product.stock) <= 0) return error('Selected device is out of stock', 409);
    const id = await add('sales', { ...b, createdAt: new Date().toISOString() });
    const [stockSaved] = await db.update('products', [{ id: b.productId, record: { ...product, stock: Math.max(product.stock - 1, 0) } }]);
    if (!stockSaved) return error('Sale recorded but stock could not be updated. Contact an administrator before retrying.', 500);
    await audit(ctx, 'CREATE', 'sale', id, 'Sale recorded and inventory decremented');
    return json({ id }, 201);
  }],
  'GET /api/contracts': [...protectedRoutes, async () => json({ items: await list<Contract>('contracts') })],
  'POST /api/contracts': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<Contract>;
    if (!b.customerName || !b.productName || Number(b.total) <= 0) return error('Customer, device and total are required', 400);
    if (Number(b.deposit || 0) >= Number(b.total)) return error('Deposit must be less than the installment total', 400);
    const id = await add('contracts', { ...b });
    await audit(ctx, 'CREATE', 'contract', id, 'Lipa Mdogo contract created');
    return json({ id }, 201);
  }],
  'GET /api/payments': [...protectedRoutes, async () => json({ items: await list<Payment>('payments') })],
  'GET /api/customer-statement/:customerId': [...protectedRoutes, async ({ params }) => {
    const [customer] = await db.get<Customer>('customers', [params.customerId]);
    if (!customer) return error('Customer not found', 404);
    const sales = (await list<Sale>('sales')).filter(s => s.customerId === params.customerId);
    const contracts = (await list<Contract>('contracts')).filter(c => c.customerId === params.customerId);
    const payments = (await list<Payment>('payments')).filter(p => p.customerName === customer.name);
    return json({
      customer, sales, contracts, payments,
      summary: {
        sales: sales.reduce((n, s) => n + Number(s.amount || 0), 0),
        payments: payments.reduce((n, p) => n + Number(p.amount || 0), 0),
        outstanding: contracts.reduce((n, c) => n + Number(c.balance || 0), 0)
      }
    });
  }],
  'GET /api/profitability': [...protectedRoutes, async () => {
    const products = await list<Product>('products');
    const sales = await list<Sale>('sales');
    const gross = sales.reduce((s, x) => {
      const p = products.find(p => p.name === x.productName);
      return s + (Number(x.amount || 0) - Number(p?.supplierCost || 0));
    }, 0);
    return json({
      grossMarginBase: gross,
      products: products.map(p => ({
        name: p.name, supplierCost: p.supplierCost || 0, cashPrice: p.cashPrice,
        unitMargin: Number(p.cashPrice || 0) - Number(p.supplierCost || 0), stock: p.stock
      }))
    });
  }],
  'GET /api/portfolio': [...protectedRoutes, async () => {
    const contracts = await list<Contract>('contracts');
    const payments = await list<Payment>('payments');
    const todayValue = new Date().toISOString().slice(0, 10);
    const active = contracts.filter(c => c.status === 'Active');
    const overdue = active.filter(c => c.nextPayment && c.nextPayment < todayValue);
    return json({
      today: todayValue, activeContracts: active.length, overdueContracts: overdue.length,
      outstanding: active.reduce((s, c) => s + Number(c.balance || 0), 0),
      collected: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
      overdueItems: overdue.map(c => ({ customerName: c.customerName, productName: c.productName, balance: c.balance, nextPayment: c.nextPayment }))
    });
  }],
  'POST /api/payments': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<Payment>;    if (!b.contractId || Number(b.amount) <= 0) return error('Contract and payment amount are required', 400);
    const [c] = await db.get<Contract>('contracts', [b.contractId]);
    if (!c) return error('Contract not found', 404);
    if (Number(b.amount) > Number(c.balance)) return error('Payment exceeds outstanding balance', 400);
    const id = await add('payments', { ...b, paidAt: b.paidAt || new Date().toISOString().slice(0, 10) });
    const newBalance = Math.max(Number(c.balance) - Number(b.amount), 0);
    const nextPayment = newBalance === 0 ? '' : advanceNextPayment(c);
    await db.update('contracts', [{ id: b.contractId, record: { ...c, balance: newBalance, nextPayment, status: newBalance === 0 ? 'Completed' : 'Active' } }]);
    await audit(ctx, 'CREATE', 'payment', id, 'Manual payment recorded and contract balance reconciled');
    try { if ((await communicationSettings()).paymentConfirmationEnabled !== false) await sendCustomerCommunication({ ...c, balance: newBalance, nextPayment }, 'payment-confirmation', buildPaymentMessage({ ...c, balance: newBalance, nextPayment }, Number(b.amount), String(b.reference || 'Manual payment'))); } catch (e) { console.warn('Payment confirmation message failed', e); }
    return json({ id, newBalance, nextPayment }, 201);
  }],
  'POST /api/contracts/:id/payment': [...protectedRoutes, async ({ params, body }) => {
    return error('Legacy endpoint disabled. Use /api/payments so payment history and balance stay synchronized.', 410);
  }],

  'GET /api/communications': [...protectedRoutes, async () => {
    const [logs, settings, status] = await Promise.all([
      list<any>('communication_log'), communicationSettings(), communicationStatus()
    ]);
    return json({ settings, provider: status, logs: logs.slice().reverse().slice(0, 100) });
  }],
  'POST /api/communications/settings': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as any;
    const channel = String(b.defaultChannel || 'SMS');
    if (!['SMS','WhatsApp','Both'].includes(channel)) return error('Channel must be SMS, WhatsApp or Both', 400);
    const { items } = await db.list<any>('communication_settings', { limit: 1 });
    const [existing] = items;
    const record = {
      defaultChannel: channel,
      overdueEnabled: b.overdueEnabled !== false,
      dueSoonEnabled: b.dueSoonEnabled !== false,
      paymentConfirmationEnabled: b.paymentConfirmationEnabled !== false,
      updatedAt: new Date().toISOString()
    };
    if (existing?.id) await db.update('communication_settings', [{ id: existing.id, record: { ...existing, ...record } }]);
    else await add('communication_settings', record);
    await audit(ctx, 'UPDATE', 'communication_settings', existing?.id, 'Automated customer communication settings updated');
    return json(record);
  }],
  'POST /api/communications/test': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as any;
    if (!b.contractId) return error('Contract is required', 400);
    const [contract] = await db.get<Contract>('contracts', [b.contractId]);
    if (!contract) return error('Contract not found', 404);
    const channel = String(b.channel || (await communicationSettings()).defaultChannel || 'SMS');
    const message = 'TechLipa360 test message for ' + contract.customerName + '. Automated customer communications are connected.';
    const result = await sendCustomerCommunication(contract, 'test-message', message, channel);
    await audit(ctx, 'SEND', 'communication', contract.id, 'Test customer communication sent');
    return json(result);
  }],
  'GET /api/v6/ops': [...protectedRoutes, async () => {
    const [contracts, payments, audits, suppliers, returns, products, sales, applications] = await Promise.all([
      list<Contract>('contracts'), list<Payment>('payments'), list<AuditEvent>('audit_log'),
      list<Supplier>('suppliers'), list<ReturnRecord>('returns'), list<Product>('products'),
      list<Sale>('sales'), list<Application>('applications')
    ]);
    const todayValue = new Date().toISOString().slice(0, 10);
    const dueSoonDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const active = contracts.filter(c => c.status === 'Active');
    const overdue = active.filter(c => c.nextPayment && c.nextPayment < todayValue);
    const dueSoon = active.filter(c => c.nextPayment && c.nextPayment >= todayValue && c.nextPayment <= dueSoonDate);
    const byMethod = payments.reduce<Record<string, number>>((a, p) => {
      a[p.method || 'Other'] = (a[p.method || 'Other'] || 0) + Number(p.amount || 0); return a;
    }, {});
    const mpesaRequests = await list<any>('mpesa_requests');
    const secret = await secretStatus();
    return json({
      mpesa: { ...secret, environment: secret.configured && (await darajaBase()).includes('sandbox') ? 'sandbox' : 'production' },
      reconciliation: {
        recordedPayments: payments.reduce((n, p) => n + Number(p.amount || 0), 0),
        salesAndDeposits: sales.reduce((n, s) => n + Number(s.amount || 0), 0),
        outstanding: active.reduce((n, c) => n + Number(c.balance || 0), 0),
        byMethod,
        mpesaPending: mpesaRequests.filter(r => r.status === 'Pending').length,
        mpesaFailed: mpesaRequests.filter(r => r.status === 'Failed').length,
        mpesaSuccessful: mpesaRequests.filter(r => r.status === 'Completed').length
      },
      communications: { provider: await communicationStatus(), settings: await communicationSettings(), sent: (await list<any>('communication_log')).filter(x => x.status === 'Sent').length, failed: (await list<any>('communication_log')).filter(x => x.status === 'Failed').length },
      reminders: {
        overdue: overdue.map(c => ({ contractId: c.id, customerName: c.customerName, productName: c.productName, phone: '', amount: c.installmentAmount, balance: c.balance, nextPayment: c.nextPayment })),
        dueSoon: dueSoon.map(c => ({ contractId: c.id, customerName: c.customerName, productName: c.productName, amount: c.installmentAmount, balance: c.balance, nextPayment: c.nextPayment }))
      },
      suppliers: suppliers.map(s => ({ ...s, id: (s as any).id })),
      returns: returns.slice().reverse().slice(0, 20),
      audit: audits.slice().reverse().slice(0, 50),
      backup: {
        generatedAt: new Date().toISOString(),
        tables: { products: products.length, customers: (await list<Customer>('customers')).length, sales: sales.length, contracts: contracts.length, payments: payments.length, applications: applications.length, suppliers: suppliers.length, returns: returns.length, auditLog: audits.length },
        secretsExcluded: true,
        status: 'Manifest ready; export/restore should be performed through controlled backup procedures.'
      }
    });
  }],
  'GET /api/reminders/due': [...protectedRoutes, async () => {
    const contracts = await list<Contract>('contracts');
    const todayValue = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return json({
      overdue: contracts.filter(c => c.status === 'Active' && c.nextPayment < todayValue),
      dueSoon: contracts.filter(c => c.status === 'Active' && c.nextPayment >= todayValue && c.nextPayment <= soon)
    });
  }],
  'GET /api/audit': [...protectedRoutes, async () => json({ items: (await list<AuditEvent>('audit_log')).slice().reverse().slice(0, 200) })],
  'GET /api/suppliers': [...protectedRoutes, async () => json({ items: await list<Supplier>('suppliers') })],
  'POST /api/suppliers': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<Supplier>;
    if (!b.name) return error('Supplier name is required', 400);
    const id = await add('suppliers', { name: b.name, phone: b.phone || '', email: b.email || '', location: b.location || '', notes: b.notes || '', status: 'Active' });
    await audit(ctx, 'CREATE', 'supplier', id, 'Supplier created');
    return json({ id }, 201);
  }],
  'GET /api/returns': [...protectedRoutes, async () => json({ items: (await list<ReturnRecord>('returns')).slice().reverse() })],
  'POST /api/returns': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as Partial<ReturnRecord>;
    if (!b.customerName || !b.productName || Number(b.amount) <= 0 || !b.reason) return error('Customer, product, amount and reason are required', 400);
    const id = await add('returns', {
      saleId: b.saleId || '', contractId: b.contractId || '', customerName: b.customerName,
      productId: b.productId || '', productName: b.productName, amount: Number(b.amount),
      reason: b.reason, status: 'Pending review', createdAt: new Date().toISOString()
    });
    if (b.productId) {
      const [p] = await db.get<Product>('products', [b.productId]);
      if (p) await db.update('products', [{ id: b.productId, record: { ...p, stock: Number(p.stock || 0) + 1 } }]);
    }
    await audit(ctx, 'CREATE', 'return', id, 'Return recorded; stock restored when product ID was supplied');
    return json({ id }, 201);
  }],
  'GET /api/staff/me': [...protectedRoutes, async (ctx) => {
    const existing = (await list<any>('staff_profiles')).find(p => p.userId === ctx.user!.userId);
    if (existing) return json(existing);
    const id = await add('staff_profiles', { userId: ctx.user!.userId, email: ctx.user!.email || '', name: ctx.user!.name || '', role: 'manager', status: 'Active', createdAt: new Date().toISOString() });
    return json({ id, userId: ctx.user!.userId, email: ctx.user!.email || '', name: ctx.user!.name || '', role: 'manager', status: 'Active' });
  }],
  'GET /api/mpesa/status': [...protectedRoutes, async () => json(await secretStatus())],
  'POST /api/payments/mpesa/stk': [...protectedRoutes, async (ctx) => {
    const b = ctx.body as { contractId?: string; phone?: string; amount?: number };
    const config = await secretStatus();
    if (!config.configured) return error('M-Pesa is not configured. Add the required Daraja secrets first.', 503);
    if (!b.contractId || !b.phone || Number(b.amount) <= 0) return error('Contract, phone and amount are required', 400);
    const [contract] = await db.get<Contract>('contracts', [b.contractId]);
    if (!contract) return error('Contract not found', 404);
    const amount = Number(b.amount);
    if (amount > Number(contract.balance)) return error('Payment exceeds outstanding balance', 400);
    const shortcode = await secrets.readSecret('MPESA_SHORTCODE');
    const passkey = await secrets.readSecret('MPESA_PASSKEY');
    const callbackUrl = await secrets.readSecret('MPESA_CALLBACK_URL');
    const typeNames = await secrets.listSecretNames();
    const transactionType = typeNames.includes('MPESA_TRANSACTION_TYPE') ? await secrets.readSecret('MPESA_TRANSACTION_TYPE') : 'CustomerPayBillOnline';
    const phone = normalizePhone(b.phone);
    if (!/^2547\d{8}$/.test(phone)) return error('Use a valid Kenyan M-Pesa phone number', 400);
    const stamp = timestamp();
    const password = btoa(shortcode + passkey + stamp);
    const token = await getMpesaToken();
    const response = await fetch((await darajaBase()) + '/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: Number(shortcode), Password: password, Timestamp: stamp,
        TransactionType: transactionType, Amount: Math.floor(amount), PartyA: phone,
        PartyB: Number(shortcode), PhoneNumber: phone, CallBackURL: callbackUrl,
        AccountReference: ('TL360-' + b.contractId).slice(0, 12),
        TransactionDesc: 'TechLipa360 payment'
      })
    });
    const data = await response.json();
    if (!response.ok || !data.CheckoutRequestID) return error(data.errorMessage || data.ResponseDescription || 'M-Pesa STK request failed', 502);
    const id = await add('mpesa_requests', {
      contractId: b.contractId, customerName: contract.customerName, phone, amount,
      checkoutRequestId: data.CheckoutRequestID, merchantRequestId: data.MerchantRequestID || '',
      status: 'Pending', responseDescription: data.ResponseDescription || '', createdAt: new Date().toISOString()
    });
    await audit(ctx, 'CREATE', 'mpesa_request', id, 'M-Pesa STK prompt initiated');
    return json({ id, status: 'Pending', checkoutRequestId: data.CheckoutRequestID, customerMessage: data.CustomerMessage || 'Payment prompt sent to the customer.' }, 201);
  }],
  'POST /api/payments/mpesa/callback': [async (ctx) => {
    const payload = ctx.body as any;
    const cb = payload?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) return json({ ResultCode: 0, ResultDesc: 'Accepted' });
    const requests = await list<any>('mpesa_requests');
    const request = requests.find(r => r.checkoutRequestId === cb.CheckoutRequestID);
    if (!request) return json({ ResultCode: 0, ResultDesc: 'Accepted' });
    const items = cb.CallbackMetadata?.Item || [];
    const metadata = Object.fromEntries(items.map((x: any) => [x.Name, x.Value]));
    const completed = Number(cb.ResultCode) === 0;
    await db.update('mpesa_requests', [{
      id: request.id,
      record: { ...request, status: completed ? 'Completed' : 'Failed', resultCode: cb.ResultCode, resultDesc: cb.ResultDesc, receipt: metadata.MpesaReceiptNumber || '', callbackAt: new Date().toISOString() }
    }]);
    if (completed) {
      const [contract] = await db.get<Contract>('contracts', [request.contractId]);
      if (contract && Number(request.amount) <= Number(contract.balance)) {
        const paymentId = await add('payments', {
          contractId: request.contractId, customerName: request.customerName, amount: Number(request.amount),
          method: 'M-Pesa', reference: metadata.MpesaReceiptNumber || request.checkoutRequestId,
          paidAt: new Date().toISOString().slice(0, 10)
        });
        const newBalance = Math.max(Number(contract.balance) - Number(request.amount), 0);
        const nextPayment = newBalance === 0 ? '' : advanceNextPayment(contract);
        await db.update('contracts', [{ id: request.contractId, record: { ...contract, balance: newBalance, nextPayment, status: newBalance === 0 ? 'Completed' : 'Active' } }]);
        try { if ((await communicationSettings()).paymentConfirmationEnabled !== false) await sendCustomerCommunication({ ...contract, balance: newBalance, nextPayment }, 'payment-confirmation', buildPaymentMessage({ ...contract, balance: newBalance, nextPayment }, Number(request.amount), metadata.MpesaReceiptNumber || request.checkoutRequestId)); } catch (e) { console.warn('M-Pesa confirmation message failed', e); }
        await add('audit_log', {
          action: 'CREATE', entity: 'payment', entityId: paymentId, actorId: 'mpesa-callback',
          actorEmail: '', details: 'Automatic M-Pesa callback payment reconciled', createdAt: new Date().toISOString()
        });
      }
    }
    return json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }]
});
export async function hourlyCommunicationSweep(event: { type: 'cron'; name: string; payload: Record<string, unknown>; scheduledTime: string }) {
  try { await runReminderSweep('overdue'); } catch (e) { console.warn('Hourly communication sweep failed', e); }
  return { statusCode: 200 };
}
export async function dailyCommunicationSweep(event: { type: 'cron'; name: string; payload: Record<string, unknown>; scheduledTime: string }) {
  try { await runReminderSweep('dueSoon'); } catch (e) { console.warn('Daily communication sweep failed', e); }
  return { statusCode: 200 };
}