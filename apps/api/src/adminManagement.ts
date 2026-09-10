import type { FastifyInstance } from 'fastify';
import type { AppDb } from './db';
import type Stripe from 'stripe';

export function registerAdminManagement(app: FastifyInstance, db: AppDb, guard: any, stripe: Stripe | null, accessSummary:(id:number)=>any) {
  const sql=db.raw;
  sql.exec(`
    CREATE TABLE IF NOT EXISTS admin_notes(user_id INTEGER PRIMARY KEY,body TEXT NOT NULL,updated_at TEXT NOT NULL,actor_id INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_audit(id INTEGER PRIMARY KEY,actor_id INTEGER,action TEXT NOT NULL,target TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS admin_costs(id INTEGER PRIMARY KEY,day TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,memo TEXT NOT NULL,actor_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS admin_generations(run_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,trip_id INTEGER,status TEXT NOT NULL,started_at TEXT NOT NULL DEFAULT (datetime('now')),finished_at TEXT,duration_ms INTEGER);
  `);
  const audit=(actor:number,action:string,target:string)=>sql.prepare('INSERT INTO admin_audit(actor_id,action,target) VALUES(?,?,?)').run(actor,action,target);
  const meta=(key:string)=>(sql.prepare('SELECT value FROM admin_meta WHERE key=?').get(key) as any)?.value??null;
  const stamp=(key:string,value:string)=>sql.prepare('INSERT INTO admin_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);
  if(!meta('management_since'))stamp('management_since',new Date().toISOString());
  const daysOf=(r:any)=>[7,30,365].includes(Number(r.query?.days))?Number(r.query.days):30;
  const start=(days:number)=>new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
  const userFields='id,email,preferred_language,created_at,subscription_status,subscription_plan,current_period_end,stripe_customer_id';
  const safeId=(value:any)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):0;
  app.get('/api/admin/management',{preHandler:guard},async(r:any)=>{
    const days=daysOf(r),since=start(days);
    const registrations=sql.prepare('SELECT date(created_at) day,count(*) count FROM users WHERE date(created_at)>=? GROUP BY date(created_at)').all(since) as any[];
    const series=Array.from({length:days},(_,i)=>{const day=new Date(Date.parse(since)+i*86400000).toISOString().slice(0,10);return {day,count:registrations.find(x=>x.day===day)?.count??0};});
    const previous=sql.prepare('SELECT count(*) count FROM users WHERE date(created_at)>=date(?,?) AND date(created_at)<?').get(since,`-${days} days`,since) as any;
    const cohort=sql.prepare(`SELECT count(*) registered,coalesce(sum(EXISTS(SELECT 1 FROM trips t WHERE t.user_id=u.id)),0) planned,coalesce(sum(subscription_status IN ('active','trialing')),0) subscribed FROM users u WHERE date(created_at)>=?`).get(since);
    const generations=sql.prepare('SELECT g.*,u.email FROM admin_generations g LEFT JOIN users u ON u.id=g.user_id WHERE date(g.started_at)>=? ORDER BY g.started_at DESC LIMIT 200').all(since);
    const generationTotals=sql.prepare("SELECT count(*) total,coalesce(sum(status='error'),0) errors,coalesce(sum(status='running'),0) running FROM admin_generations WHERE date(started_at)>=?").get(since);
    const costs=sql.prepare('SELECT * FROM admin_costs WHERE day>=? ORDER BY day DESC,id DESC LIMIT 500').all(since);
    const costTotals=sql.prepare('SELECT currency,sum(amount) amount FROM admin_costs WHERE day>=? GROUP BY currency').all(since);
    const activity=sql.prepare(`SELECT * FROM (SELECT 'Inscription' kind,email label,created_at,CAST(id AS TEXT) target FROM users UNION ALL SELECT 'Voyage enregistré',title,updated_at,CAST(id AS TEXT) FROM trips UNION ALL SELECT action,'Administration',created_at,target FROM admin_audit) ORDER BY created_at DESC LIMIT 20`).all();
    return {series,previous_registrations:previous.count,cohort,generations,generationTotals,costs,costTotals,activity,management_since:meta('management_since'),last_webhook:meta('last_webhook'),last_stripe_check:meta('last_stripe_check'),last_stripe_error:meta('last_stripe_error'),smtp_configured:!!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS),limits:{generations:200,costs:500}};
  });
  app.get('/api/admin/users/:id',{preHandler:guard},async(r:any,reply)=>{
    const id=safeId(r.params.id),user=sql.prepare(`SELECT ${userFields} FROM users WHERE id=?`).get(id);
    if(!user)return reply.code(404).send({error:'Utilisateur introuvable.'});
    audit(r.user.userId,'Fiche utilisateur consultée',String(id));
    return {user:{...(user as any),access:accessSummary(id)},note:sql.prepare('SELECT body,updated_at FROM admin_notes WHERE user_id=?').get(id)??null,trips:sql.prepare('SELECT id,title,created_at,updated_at,verification_flags FROM trips WHERE user_id=? ORDER BY updated_at DESC LIMIT 100').all(id)};
  });
  app.post('/api/admin/users/:id/access',{preHandler:guard},async(r:any,reply)=>{
    const id=safeId(r.params.id);
    if(!db.findUserById(id))return reply.code(404).send({error:'Utilisateur introuvable.'});
    if(typeof r.body?.unlimited!=='boolean')return reply.code(400).send({error:'Choisissez un accès offert ou standard.'});
    sql.transaction(()=>{sql.prepare('UPDATE users SET complimentary_unlimited=? WHERE id=?').run(r.body.unlimited?1:0,id);audit(r.user.userId,r.body.unlimited?'Premium illimité offert':'Accès offert retiré',String(id));})();
    return {ok:true,access:accessSummary(id)};
  });
  app.post('/api/admin/users/:id/notes',{preHandler:guard},async(r:any,reply)=>{
    const id=safeId(r.params.id);
    if(!db.findUserById(id))return reply.code(404).send({error:'Utilisateur introuvable.'});
    if(typeof r.body?.body!=='string'||r.body.body.length>5000)return reply.code(400).send({error:'La note doit contenir au maximum 5 000 caractères.'});
    sql.transaction(()=>{sql.prepare("INSERT INTO admin_notes VALUES(?,?,datetime('now'),?) ON CONFLICT(user_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at,actor_id=excluded.actor_id").run(id,r.body.body,r.user.userId);audit(r.user.userId,'Note privée modifiée',String(id));})();
    return {ok:true};
  });
  app.get('/api/admin/trips/:id',{preHandler:guard},async(r:any,reply)=>{
    const trip=sql.prepare('SELECT t.*,u.email FROM trips t LEFT JOIN users u ON u.id=t.user_id WHERE t.id=?').get(safeId(r.params.id)) as any;
    if(!trip)return reply.code(404).send({error:'Voyage introuvable.'});
    const parse=(value:string)=>{try{return JSON.parse(value);}catch{return null;}};
    audit(r.user.userId,'Voyage consulté',String(trip.id));
    return {id:trip.id,title:trip.title,email:trip.email,created_at:trip.created_at,updated_at:trip.updated_at,brief:parse(trip.brief_json),plan:parse(trip.plan_json),flags:parse(trip.verification_flags),runs:sql.prepare('SELECT run_id,status,created_at FROM trip_runs WHERE trip_id=? ORDER BY created_at DESC LIMIT 30').all(trip.id)};
  });
  app.post('/api/admin/costs',{preHandler:guard},async(r:any,reply)=>{
    const b=r.body;
    if(!b||!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||!Number.isFinite(Date.parse(b.day))||new Date(b.day).toISOString().slice(0,10)!==b.day||!['IA','Hébergement','Marketing','Autre'].includes(b.category)||!Number.isSafeInteger(b.amount)||b.amount<=0||b.amount>100000000||!['eur','usd','gbp'].includes(b.currency)||typeof b.memo!=='string'||b.memo.length>500)return reply.code(400).send({error:'Vérifiez la date, le montant positif, la devise et la description.'});
    sql.transaction(()=>{const result=sql.prepare('INSERT INTO admin_costs(day,category,amount,currency,memo,actor_id) VALUES(?,?,?,?,?,?)').run(b.day,b.category,b.amount,b.currency,b.memo,r.user.userId);audit(r.user.userId,'Dépense ajoutée',String(result.lastInsertRowid));})();
    return {ok:true};
  });
  app.get('/api/admin/audit',{preHandler:guard},async(r:any)=>{
    const page=Math.max(0,Math.min(100000,Math.floor(Number(r.query.page)||0)));
    return {items:sql.prepare('SELECT a.*,u.email FROM admin_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 50 OFFSET ?').all(page*50),total:(sql.prepare('SELECT count(*) count FROM admin_audit').get() as any).count,page};
  });
  app.get('/api/admin/users/:id/billing',{preHandler:guard},async(r:any,reply)=>{
    const user=db.findUserById(safeId(r.params.id));if(!user)return reply.code(404).send({error:'Utilisateur introuvable.'});
    if(!stripe||!user.stripe_customer_id)return {linked:false,subscriptions:[],invoices:[]};
    try{
      const [subscriptions,invoices]=await Promise.all([stripe.subscriptions.list({customer:user.stripe_customer_id,status:'all',limit:100}),stripe.invoices.list({customer:user.stripe_customer_id,limit:100})]);
      return {linked:true,test_mode:process.env.STRIPE_SECRET_KEY?.includes('_test_'),partial:subscriptions.has_more||invoices.has_more,subscriptions:subscriptions.data.map(s=>({id:s.id,status:s.status,cancel_at_period_end:s.cancel_at_period_end,current_period_end:s.current_period_end,trial_end:s.trial_end,items:s.items.data.map(i=>({amount:i.price.unit_amount,currency:i.price.currency,interval:i.price.recurring?.interval,quantity:i.quantity}))})),invoices:invoices.data.map(i=>({id:i.id,status:i.status,amount:i.amount_paid,currency:i.currency,created:i.created,url:i.hosted_invoice_url})),checked_at:new Date().toISOString()};
    }catch{return reply.code(502).send({error:'Le dossier Stripe ne peut pas être chargé. Réessayez.'});}
  });
  app.get('/api/admin/finance',{preHandler:guard},async(r:any,reply)=>{
    if(!stripe)return reply.code(503).send({error:'Stripe n’est pas configuré.'});
    const since=Math.floor(Date.parse(start(daysOf(r)))/1000);
    async function collect(list:any,params:any){let data:any[]=[];let more=true;while(more&&data.length<1000){const page=await list({...params,limit:100,...(data.length?{starting_after:data[data.length-1].id}:{})});data.push(...page.data);more=page.has_more;}return {data,partial:more};}
    try{
      const linkedCustomers=new Set((sql.prepare('SELECT stripe_customer_id id FROM users WHERE stripe_customer_id IS NOT NULL').all() as any[]).map(u=>u.id));
      const customerId=(c:any)=>typeof c==='string'?c:c?.id;
      const [transactions,subs,invoices]=await Promise.all([collect(stripe.balanceTransactions.list.bind(stripe.balanceTransactions),{created:{gte:since},expand:['data.source','data.source.charge']}),collect(stripe.subscriptions.list.bind(stripe.subscriptions),{status:'active'}),collect(stripe.invoices.list.bind(stripe.invoices),{created:{gte:since}})]);
      const currencies:Record<string,any>={};
      const bucket=(c:string)=>currencies[c]??(currencies[c]={currency:c,receipts:0,refunds:0,fees:0,net:0,mrr:0});
      for(const t of transactions.data){if(['charge','payment','refund','payment_refund'].includes(t.type)&&linkedCustomers.has(customerId(t.source?.customer??t.source?.charge?.customer))){const b=bucket(t.currency);if(t.amount>0)b.receipts+=t.amount;else b.refunds-=t.amount;b.fees+=t.fee;b.net+=t.net;}}
      let unsupported=0;
      for(const s of subs.data.filter(s=>linkedCustomers.has(customerId(s.customer))))for(const i of s.items.data){const p=i.price,rec=p.recurring;if(p.unit_amount==null||!rec||rec.usage_type==='metered'){unsupported++;continue;}const months=rec.interval==='year'?12*rec.interval_count:rec.interval==='month'?rec.interval_count:rec.interval==='week'?12/52*rec.interval_count:12/365*rec.interval_count;bucket(p.currency).mrr+=p.unit_amount*(i.quantity??1)/months;}
      const checked_at=new Date().toISOString();stamp('last_stripe_check',checked_at);stamp('last_stripe_error','');
      const appInvoices=invoices.data.filter(i=>linkedCustomers.has(customerId(i.customer)));
      return {checked_at,test_mode:process.env.STRIPE_SECRET_KEY?.includes('_test_'),currencies:Object.values(currencies),partial:transactions.partial||subs.partial,invoices_partial:invoices.partial||appInvoices.length>100,unsupported_mrr_items:unsupported,mrr_note:'Uniquement les clients Stripe liés aux comptes Mon Petit Voyageur. Récurrent mensuel brut normalisé des abonnements actifs : hors remises, taxes et facturation à l’usage. Les montants ne sont pas convertis entre devises.',invoices:appInvoices.slice(0,100).map(i=>({id:i.id,email:i.customer_email,status:i.status,amount:i.amount_paid,currency:i.currency,created:i.created,url:i.hosted_invoice_url}))};
    }catch{stamp('last_stripe_error',new Date().toISOString());return reply.code(502).send({error:'La lecture Stripe a échoué. Aucune estimation n’a été substituée aux données.'});}
  });
}
