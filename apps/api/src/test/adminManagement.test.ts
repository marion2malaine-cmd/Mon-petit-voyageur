import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {initDb} from '../db';
import {registerAdmin} from '../admin';
import {hashPassword} from '../auth';
import {hasActiveAccess} from '../billing';
import {premiumAccess} from '../premium';

describe('private admin management',()=>{
 let app:any,db:ReturnType<typeof initDb>,dir:string,token:string,sentCode='',oldAdmin:string|undefined;
 const password='a-strong-admin-password';
 const call=(url:string,payload?:any,auth=token)=>app.inject({url:'/api/admin/'+url,method:payload===undefined?'GET':'POST',headers:{authorization:'Bearer '+auth},...(payload===undefined?{}:{payload})});
 beforeEach(async()=>{
  oldAdmin=process.env.ADMIN_USER_IDS;process.env.ADMIN_USER_IDS='1';dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpv-admin-test-'));db=initDb(path.join(dir,'test.sqlite'));
  db.createUser({email:'owner@example.com',passwordHash:await hashPassword(password),preferredLanguage:'fr'});db.createUser({email:'member@example.com',passwordHash:'private-hash',preferredLanguage:'fr'});
  app=Fastify();app.register(jwt,{secret:'test-secret-at-least-32-characters-long'});registerAdmin(app,db,{billingConfigured:true,sendCode:async(_to,code)=>{sentCode=code;}});await app.ready();token=app.jwt.sign({userId:1,adminSession:true,authVersion:0});
 });
 afterEach(async()=>{await app.close();db.raw.close();fs.rmSync(dir,{recursive:true});if(oldAdmin===undefined)delete process.env.ADMIN_USER_IDS;else process.env.ADMIN_USER_IDS=oldAdmin;});
 it('protects notes and expenses, validates writes and records actions without note contents',async()=>{
  const member=app.jwt.sign({userId:2,adminSession:true,authVersion:0});expect((await call('users/2',undefined,member)).statusCode).toBe(403);
  expect((await call('users/2/notes',{body:'Secret internal note'},member)).statusCode).toBe(403);
  expect((await call('users/2/notes',{body:'Secret internal note'})).statusCode).toBe(200);
  const detail=await call('users/2');expect(detail.json().note.body).toBe('Secret internal note');expect(detail.body).not.toContain('password_hash');
  expect((await call('users/999/notes',{body:'x'})).statusCode).toBe(404);
  expect((await call('users/2/notes',{body:'x'.repeat(5001)})).statusCode).toBe(400);
  const expense={day:new Date().toISOString().slice(0,10),category:'IA',amount:1450,currency:'eur',memo:'Provider invoice'};
  expect((await call('costs',{...expense,amount:-1})).statusCode).toBe(400);
  expect((await call('costs',expense)).statusCode).toBe(200);
  const management=(await call('management?days=7')).json();expect(management.costTotals).toEqual([{currency:'eur',amount:1450}]);expect(management.series).toHaveLength(7);expect(management.series.slice(0,6).every((v:any)=>v.count===0)).toBe(true);expect(management.cohort.registered).toBe(2);
  const audit=await call('audit');expect(audit.json().items.length).toBeGreaterThanOrEqual(3);expect(audit.body).not.toContain('Secret internal note');
 });
 it('requires a verified email code for enrollment and subsequent login; rejects replay and revokes old sessions',async()=>{
  expect((await call('security/start',{password:'wrong'})).statusCode).toBe(401);
  const challenge=(await call('security/start',{password})).json().challenge;expect(sentCode).toMatch(/^\d{6}$/);
  expect((await call('security/confirm',{challenge,code:'000000'})).statusCode).toBe(400);
  expect((await call('security/confirm',{challenge,code:sentCode})).statusCode).toBe(200);
  expect((await call('dashboard')).statusCode).toBe(401);
  const login=await call('login',{email:'owner@example.com',password});expect(login.json().requires_code).toBe(true);expect(login.json().token).toBeUndefined();
  const code=sentCode,c=login.json().challenge;
  const verified=await call('login/verify',{challenge:c,code});expect(verified.statusCode).toBe(200);token=verified.json().token;
  expect((await call('dashboard')).statusCode).toBe(200);
  expect((await call('login/verify',{challenge:c,code})).statusCode).toBe(401);
  expect((await call('security/revoke',{})).statusCode).toBe(200);expect((await call('dashboard')).statusCode).toBe(401);
 });
 it('locks a challenge after five wrong codes and refuses expired challenges',async()=>{
  const challenge=(await call('security/start',{password})).json().challenge;
  for(let i=0;i<5;i++)expect((await call('security/confirm',{challenge,code:'000000'})).statusCode).toBe(400);
  expect((await call('security/confirm',{challenge,code:sentCode})).statusCode).toBe(400);
  const fresh=(await call('security/start',{password})).json().challenge;
  db.raw.prepare('UPDATE admin_challenges SET expires_at=0 WHERE id=?').run(fresh);
  expect((await call('security/confirm',{challenge:fresh,code:sentCode})).statusCode).toBe(400);
  expect((await call('security')).json().enabled).toBe(false);
 });
 it('grants and revokes unlimited Premium without altering Stripe state, and reports the effective quota',async()=>{
  const member=app.jwt.sign({userId:2,adminSession:true,authVersion:0});
  expect((await call('users/2/access',{unlimited:true},member)).statusCode).toBe(403);
  expect((await call('users/2/access',{unlimited:'yes'})).statusCode).toBe(400);
  expect((await call('users/999/access',{unlimited:true})).statusCode).toBe(404);
  expect((await call('users/2')).json().user.access.remaining).toBe(0);
  expect((await call('users/2/access',{unlimited:true})).json().access).toMatchObject({offered:true,unlimited:true,remaining:null});
  const user=db.findUserById(2)!;expect(hasActiveAccess(user,true)).toBe(true);expect(premiumAccess(user)).toBe(true);expect(user.subscription_status).toBe('none');expect(user.stripe_customer_id).toBeNull();
  expect((await call('dashboard')).json().users.find((u:any)=>u.id===2).access.offered).toBe(true);
  db.updateBilling({userId:2,subscriptionStatus:'canceled'});
  expect(hasActiveAccess(db.findUserById(2)!,true)).toBe(true);
  await call('users/2/access',{unlimited:false});expect(hasActiveAccess(db.findUserById(2)!,true)).toBe(false);expect(premiumAccess(db.findUserById(2))).toBe(false);
  expect((await call('users/2')).json().user.access.remaining).toBe(0);
 });
});
