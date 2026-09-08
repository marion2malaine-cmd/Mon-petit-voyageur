import type { FastifyInstance } from "fastify";
import type { AppDb } from "./db";
import Stripe from "stripe";
import { isRealSecretKey } from "./billing";
import { verifyPassword, hashPassword } from './auth';
import { randomBytes, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';

/** Admin rights are explicit user IDs, never a claim supplied by a browser. */
export function registerAdmin(app: FastifyInstance, db: AppDb, options: { sendResetEmail?: (to:string,url:string)=>Promise<void> } = {}) {
  db.raw.exec(`CREATE TABLE IF NOT EXISTS admin_auth_state(user_id INTEGER PRIMARY KEY,password_hash TEXT,version INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS admin_password_resets(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at INTEGER NOT NULL);`);
  const authState=(id:number)=>db.raw.prepare('SELECT password_hash,version FROM admin_auth_state WHERE user_id=?').get(id) as {password_hash:string|null;version:number}|undefined;
  const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
  const transport=process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS?nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||587,secure:process.env.SMTP_SECURE==='true',connectionTimeout:10000,socketTimeout:15000,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}):null;
  const sendResetEmail=options.sendResetEmail??(transport?async(to:string,url:string)=>{await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject:'Réinitialiser votre accès administrateur — Mon Petit Voyageur',text:`Pour choisir un nouveau mot de passe administrateur, ouvrez ce lien valable 30 minutes :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.`});}:null);
  db.raw.exec(`CREATE TABLE IF NOT EXISTS admin_metrics(day TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,kind,target)); CREATE TABLE IF NOT EXISTS admin_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT OR IGNORE INTO admin_meta VALUES ('tracking_since',datetime('now'));`);
  const stripe = isRealSecretKey(process.env.STRIPE_SECRET_KEY) ? new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 }) : null;
  app.post("/api/metrics", { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const origin = request.headers.origin;
    const allowed = new Set([process.env.APP_URL, "https://www.monpetitvoyageur.com", "https://monpetitvoyageur.com"]);
    if (!origin || !allowed.has(origin)) return reply.code(403).send({error: "Origin refused"});
    const body = request.body as any;
    if (!body || !["page_view","click"].includes(body.kind) || !["home","planner","booking","guide","other_external"].includes(body.target)) return reply.code(400).send({error:"Invalid event"});
    db.raw.prepare("INSERT INTO admin_metrics VALUES(date('now'),?,?,1) ON CONFLICT(day,kind,target) DO UPDATE SET count=count+1").run(body.kind,body.target);
    return {ok:true};
  });
  const admins = new Set((process.env.ADMIN_USER_IDS ?? "").split(",").map(Number).filter(n => Number.isSafeInteger(n) && n > 0));
  app.post('/api/admin/forgot-password',{config:{rateLimit:{max:3,timeWindow:'15 minutes'}}},async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!sendResetEmail)return reply.code(503).send({error:'L’envoi des emails de récupération n’est pas encore activé. Contactez la personne qui configure votre administration.'});
    const body=request.body as any;
    if(typeof body?.email!=='string'||body.email.length>254)return reply.code(400).send({error:'Adresse email invalide'});
    const user=db.findUserByEmail(body.email.trim());
    if(user&&admins.has(user.id)){
      const token=randomBytes(32).toString('hex');
      db.raw.transaction(()=>{db.raw.prepare('DELETE FROM admin_password_resets WHERE expires_at<? OR user_id=?').run(Date.now(),user.id);db.raw.prepare('INSERT INTO admin_password_resets VALUES(?,?,?)').run(digest(token),user.id,Date.now()+30*60000);})();
      const origin=process.env.ADMIN_PUBLIC_URL||'https://admin-dashboard-production-b0b2.up.railway.app';
      try{await sendResetEmail(user.email,origin+'/#reset='+token);}catch{db.raw.prepare('DELETE FROM admin_password_resets WHERE token_hash=?').run(digest(token));return reply.code(503).send({error:'L’email n’a pas pu être envoyé. Réessayez dans quelques minutes.'});}
    }
    return {message:'Si cette adresse est associée à un compte administrateur, un lien a été envoyé. Pensez à vérifier les courriers indésirables.'};
  });
  app.post('/api/admin/reset-password',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const body=request.body as any;
    if(typeof body?.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||typeof body?.password!=='string'||body.password.length<12||Buffer.byteLength(body.password)>72)return reply.code(400).send({error:'Choisissez un mot de passe d’au moins 12 caractères (72 octets maximum).'});
    const hash=await hashPassword(body.password);
    const changed=db.raw.transaction(()=>{
      const row=db.raw.prepare('SELECT user_id FROM admin_password_resets WHERE token_hash=? AND expires_at>?').get(digest(body.token),Date.now()) as {user_id:number}|undefined;
      if(!row||!admins.has(row.user_id)||!db.findUserById(row.user_id))return false;
      db.raw.prepare('INSERT INTO admin_auth_state(user_id,password_hash,version) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,version=version+1').run(row.user_id,hash);
      db.raw.prepare('DELETE FROM admin_password_resets WHERE user_id=?').run(row.user_id);return true;
    })();
    if(!changed)return reply.code(400).send({error:'Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien.'});
    return {message:'Votre mot de passe administrateur a été modifié. Vous pouvez vous connecter.'};
  });
  app.post('/api/admin/login', {config:{rateLimit:{max:5,timeWindow:'1 minute'}}}, async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const body=request.body as any;
    if(typeof body?.email!=='string'||typeof body?.password!=='string'||body.password.length>256) return reply.code(400).send({error:'Identifiants invalides'});
    const user=db.findUserByEmail(body.email.trim());
    if(!user||!admins.has(user.id)||!await verifyPassword(body.password,authState(user.id)?.password_hash||user.password_hash)) return reply.code(401).send({error:'Identifiants invalides ou compte non autorisé'});
    return {token:await reply.jwtSign({userId:user.id,adminSession:true,authVersion:authState(user.id)?.version||0},{expiresIn:'30m'})};
  });
  const guard = async (request: any, reply: any) => {
    reply.header("Cache-Control", "no-store");
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: "Connexion requise" }); }
    if (!admins.has(request.user.userId) || !db.findUserById(request.user.userId)) return reply.code(403).send({ error: "Accès réservé à l’administratrice" });
    if(!request.user.adminSession || request.user.authVersion!==(authState(request.user.userId)?.version||0))return reply.code(401).send({error:'Votre session a expiré. Reconnectez-vous.'});
  };
  app.get("/api/admin/dashboard", { preHandler: guard }, async (request: any) => {
    const days = [7,30,365].includes(Number(request.query.days)) ? Number(request.query.days) : 30;
    const since = new Date(Date.now()-days*86400000).toISOString().slice(0,19).replace("T"," ");
    const users = db.raw.prepare(`SELECT u.id,u.email,u.preferred_language,u.created_at,u.subscription_status,u.subscription_plan,u.current_period_end,u.stripe_customer_id,(SELECT count(*) FROM trips t WHERE t.user_id=u.id) AS trips FROM users u ORDER BY u.created_at DESC LIMIT 2000`).all();
    const trips = db.raw.prepare(`SELECT t.id,t.title,t.created_at,t.updated_at,u.email FROM trips t LEFT JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC LIMIT 500`).all();
    const totals = db.raw.prepare(`SELECT (SELECT count(*) FROM users) AS users,(SELECT count(*) FROM trips) AS trips,(SELECT count(*) FROM users WHERE subscription_status='active') AS active,(SELECT count(*) FROM users WHERE subscription_status='trialing') AS trialing,(SELECT count(*) FROM users WHERE subscription_status='past_due') AS past_due,(SELECT count(*) FROM users WHERE created_at>=?) AS registrations`).get(since);
    const registrations = db.raw.prepare("SELECT date(created_at) AS day,count(*) AS count FROM users WHERE created_at>=? GROUP BY date(created_at) ORDER BY day").all(since);
    const metrics = db.raw.prepare("SELECT kind,target,sum(count) AS count FROM admin_metrics WHERE day>=date(?) GROUP BY kind,target ORDER BY count DESC").all(since);
    return { updated_at: new Date().toISOString(), days, totals, users, trips, registrations, metrics,
      limits: { users: 2000, trips: 500 },
      sources: { database: "Railway · base de production", stripe: !!stripe, webhook: !!process.env.STRIPE_WEBHOOK_SECRET, analytics: true, tracking_since: (db.raw.prepare("SELECT value FROM admin_meta WHERE key='tracking_since'").get() as any).value },
      revenue: null };
  });
  app.get("/api/admin/payments", { preHandler: guard }, async (request: any, reply) => {
    if (!stripe) return reply.code(503).send({error:"Stripe n’est pas encore relié à cette API Railway."});
    const days = [7,30,365].includes(Number(request.query.days)) ? Number(request.query.days) : 30;
    try {
      const invoices = await stripe.invoices.list({limit:100,created:{gte:Math.floor(Date.now()/1000)-days*86400}});
      return { test_mode: process.env.STRIPE_SECRET_KEY!.includes('_test_'), has_more: invoices.has_more, invoices: invoices.data.map(i=>({id:i.id,email:i.customer_email,status:i.status,amount:i.amount_paid,currency:i.currency,created:i.created,url:i.hosted_invoice_url})) };
    } catch { return reply.code(502).send({error:"Stripe ne répond pas. Les paiements sont temporairement indisponibles."}); }
  });
}
