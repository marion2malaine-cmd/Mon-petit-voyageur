import http from 'node:http';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/app.css':'app.css','/logo.jpeg':'logo.jpeg'};
const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
const postRoutes=new Set(['/api/admin/login','/api/admin/login/verify','/api/admin/forgot-password','/api/admin/reset-password','/api/admin/costs','/api/admin/security/start','/api/admin/security/confirm','/api/admin/security/revoke']);
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const path=url.pathname;
  const fail=(status,message)=>{if(!res.headersSent){res.writeHead(status,{...security,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:message}));}};
  // Fixed upstream; admin authorization remains enforced by the API.
  // Same-origin browser requests avoid CORS; browser cookies are never forwarded.
  if(path.startsWith('/api/admin/')){
    if(req.method!=='GET'&&!(req.method==='POST'&&(postRoutes.has(path)||/^\/api\/admin\/users\/\d+\/(notes|access)$/.test(path))))return fail(405,'Méthode non autorisée.');
    if(req.headers.origin&&req.headers.origin!==`https://${req.headers.host}`&&req.headers.origin!==`http://${req.headers.host}`)return fail(403,'Origine non autorisée.');
    try{
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>16384)return fail(413,'Requête trop volumineuse.');chunks.push(chunk);}
      const body=Buffer.concat(chunks);
      const headers={'Accept':'application/json','Content-Type':'application/json','Content-Length':body.length};
      if(req.headers.authorization)headers.Authorization=req.headers.authorization;
      const upstream=https.request({hostname:'api.monpetitvoyageur.com',path:path+url.search,method:req.method,headers,timeout:25000},response=>{
        res.writeHead(response.statusCode||502,{...security,'Content-Type':response.headers['content-type']||'application/json',...(response.headers['retry-after']?{'Retry-After':response.headers['retry-after']}:{})});
        response.on('error',()=>res.destroy());response.pipe(res);
      });
      upstream.on('timeout',()=>upstream.destroy(new Error('timeout')));
      upstream.on('error',()=>fail(502,'Le serveur est temporairement indisponible. Réessayez dans un instant.'));
      upstream.end(body);
    }catch{fail(400,'Requête invalide.');}
    return;
  }
  const file=files[path];
  if(!file){res.writeHead(404,security);res.end();return;}
  try{
    const data=await readFile(new URL('./dist/'+file,import.meta.url));
    const type=file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.jpeg')?'image/jpeg':'text/html; charset=utf-8';
    res.writeHead(200,{...security,'Content-Type':type});res.end(data);
  }catch{fail(500,'Indisponible');}
}).listen(Number(process.env.PORT)||4173,'0.0.0.0');
