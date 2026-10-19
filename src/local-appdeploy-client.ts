// Local-only AppDeploy client replacement. Vite loads this only with --mode local.
// Records persist in this browser's localStorage and are never sent to a service.
type RecordItem = Record<string, any>;
const KEY = 'techlipa360-local-demo-v1';

const seedProducts: RecordItem[] = [
  { id: 'demo-a16', name: 'Samsung Galaxy A16', brand: 'Samsung', category: 'Phones', sku: 'DEMO-A16', stock: 5, cashPrice: 18999, deposit: 5000, installmentAmount: 180, installmentTotal: 23999, installmentFrequency: 'Daily', installmentPeriods: 106, supplierCost: 0, imei: '', serialNumber: 'TL360-DEMO-A16', status: 'Available', storage: '128GB', ram: '4GB', camera: '50MP', battery: '5000mAh', network: '4G', condition: 'New', display: '6.7 inch', os: 'Android 14', processor: 'Octa-core', chipset: 'Other', series: 'Galaxy A Series', badges: ['Popular'], createdAt: '2026-10-10T09:00:00Z' },
  { id: 'demo-spark40', name: 'TECNO Spark 40', brand: 'Tecno', category: 'Phones', sku: 'DEMO-SP40', stock: 4, cashPrice: 16499, deposit: 4000, installmentAmount: 155, installmentTotal: 20999, installmentFrequency: 'Daily', installmentPeriods: 110, supplierCost: 0, imei: '', serialNumber: 'TL360-DEMO-SP40', status: 'Available', storage: '128GB', ram: '8GB', camera: '50MP', battery: '5200mAh', network: '4G', condition: 'New', display: '6.67 inch', os: 'Android 15', processor: 'Octa-core', chipset: 'Other', series: 'Tecno Spark', badges: ['New'], createdAt: '2026-10-12T09:00:00Z' },
  { id: 'demo-hot50', name: 'Infinix Hot 50', brand: 'Infinix', category: 'Phones', sku: 'DEMO-H50', stock: 3, cashPrice: 17999, deposit: 4500, installmentAmount: 170, installmentTotal: 22499, installmentFrequency: 'Daily', installmentPeriods: 106, supplierCost: 0, imei: '', serialNumber: 'TL360-DEMO-H50', status: 'Available', storage: '256GB', ram: '8GB', camera: '50MP', battery: '5000mAh', network: '4G', condition: 'New', display: '6.78 inch', os: 'Android 14', processor: 'Octa-core', chipset: 'Other', series: 'Infinix Hot', badges: [], createdAt: '2026-10-14T09:00:00Z' },
  { id: 'demo-redmi-a5', name: 'Redmi A5', brand: 'Redmi', category: 'Phones', sku: 'DEMO-RA5', stock: 0, cashPrice: 11999, deposit: 3000, installmentAmount: 115, installmentTotal: 14999, installmentFrequency: 'Daily', installmentPeriods: 105, supplierCost: 0, imei: '', serialNumber: 'TL360-DEMO-RA5', status: 'Out of stock', storage: '128GB', ram: '4GB', camera: '32MP', battery: '5200mAh', network: '4G', condition: 'New', display: '6.88 inch', os: 'Android 15', processor: 'Octa-core', chipset: 'Other', series: 'Redmi A Series', badges: [], createdAt: '2026-10-16T09:00:00Z' },
  { id: 'demo-a17', name: 'Samsung Galaxy A17', brand: 'Samsung', category: 'Phones', sku: 'DEMO-A17', stock: 2, cashPrice: 22999, deposit: 6500, installmentAmount: 137, installmentTotal: 0, installmentFrequency: 'Daily', installmentPeriods: 0, supplierCost: 0, imei: '', serialNumber: 'TL360-DEMO-A17', status: 'Available', storage: '128GB', ram: '4GB', camera: '50MP', battery: '5000mAh', network: '4G', condition: 'New', display: '6.7 inch', os: 'Android 16', processor: 'Octa-core', chipset: 'Other', series: 'Galaxy A Series', badges: ['Featured'], createdAt: '2026-10-18T09:00:00Z' },
];
const blank = () => ({ products: seedProducts, customers: [], sales: [], contracts: [], payments: [], applications: [], suppliers: [], returns: [] } as Record<string, RecordItem[]>);
const read = () => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); } };
const write = (data: ReturnType<typeof blank>) => localStorage.setItem(KEY, JSON.stringify(data));
const result = (data: any) => ({ data });
const id = () => 'local-' + Math.random().toString(36).slice(2, 10);
const rowsFor = (table: string) => read()[table] || [];

