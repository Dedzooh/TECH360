import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { ArrowLeft, ChevronDown, ChevronRight, Filter, Search, Smartphone, X } from 'lucide-react';

type Product = {
  id: string; name: string; brand: string; category: string; sku: string; stock: number;
  cashPrice: number; deposit: number; installmentAmount: number; installmentTotal: number;
  installmentFrequency: string; installmentPeriods: number; imei: string; serialNumber: string;
  status: string; imageUrl?: string; storage?: string; ram?: string; camera?: string;
  battery?: string; network?: string; condition?: string; display?: string; os?: string;
  processor?: string; chipset?: string; series?: string; badges?: string[]; createdAt?: string;
};

const money = (n: number) => 'KSh ' + Number(n || 0).toLocaleString('en-KE');
const isA17 = (p:Product) => /a17\b/i.test(p.name) && /samsung/i.test(p.brand+' '+p.name);
const a17VariantProduct = (p:Product, ram:'4'|'6'):Product => ({...p,name:'Samsung Galaxy A17 '+ram+'GB / 128GB',ram:ram+'GB',storage:'128GB',deposit:ram==='4'?6500:7500,installmentAmount:ram==='4'?137:147,installmentFrequency:'Daily',installmentPeriods:0,installmentTotal:0});
const supportWhatsApp = '254710495946';
const productHelpUrl = (name?: string) => 'https://wa.me/' + supportWhatsApp + '?text=' + encodeURIComponent(name ? 'Hello TechLipa360, I would like to ask about ' + name + ' and your Cash or Lipa Mdogo options.' : 'Hello TechLipa360, I would like help choosing a device and understanding payment options.');
const deposits = [
  { label: 'Any deposit', min: 0, max: Infinity },
  { label: 'Under KSh 5,000', min: 0, max: 4999 },
  { label: 'KSh 5,000–10,000', min: 5000, max: 10000 },
  { label: 'KSh 10,000–20,000', min: 10000, max: 20000 },
  { label: 'Over KSh 20,000', min: 20001, max: Infinity }
];

