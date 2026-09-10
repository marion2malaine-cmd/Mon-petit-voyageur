import { describe,it,expect } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import Database from 'better-sqlite3';
import { registerAdmin } from '../admin';
describe('admin authorization',()=>{
 it('rejects anonymous and ordinary accounts; exposes only safe fields to an allowed administrator',async()=>{
  const previous=process.env.ADMIN_USER_IDS;process.env.ADMIN_USER_IDS='1';
  const raw=new Database(':memory:');raw.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,password_hash TEXT,preferred_language TEXT,created_at TEXT,subscription_status TEXT,subscription_plan TEXT,current_period_end TEXT,stripe_customer_id TEXT);CREATE TABLE trips(id INTEGER,user_id INTEGER,title TEXT,created_at TEXT,updated_at TEXT);INSERT INTO users VALUES(1,'owner@example.com','secret','fr',datetime('now'),'none',NULL,NULL,NULL);INSERT INTO users VALUES(2,'member@example.com','secret','fr',datetime('now'),'none',NULL,NULL,NULL);`);
  let resetUrl='';
  const app=Fastify();app.register(jwt,{secret:'test-admin-secret'});registerAdmin(app,{raw,findUserById:(id:number)=>raw.prepare('SELECT * FROM users WHERE id=?').get(id),findUserByEmail:(email:string)=>raw.prepare('SELECT * FROM users WHERE email=?').get(email)} as any,{sendResetEmail:async(_to,url)=>{resetUrl=url;}});await app.ready();
  try {
   expect((await app.inject('/api/admin/dashboard')).statusCode).toBe(401);
   const member=app.jwt.sign({userId:2});expect((await app.inject({url:'/api/admin/dashboard',headers:{authorization:'Bearer '+member}})).statusCode).toBe(403);
   const owner=app.jwt.sign({userId:1,adminSession:true,authVersion:0});const r=await app.inject({url:'/api/admin/dashboard',headers:{authorization:'Bearer '+owner}});expect(r.statusCode).toBe(200);expect(r.json().totals.users).toBe(2);expect(r.body).not.toContain('password_hash');expect(r.headers['cache-control']).toBe('no-store');
   expect((await app.inject({method:'POST',url:'/api/metrics',headers:{origin:'https://evil.example'},payload:{kind:'click',target:'booking'}})).statusCode).toBe(403);
   const event=await app.inject({method:'POST',url:'/api/metrics',headers:{origin:'https://www.monpetitvoyageur.com'},payload:{kind:'click',target:'booking'}});expect(event.statusCode).toBe(200);
   const metrics=(await app.inject({url:'/api/admin/dashboard',headers:{authorization:'Bearer '+owner}})).json().metrics;expect(metrics).toEqual([{kind:'click',target:'booking',count:1}]);
   const forgot=await app.inject({method:'POST',url:'/api/admin/forgot-password',payload:{email:'owner@example.com'}});expect(forgot.statusCode).toBe(200);
   const token=resetUrl.split('#reset=')[1];expect(token).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(raw.prepare('SELECT * FROM admin_password_resets').all())).not.toContain(token);
   expect((await app.inject({method:'POST',url:'/api/admin/reset-password',payload:{token,password:'short'}})).statusCode).toBe(400);
   expect((await app.inject({method:'POST',url:'/api/admin/reset-password',payload:{token,password:'new-password-for-admin'}})).statusCode).toBe(200);
   expect((await app.inject({method:'POST',url:'/api/admin/reset-password',payload:{token,password:'new-password-for-admin'}})).statusCode).toBe(400);
   expect((await app.inject({url:'/api/admin/dashboard',headers:{authorization:'Bearer '+owner}})).statusCode).toBe(401);
   const login=await app.inject({method:'POST',url:'/api/admin/login',payload:{email:'owner@example.com',password:'new-password-for-admin'}});expect(login.statusCode).toBe(200);
   expect((await app.inject({url:'/api/admin/dashboard',headers:{authorization:'Bearer '+login.json().token}})).statusCode).toBe(200);
   expect((raw.prepare('SELECT password_hash FROM users WHERE id=1').get() as any).password_hash).toBe('secret');
   resetUrl='';await app.inject({method:'POST',url:'/api/admin/forgot-password',payload:{email:'member@example.com'}});expect(resetUrl).toBe('');
  }finally{await app.close();raw.close();if(previous===undefined)delete process.env.ADMIN_USER_IDS;else process.env.ADMIN_USER_IDS=previous;}
 });
});
