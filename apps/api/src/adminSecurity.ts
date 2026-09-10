import {randomBytes,randomInt,createHash,timingSafeEqual} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {AppDb} from './db';
import {verifyPassword} from './auth';

export function registerAdminSecurity(app:FastifyInstance,db:AppDb,guard:any,sendCode:((to:string,code:string)=>Promise<void>)|null){
 const sql=db.raw;
 sql.exec(`CREATE TABLE IF NOT EXISTS admin_second_factor(user_id INTEGER PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS admin_challenges(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,purpose TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,auth_version INTEGER NOT NULL);`);
 const version=(id:number)=>(sql.prepare('SELECT version FROM admin_auth_state WHERE user_id=?').get(id) as any)?.version??0;
 const enabled=(id:number)=>!!(sql.prepare('SELECT enabled FROM admin_second_factor WHERE user_id=?').get(id) as any)?.enabled;
 const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
 const audit=(id:number,action:string)=>sql.prepare('INSERT INTO admin_audit(actor_id,action,target) VALUES(?,?,?)').run(id,action,'Sécurité');
 async function issue(id:number,purpose:string){
  if(!sendCode)throw new Error('L’envoi des codes par email est indisponible.');
  const user=db.findUserById(id);if(!user)throw new Error('Compte introuvable.');
  const challenge=randomBytes(32).toString('hex'),code=String(randomInt(100000,1000000));
  sql.prepare('DELETE FROM admin_challenges WHERE expires_at<? OR (user_id=? AND purpose=?)').run(Date.now(),id,purpose);
  sql.prepare('INSERT INTO admin_challenges(id,user_id,purpose,code_hash,expires_at,auth_version) VALUES(?,?,?,?,?,?)').run(challenge,id,purpose,hash(challenge+code),Date.now()+10*60000,version(id));
  try{await sendCode(user.email,code);}catch{sql.prepare('DELETE FROM admin_challenges WHERE id=?').run(challenge);throw new Error('Impossible d’envoyer le code. Vérifiez la messagerie dans Connexions.');}
  return {challenge,message:'Un code valable 10 minutes a été envoyé à votre adresse administrateur.'};
 }
 function consume(challenge:any,code:any,purpose:string,expectedId?:number){
  if(typeof challenge!=='string'||!/^[a-f0-9]{64}$/.test(challenge)||typeof code!=='string'||!/^\d{6}$/.test(code))return null;
  return sql.transaction(()=>{
   const row=sql.prepare('SELECT * FROM admin_challenges WHERE id=?').get(challenge) as any;
   if(!row||row.purpose!==purpose||(expectedId!==undefined&&row.user_id!==expectedId)||row.expires_at<Date.now()||row.attempts>=5||row.auth_version!==version(row.user_id))return null;
   sql.prepare('UPDATE admin_challenges SET attempts=attempts+1 WHERE id=?').run(challenge);
   if(!timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(hash(challenge+code),'hex')))return null;
   sql.prepare('DELETE FROM admin_challenges WHERE id=?').run(challenge);return row.user_id as number;
  })();
 }
 app.post('/api/admin/login/verify',{config:{rateLimit:{max:10,timeWindow:'10 minutes'}}},async(r:any,reply)=>{
  reply.header('Cache-Control','no-store');const id=consume(r.body?.challenge,r.body?.code,'login');
  const admins=(process.env.ADMIN_USER_IDS??'').split(',').map(Number);
  if(!id||!enabled(id)||!admins.includes(id)||!db.findUserById(id))return reply.code(401).send({error:'Code incorrect, expiré ou déjà utilisé.'});
  audit(id,'Connexion avec double authentification');
  return {token:await reply.jwtSign({userId:id,adminSession:true,authVersion:version(id)},{expiresIn:'30m'})};
 });
 app.get('/api/admin/security',{preHandler:guard},async(r:any)=>({enabled:enabled(r.user.userId),email:db.findUserById(r.user.userId)?.email,email_available:!!sendCode}));
 app.post('/api/admin/security/start',{preHandler:guard,config:{rateLimit:{max:3,timeWindow:'15 minutes'}}},async(r:any,reply)=>{
  const id=r.user.userId,user=db.findUserById(id),state=sql.prepare('SELECT password_hash FROM admin_auth_state WHERE user_id=?').get(id) as any;
  if(typeof r.body?.password!=='string'||r.body.password.length>256||!await verifyPassword(r.body.password,state?.password_hash||user!.password_hash))return reply.code(401).send({error:'Mot de passe incorrect.'});
  try{return await issue(id,enabled(id)?'disable':'enable');}catch(e){return reply.code(503).send({error:(e as Error).message});}
 });
 app.post('/api/admin/security/confirm',{preHandler:guard,config:{rateLimit:{max:10,timeWindow:'10 minutes'}}},async(r:any,reply)=>{
  const id=r.user.userId,purpose=enabled(id)?'disable':'enable';
  if(!consume(r.body?.challenge,r.body?.code,purpose,id))return reply.code(400).send({error:'Code incorrect, expiré ou déjà utilisé.'});
  sql.transaction(()=>{
   sql.prepare('INSERT INTO admin_second_factor VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled').run(id,purpose==='enable'?1:0);
   sql.prepare('INSERT INTO admin_auth_state(user_id,version) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1').run(id);
   audit(id,purpose==='enable'?'Double authentification activée':'Double authentification désactivée');
  })();
  return {ok:true,reconnect:true};
 });
 app.post('/api/admin/security/revoke',{preHandler:guard},async(r:any)=>{
  sql.prepare('INSERT INTO admin_auth_state(user_id,version) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1').run(r.user.userId);audit(r.user.userId,'Toutes les sessions révoquées');return {ok:true};
 });
 return {enabled,issue};
}