export default function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('All');
  const [depositBand, setDepositBand] = useState(0);
  const [maxDeposit, setMaxDeposit] = useState('');
  const [maxInstallment, setMaxInstallment] = useState('');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [frequency, setFrequency] = useState('All');
  const [category, setCategory] = useState('All');
  const [storage, setStorage] = useState('All');
  const [ram, setRam] = useState('All');
  const [network, setNetwork] = useState('All');
  const [condition, setCondition] = useState('All');
  const [display, setDisplay] = useState('All');
  const [os, setOs] = useState('All');
  const [seriesFilter, setSeriesFilter] = useState('All');
  const [priceBand, setPriceBand] = useState('All');
  const [sort, setSort] = useState('Featured');
  const [mode, setMode] = useState<'All'|'Cash'|'Lipa Mdogo'>('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderBudget, setFinderBudget] = useState('');
  const [finderDeposit, setFinderDeposit] = useState('');
  const [finderRam, setFinderRam] = useState('All');
  const [finderStorage, setFinderStorage] = useState('All');
  const [finderNetwork, setFinderNetwork] = useState('All');
  const [selected, setSelected] = useState<Product | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/api/storefront/products')
      .then(r => setProducts(r.data.items || []))
      .catch(() => setToast('Products could not be loaded.'));
  }, []);

  const brands = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort()], [products]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()], [products]);
  const storages = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.storage).filter(Boolean))).sort()], [products]);
  const rams = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.ram).filter(Boolean))).sort()], [products]);
  const networks = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.network).filter(Boolean))).sort()], [products]);
  const displays = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.display).filter(Boolean))).sort()], [products]);
  const operatingSystems = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.os).filter(Boolean))).sort()], [products]);
  const series = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.series).filter(Boolean))).sort()], [products]);
  const shown = useMemo(() => {
    const d = deposits[depositBand];
    const priceRanges: Record<string,[number,number]> = {
      'Under KSh 10,000':[0,9999], 'KSh 10,000–30,000':[10000,30000],
      'KSh 30,000–60,000':[30000,60000], 'Over KSh 60,000':[60001,Infinity]
    };
    const pr = priceRanges[priceBand] || [0,Infinity];
    const filtered = products.filter(p => {
      const text = JSON.stringify(p).toLowerCase();
      const hasLipa = Number(p.installmentAmount || 0) > 0 && Number(p.deposit || 0) > 0;
      const matchesMode = hasLipa || isA17(p);
      return matchesMode && text.includes(q.toLowerCase()) &&
        (brand === 'All' || p.brand.toLowerCase() === brand.toLowerCase()) &&
        (category === 'All' || p.category === category) &&
        (storage === 'All' || p.storage === storage) &&
        (ram === 'All' || p.ram === ram) &&
        (network === 'All' || p.network === network) &&
        (condition === 'All' || p.condition === condition) &&
        (display === 'All' || p.display === display) &&
        (os === 'All' || p.os === os) &&
        (seriesFilter === 'All' || p.series === seriesFilter) &&
        Number(p.deposit || 0) >= d.min && Number(p.deposit || 0) <= d.max &&
        Number(p.cashPrice || 0) >= pr[0] && Number(p.cashPrice || 0) <= pr[1] &&
        (frequency === 'All' || p.installmentFrequency === frequency) &&
        (!maxDeposit || Number(p.deposit || 0) <= Number(maxDeposit)) &&
        (!maxInstallment || Number(p.installmentAmount || 0) <= Number(maxInstallment)) &&
        (!availableOnly || Number(p.stock || 0) > 0);
    });
    return filtered.sort((a,b) => {
      if (sort === 'Price: Low to High') return Number(a.cashPrice||0)-Number(b.cashPrice||0);
      if (sort === 'Price: High to Low') return Number(b.cashPrice||0)-Number(a.cashPrice||0);
      if (sort === 'Deposit: Low to High') return Number(a.deposit||0)-Number(b.deposit||0);
      if (sort === 'Newest first') { const aTime = Date.parse(a.createdAt || '') || 0; const bTime = Date.parse(b.createdAt || '') || 0; return bTime - aTime; }
      return 0;
    });
  }, [products, q, brand, category, storage, ram, network, condition, display, os, seriesFilter, depositBand, frequency, priceBand, sort, mode, maxDeposit, maxInstallment, availableOnly]);

  return <div className="store">
    <header className="store-head">
      <div className="brand">
        <img src="/resources/techlipa360-main-logo.png" alt="TechLipa360" style={{width:'clamp(130px,34vw,230px)',height:52,objectFit:'contain',objectPosition:'left center'}} />
      </div>
      <div className="store-actions">
        <button className="link" onClick={() => setStatusOpen(true)}>Check application</button>
        <a className="secondary" href="#staff">Staff sign in</a>
      </div>
    </header>

    <section className="hero hero-feature">
      <div>
        <div className="eyebrow">TECHLIPA360 · SHOP SMARTER</div>
        <h1>Big Tech. Easy Payments.</h1>
        <p>Your favourite devices. Easy deposits and Lipa Mdogo payments.</p>
        <div className="hero-actions">
          <a className="primary" href="#devices">Shop devices</a>
          <button className="secondary light" onClick={() => setStatusOpen(true)}>Track application</button>
        </div>
      </div>
      <div className="hero-card">
        <Smartphone size={36}/>
        <b>Shop today. Pay your way.</b>
        <span>Clear prices and flexible payment plans.</span>
      </div>
    </section>

    <main className="store-main" id="devices">
      <section className="catalogue-lead" aria-labelledby="catalogue-title">
        <div className="catalogue-heading">
          <div className="eyebrow">SHOP DEVICES</div>
          <h2 id="catalogue-title">Find your next device</h2>
          <p>Compare deposits and payment plans, then choose what works for you.</p>
        </div>
        <label className="search catalogue-search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search phones, laptops, TVs…" aria-label="Search devices"/></label>
      </section>

      <div className="shop-highlights" aria-label="Shopping benefits"><span>✓ Clear payment details</span><span>✓ Flexible Lipa Mdogo plans</span><span>✓ Help from our team</span></div>

      <section className="brand-filter" aria-label="Browse by brand">
        <span className="brand-filter-label">Browse brands</span>
        <div className="brand-chip-list">{brands.map(b => <button key={b} className={'brand-chip '+(brand === b ? 'active' : '')} aria-pressed={brand === b} onClick={() => setBrand(b)}>{b}</button>)}</div>
      </section>

      <div className="catalog-toolbar">
        <div className="catalog-toolbar-left">
          <button className="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={14}/> Filters <ChevronDown size={13}/></button>
          <button className="secondary budget-button" onClick={()=>setFinderOpen(true)}>Find a device for my budget</button>
        </div>
        <div className="catalog-toolbar-right">
          <span className="result-count">{shown.length} device{shown.length === 1 ? '' : 's'}</span>
          <label className="sort-control"><span>Sort</span><select value={sort} onChange={e => setSort(e.target.value)}>
            <option>Featured</option><option>Deposit: Low to High</option><option>Newest first</option>
          </select></label>
        </div>
      </div>
      {filtersOpen && <div className="filter-panel">
        <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option>{categories.slice(1).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}><option>All</option>{storages.slice(1).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}><option>All</option>{rams.slice(1).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Network<select value={network} onChange={e=>setNetwork(e.target.value)}><option>All</option><option>4G</option><option>5G</option></select></label>
        <label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option>All</option><option>New</option><option>Used</option><option>Renewed</option></select></label>
        
        <label>Deposit range<select value={depositBand} onChange={e=>setDepositBand(Number(e.target.value))}>{deposits.map((d,i)=><option key={d.label} value={i}>{d.label}</option>)}</select></label>
        <label>Maximum deposit (KSh)<input type="number" min="0" inputMode="numeric" value={maxDeposit} onChange={e=>setMaxDeposit(e.target.value)} placeholder="Any deposit"/></label>
        <label>Maximum daily/periodic payment (KSh)<input type="number" min="0" inputMode="numeric" value={maxInstallment} onChange={e=>setMaxInstallment(e.target.value)} placeholder="Any payment"/></label>
        <label>Payment frequency<select value={frequency} onChange={e=>setFrequency(e.target.value)}><option>All</option><option>Daily</option><option>Weekly</option><option>Biweekly</option><option>Monthly</option></select></label>
        <label>Display<select value={display} onChange={e=>setDisplay(e.target.value)}><option>All</option>{displays.slice(1).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Operating system<select value={os} onChange={e=>setOs(e.target.value)}><option>All</option>{operatingSystems.slice(1).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Series<select value={seriesFilter} onChange={e=>setSeriesFilter(e.target.value)}><option>All</option>{series.slice(1).map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="stock-toggle"><input type="checkbox" checked={availableOnly} onChange={e=>setAvailableOnly(e.target.checked)}/> Available stock only</label>
        <button className="link" style={{justifySelf:'start'}} onClick={()=>{setBrand('All');setCategory('All');setStorage('All');setRam('All');setNetwork('All');setCondition('All');setDisplay('All');setOs('All');setSeriesFilter('All');setDepositBand(0);setMaxDeposit('');setMaxInstallment('');setAvailableOnly(true);setMode('All');setFrequency('All');setPriceBand('All');setSort('Featured');setQ('');}}>Clear all filters</button>
      </div>}
      <div className="product-grid">
        {shown.map(p => <article className="product-card" key={p.id} style={{cursor:'pointer'}} onClick={() => setSelected(p)}>
          <div className="product-icon device-card-image" style={{overflow:'hidden',background:'#f1f5f4'}}>
            {p.imageUrl ? <img loading="lazy" src={p.imageUrl} alt={p.name} style={{width:'100%',height:'100%',objectFit:'contain'}} onError={e => {e.currentTarget.style.display='none';}}/> : <Smartphone size={30}/>}
          </div>
          <div className="device-card-status">
            <span className={'badge '+(Number(p.stock||0)>0?'green':'red')}>{Number(p.stock||0)>0?'In stock':'Out of stock'}</span>
            {p.condition && <span className="device-condition">{p.condition}</span>}
          </div>
          {(p.badges||[]).length>0 && <div className="device-card-badges">{(p.badges||[]).slice(0,2).map(b=><span key={b} className="badge amber">{b}</span>)}</div>}
          <div className="device-card-info">
            <h3>{p.name}</h3>
            <p className="device-card-brand">{p.brand} · {p.category}</p>
            {(p.storage || p.ram || p.network || p.camera || p.battery || p.display) && <div className="device-specs">{[p.storage,p.ram,p.network,p.camera,p.battery,p.display].filter(Boolean).slice(0,4).map(spec=><span key={spec}>{spec}</span>)}</div>}
          </div>
          <div className="device-plan">
            <div className="device-plan-heading"><span>LIPA MDOGO</span><span>{isA17(p)?'Flexible plan':(p.installmentFrequency||'Payment plan')}</span></div>
            <div className="device-plan-prices">
              <div><small>Deposit</small><strong>{money(isA17(p)?6500:p.deposit)}</strong></div>
              <div><small>Then</small><strong>{money(isA17(p)?137:p.installmentAmount)}</strong><small>per {isA17(p)?'day':(p.installmentFrequency||'period').toLowerCase()}</small></div>
            </div>
            <div className="device-plan-term">{isA17(p)?'Choose 4GB or 6GB · 12-month term':(p.installmentPeriods?p.installmentPeriods+' scheduled payments':'Term to confirm')}</div>
          </div>
          <button className="primary device-card-cta" onClick={e => { e.stopPropagation(); setSelected(p); }}>View payment details <ChevronRight size={15}/></button>
          <a className="product-help-link" href={productHelpUrl(p.name)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>Ask about this device ↗</a>
        </article>)}
      </div>
      {!shown.length && <div className="empty">No matching devices are available. Try another brand, deposit range or search.</div>}
    </main>

    {selected && <ProductDetail product={selected} close={() => setSelected(null)} apply={() => setSelected(null)}/>}
    {statusOpen && <Status close={() => setStatusOpen(false)}/>}
    {toast && <div className="toast">{toast}</div>}

    <section className="store-support"><div><span className="eyebrow">NEED A HAND?</span><h2>Questions before you buy?</h2><p>Our team can help with product details, Lipa Mdogo terms and applications.</p></div><a href={productHelpUrl()} target="_blank" rel="noopener noreferrer" className="primary">Chat on WhatsApp ↗</a></section>
    <footer><span>TechLipa360 · Electronics & Lipa Mdogo</span><a className="link" href="#staff">Staff sign in</a></footer>
  </div>;
}

function DeviceFinder({products,close,select,budget,setBudget,deposit,setDeposit,ram,setRam,storage,setStorage,network,setNetwork}:{products:Product[];close:()=>void;select:(p:Product)=>void;budget:string;setBudget:(v:string)=>void;deposit:string;setDeposit:(v:string)=>void;ram:string;setRam:(v:string)=>void;storage:string;setStorage:(v:string)=>void;network:string;setNetwork:(v:string)=>void}) {
  const rams=Array.from(new Set(products.map(p=>p.ram).filter(Boolean))).sort();
  const storages=Array.from(new Set(products.map(p=>p.storage).filter(Boolean))).sort();
  const matches=products.filter(p=>Number(p.stock||0)>0 && (!budget || Number(p.cashPrice||0)<=Number(budget)) && (!deposit || Number(p.deposit||0)<=Number(deposit)) && (ram==='All'||p.ram===ram) && (storage==='All'||p.storage===storage) && (network==='All'||p.network===network)).slice(0,6);
  return <Modal title="Find a device" close={close}>
    <p style={{fontSize:12,color:'#687975'}}>Tell us what fits your budget. We will show available devices matching your choices.</p>
    <div className="form-grid">
      <label>Maximum cash budget<input type="number" min="0" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="e.g. 30000"/></label>
      <label>Maximum deposit<input type="number" min="0" value={deposit} onChange={e=>setDeposit(e.target.value)} placeholder="e.g. 10000"/></label>
      <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}><option>All</option>{rams.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}><option>All</option>{storages.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Network<select value={network} onChange={e=>setNetwork(e.target.value)}><option>All</option><option>4G</option><option>5G</option></select></label>
    </div>
    <div style={{marginTop:16}}>{matches.length?matches.map(p=><button key={p.id} onClick={()=>select(p)} style={{display:'grid',gridTemplateColumns:'64px 1fr auto',gap:12,alignItems:'center',width:'100%',textAlign:'left',padding:10,marginBottom:8,border:'1px solid #e2ebe8',borderRadius:10,background:'#fff',cursor:'pointer'}}>
      <div style={{width:64,height:64,borderRadius:8,background:'#f1f5f4',display:'grid',placeItems:'center',overflow:'hidden'}}>{p.imageUrl?<img src={p.imageUrl} alt={p.name} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Smartphone size={24}/>}</div>
      <div><b>{p.name}</b><small style={{display:'block',marginTop:3}}>{[p.ram,p.storage,p.network].filter(Boolean).join(' · ')}</small><small style={{display:'block',marginTop:3}}>Deposit {money(p.deposit)} · {money(p.installmentAmount)} / {p.installmentFrequency||'Monthly'}</small></div>
      <strong>{money(p.cashPrice)}</strong>
    </button>):<div className="empty">No available device matches those choices. Try a higher budget or deposit.</div>}</div>
  </Modal>;
}

function ProductDetail({product, close, apply}:{product:Product;close:()=>void;apply:()=>void}) {
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [variant,setVariant] = useState<'4'|'6'>('4');
  const activeProduct = isA17(product)?a17VariantProduct(product,variant):product;
  const specs = [
    ['Storage', activeProduct.storage], ['RAM', activeProduct.ram], ['Camera', product.camera],
    ['Battery', product.battery], ['Network', product.network], ['Condition', product.condition], ['Display', product.display], ['OS', product.os], ['Processor', product.processor], ['Chipset', product.chipset], ['Series', product.series]
  ].filter(x => x[1]);

  return <div className="modal-backdrop">
    <div className="modal product-detail-modal" style={{width:'min(900px,100%)'}}>
      <div className="modal-head"><h2>{product.name}</h2><button className="icon-btn" onClick={close}><X size={19}/></button></div>
      <div className="product-detail-body" style={{padding:18}}>
        <button className="link" onClick={close}><ArrowLeft size={15}/> Back to catalogue</button>
        <div className="product-detail-layout" style={{display:'grid',gridTemplateColumns:'minmax(280px,1fr) minmax(280px,1fr)',gap:26,marginTop:15}}>
          <div className="product-detail-photo" style={{minHeight:330,borderRadius:16,background:'#f1f5f4',display:'grid',placeItems:'center',overflow:'hidden'}}>
            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} style={{width:'100%',height:'100%',maxHeight:430,objectFit:'contain'}}/> : <Smartphone size={70}/>}
          </div>
          <div>
            <div className="eyebrow">{product.brand} · {product.category}</div>
            <h1 style={{margin:'5px 0 12px',fontSize:30}}>{product.name}</h1>
            <span className={'badge '+(Number(product.stock||0)>0?'green':'red')}>{Number(product.stock||0)>0?'In stock':'Out of stock'}</span>{(product.badges||[]).map(b=><span key={b} className="badge amber" style={{marginLeft:5}}>{b}</span>)}
            {isA17(product)&&<div className="a17-variant-selector"><b>Choose RAM / Storage</b><div><button className={variant==='4'?'primary':'secondary'} onClick={()=>setVariant('4')}>4GB / 128GB</button><button className={variant==='6'?'primary':'secondary'} onClick={()=>setVariant('6')}>6GB / 128GB</button></div></div>}
            <div className="product-detail-payment" style={{marginTop:18,padding:15,borderRadius:11,background:'#f2f7f6'}}>
              <b style={{fontSize:13}}>Lipa Mdogo</b>
              <div className="product-detail-payment-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:12}}>
                <div><small>Deposit</small><b>{money(activeProduct.deposit)}</b></div>
                <div><small>Payment</small><b>{money(activeProduct.installmentAmount)} <span>/ {activeProduct.installmentFrequency || 'Daily'}</span></b></div>
                <div><small>Payment frequency</small><b>{activeProduct.installmentFrequency || 'Daily'}</b></div>
                <div><small>Plan total</small><b>{Number(activeProduct.installmentTotal)>0?money(activeProduct.installmentTotal):'Confirm with team'}</b></div>
              </div>
              <div style={{fontSize:10,color:'#71807d',marginTop:10}}>{isA17(product)?'Loan term: 12 months · exact number of daily payments to confirm':(product.installmentPeriods?product.installmentPeriods+' scheduled payments':'Term to confirm')}</div>
            </div>
            <div style={{display:'grid',gap:9,marginTop:18}}>
              <button className="primary full" disabled={Number(product.stock||0)<=0} onClick={() => setApplicationOpen(true)}>{Number(product.stock||0)>0?'Apply for this device':'Currently out of stock'}</button>
              
              <a className="product-help-link detail-help-link" href={productHelpUrl(product.name)} target="_blank" rel="noopener noreferrer">Questions about this device? Chat on WhatsApp ↗</a>
            </div>
          </div>
        </div>

        <section style={{marginTop:28}}>
          <h3 style={{fontSize:17}}>Device specifications</h3><p className="specs-caption">Specifications are based on the details recorded for this item.</p>
          {specs.length ? <div className="product-spec-grid">
            {specs.map(([label,value]) => <div className="product-spec" key={label}><small>{label}</small><b>{value}</b></div>)}
          </div> : <div className="empty" style={{padding:18}}>Specifications will appear here when the device details are added by the shop.</div>}
        </section>

        <section className="product-how">
          <h3>How Lipa Mdogo works</h3>
          <div>Choose your device <span>›</span> pay the required deposit <span>›</span> make the scheduled payments <span>›</span> complete your plan.</div>
        </section>
      </div>
    </div>
    {applicationOpen && <Apply product={activeProduct} close={() => setApplicationOpen(false)} saved={() => {setApplicationOpen(false);apply()}}/>}
  </div>;
}

function Apply({product,close,saved}:{product:Product;close:()=>void;saved:()=>void}) {
  const [f,setF]=useState({name:'',phone:'',idNumber:'',location:'',saleType:'installment',deposit:String(product.deposit||''),note:''});
  const [err,setErr]=useState('');
  const [sending,setSending]=useState(false);
  const [confirmation,setConfirmation]=useState<string|null>(null);
  const businessWhatsApp='254710495946';

  const openWhatsApp=()=>{
    const paymentOption=f.saleType==='cash'?'Cash':'Lipa Mdogo';
    const deposit=Number(f.saleType==='cash'?product.cashPrice:f.deposit);
    const lines=[
      'TechLipa360 Device Application',
      '',
      'Customer details:',
      'Name: '+f.name,
      'ID Number: '+f.idNumber,
      'Phone: '+f.phone,
      'Location: '+(f.location || 'Not provided'),
      '',
      'Device details:',
      'Device: '+product.name,
      'Brand: '+product.brand,
      'Category: '+product.category,
      'Payment option: '+paymentOption,

      ...(f.saleType==='installment' ? [
        'Deposit: '+money(deposit),
        'Installment: '+money(product.installmentAmount)+' / '+(product.installmentFrequency || 'Monthly'),
        ...(isA17(product)?['Loan term: 12 months','Exact daily payment count and total: to confirm']:['Number of payments: '+(product.installmentPeriods || 1),'Lipa Mdogo total: '+money(Number(product.installmentTotal || 0))])
      ] : []),
      ...(f.note ? ['', 'Customer note: '+f.note] : []),
      '',
      'I would like to proceed with this application.'
    ];
    window.location.href='https://wa.me/'+businessWhatsApp+'?text='+encodeURIComponent(lines.join('\n'));
  };

  return <Modal title={confirmation?'Application received':'Apply for '+product.name} close={close}>
    {confirmation ? <div className="application-confirmation"><div className="application-success-icon">✓</div><h3>Application submitted!</h3><p>Thank you, {f.name}. Your request for <strong>{product.name}</strong> has been saved. Our team will review it and contact you.</p><div className="application-reference"><span>Application reference</span><strong>{confirmation}</strong></div><p className="application-hint">Keep this reference for your records. You can also check your application status using your phone number and ID.</p><button className="primary full" onClick={openWhatsApp}>Continue on WhatsApp</button><button className="secondary full" onClick={saved}>Done</button></div> : <form className="application-form" onSubmit={async e=>{
      e.preventDefault();
      setErr('');
      setSending(true);
      try{
        const response=await api.post('/api/storefront/applications',{customerName:f.name,phone:f.phone,idNumber:f.idNumber,location:f.location,productId:product.id,saleType:f.saleType,deposit:Number(f.saleType==='cash'?product.cashPrice:f.deposit),frequency:f.saleType==='cash'?'':(product.installmentFrequency||'Monthly'),installmentAmount:f.saleType==='cash'?0:Number(product.installmentAmount||0),note:f.note});
        setConfirmation(String(response?.data?.id || response?.data?.reference || 'Saved successfully'));
        setSending(false);
      }catch(e:any){
        setErr(e?.message||'Could not submit application');
        setSending(false);
      }
    }}>
      <div className="application-product">{product.imageUrl?<img src={product.imageUrl} alt={product.name} style={{width:72,height:72,objectFit:'contain',borderRadius:10}}/>:<div className="product-icon compact"><Smartphone size={24}/></div>}<div><b>{product.name}</b><span>Deposit {money(product.deposit)} · {money(product.installmentAmount)} / {product.installmentFrequency||'Daily'}</span></div></div>
      <div className="application-step-label">01 · YOUR DETAILS</div>
      <div className="form-grid">
        <label>Full name<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
        <label>Phone<input required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
        <label>ID number<input required value={f.idNumber} onChange={e=>setF({...f,idNumber:e.target.value})}/></label>
        <label>Location<input value={f.location} onChange={e=>setF({...f,location:e.target.value})}/></label>
        <label>Payment option<select value="installment" disabled><option value="installment">Lipa Mdogo</option></select></label>
        {f.saleType==='installment'&&<label>Deposit<input type="number" min={product.deposit} value={f.deposit} onChange={e=>setF({...f,deposit:e.target.value})}/></label>}
      </div>
      <div className="application-step-label">02 · PAYMENT SUMMARY</div>
      <div className="application-payment-summary"><div><span>Payment method</span><strong>{f.saleType==='cash'?'Pay Cash':'Lipa Mdogo'}</strong></div>{f.saleType==='installment'&&<><div><span>Deposit</span><strong>{money(Number(f.deposit||0))}</strong></div><div><span>Instalment</span><strong>{money(product.installmentAmount)} / {product.installmentFrequency||'Monthly'}</strong></div><div><span>{isA17(product)?'Loan term':'Scheduled payments'}</span><strong>{isA17(product)?'12 months':(product.installmentPeriods>0?product.installmentPeriods:'To be confirmed')}</strong></div>{Number(product.installmentTotal)>0&&<div className="application-total"><span>Listed Lipa Mdogo total</span><strong>{money(product.installmentTotal)}</strong></div>}</>}</div>
      {f.saleType==='installment'&&Number(product.installmentTotal)>0&&Math.abs(Number(product.installmentTotal)-(Number(f.deposit||0)+Number(product.installmentAmount||0)*Number(product.installmentPeriods||1)))>1&&<div className="application-price-notice">The listed plan total differs from the deposit plus scheduled instalments. Please confirm the payment terms with our team before paying.</div>}
      {false&&f.saleType==='installment'&&<div className="sale-summary">
        <span>Deposit<b>{money(Number(f.deposit||0))}</b></span>
        <span>Installment<b>{money(product.installmentAmount)} / {product.installmentFrequency || 'Monthly'}</b></span>
        <span>Payments<b>{product.installmentPeriods || 1}</b></span>
      </div>}
      {err&&<div className="error-box">{err}</div>}
      <label className="wide">Note<textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></label>
      <p className="application-hint">Submitting sends your application to TechLipa360. No payment is collected through this form.</p>
      <button className="primary full" disabled={sending}>{sending ? 'Saving application…' : 'Submit application'}</button>
    </form>}
  </Modal>;
}
function Status({close}:{close:()=>void}) {
  const [phone,setPhone]=useState(''),[id,setId]=useState(''),[result,setResult]=useState<any>(null),[err,setErr]=useState('');
  return <Modal title="Check application status" close={close}>
    <form onSubmit={async e=>{e.preventDefault();try{const r=await api.get('/api/storefront/status',{phone,idNumber:id});setResult(r.data)}catch(e:any){setErr(e?.message||'No matching records')}}}>
      <div className="form-grid"><label>Phone<input required value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>ID number<input required value={id} onChange={e=>setId(e.target.value)}/></label></div>
      {err&&<div className="error-box">{err}</div>}<button className="primary full">Check status</button>
    </form>
    {result&&<div className="status-results">{result.applications.map((a:any,i:number)=><div className="status-row" key={'a'+i}><b>{a.productName}</b><span>Application: {a.status}</span></div>)}{result.contracts.map((c:any,i:number)=><div className="status-row" key={'c'+i}><b>{c.productName}</b><span>{c.status} · Balance {money(c.balance)} · Next {c.nextPayment}</span></div>)}</div>}
  </Modal>;
}

function Modal({title,children,close}:{title:string;children:React.ReactNode;close:()=>void}) {
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={close}><X size={19}/></button></div>{children}</div></div>;
}