export const api = {
  async get(path: string, params?: Record<string, any>) {
    const data = read();
    if (path === '/api/storefront/products' || path === '/api/products') return result({ items: data.products });
    if (path === '/api/storefront/status') {
      const applications = data.applications
        .filter(a => a.phone === params?.phone && a.idNumber === params?.idNumber)
        .map(a => ({ productName: a.productName, status: a.status, createdAt: a.createdAt }));
      const contracts = data.contracts.filter(c => applications.some(a => a.productName === c.productName));
      return result({ applications, contracts });
    }
    if (path === '/api/customers') return result({ items: data.customers });
    if (path === '/api/sales') return result({ items: data.sales });
    if (path === '/api/contracts') return result({ items: data.contracts });
    if (path === '/api/payments') return result({ items: data.payments });
    if (path === '/api/applications') return result({ items: data.applications });
    if (path === '/api/portfolio') return result({ activeContracts: data.contracts.filter(c => c.status === 'Active').length, overdueContracts: 0, overdueItems: [] });
    if (path === '/api/v6/ops') return result({ communications: { settings: {}, provider: {}, logs: [], sent: 0 } });
    if (path === '/api/me/role') return result({ role: 'owner' });
    if (path === '/api/staff/roles') return result({ items: [{ id: 'local-owner', name: 'Local demo user', email: auth.getUserSync()?.email || '', role: 'owner', status: 'Active' }] });
    if (path === '/api/returns' || path === '/api/suppliers') return result({ items: rowsFor(path.split('/').pop()!) });
    return result({ items: [] });
  },
  async post(path: string, body: RecordItem = {}) {
    const data = read();
    if (path === '/api/staff/check-email') return result({ authorized: Boolean(body.email) });
    if (path === '/api/storefront/applications') {
      const product = data.products.find(p => p.id === body.productId);
      const app = { ...body, id: id(), productName: product?.name || '', status: 'Pending', createdAt: new Date().toISOString() };
      data.applications.unshift(app); write(data); return result(app);
    }
    const approval = path.match(/^\/api\/applications\/([^/]+)\/approve$/);
    if (approval) {
      const app = data.applications.find(a => a.id === approval[1]);
      if (!app || app.status !== 'Pending') return result({ error: 'Application not found or already processed' });
      const product = data.products.find(p => p.id === app.productId);
      if (!product || product.stock <= 0) return result({ error: 'Device is no longer in stock' });
      const customerId = id();
      data.customers.unshift({ id: customerId, name: app.customerName, phone: app.phone, idNumber: app.idNumber, location: app.location || '' });
      data.sales.unshift({ id: id(), customerId, customerName: app.customerName, productId: product.id, productName: product.name, saleType: app.saleType, amount: app.saleType === 'cash' ? product.cashPrice : app.deposit, balance: app.saleType === 'cash' ? 0 : product.installmentTotal - app.deposit, status: app.saleType === 'cash' ? 'Paid' : 'Active', createdAt: new Date().toISOString() });
      let contractId = '';
      if (app.saleType === 'installment') {
        contractId = id();
        data.contracts.unshift({ id: contractId, customerId, customerName: app.customerName, productId: product.id, productName: product.name, deviceIdentifier: product.serialNumber, total: product.installmentTotal, deposit: app.deposit, balance: product.installmentTotal - app.deposit, frequency: product.installmentFrequency || 'Daily', installmentAmount: product.installmentAmount, nextPayment: new Date(Date.now() + 86400000).toISOString().slice(0, 10), status: 'Active' });
      }
      data.products = data.products.map(p => p.id === product.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p);
      data.applications = data.applications.map(a => a.id === approval[1] ? { ...a, status: 'Approved', customerId, contractId } : a);
      write(data); return result({ ok: true });
    }
    const collection = path.match(/^\/api\/(products|customers|sales|contracts|payments|suppliers|returns)$/);
    if (collection) {
      const table = collection[1];
      const item = { ...body, id: id(), createdAt: new Date().toISOString() };
      data[table].unshift(item); write(data); return result({ id: item.id });
    }
    return result({ ok: true, id: id(), status: 'Sent' });
  },
  async delete(path: string) {
    const match = path.match(/^\/api\/(products|customers)\/([^/]+)$/);
    if (match) { const data = read(); data[match[1]] = data[match[1]].filter(x => x.id !== match[2]); write(data); }
    return result({ ok: true });
  },
};

const USER_KEY = KEY + '-user';
export const auth = {
  isSignedIn: () => Boolean(localStorage.getItem(USER_KEY)),
  getUserSync: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  async getUser() { return this.getUserSync(); },
  async signIn() { const user = this.getUserSync(); return { user }; },
  async signOut() { localStorage.removeItem(USER_KEY); },
};
// The normal hosted flow uses OAuth. In local mode, an email is enough to enter
// the demo dashboard so the UI can be explored without external authentication.
const originalPost = api.post.bind(api);
api.post = async (path: string, body: RecordItem = {}) => {
  const response = await originalPost(path, body);
  if (path === '/api/staff/check-email' && body.email) {
    const user = { email: String(body.email).trim().toLowerCase(), name: 'Local demo user' };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return response;
};
