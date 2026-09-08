export function startMetrics() {
  if (location.pathname.startsWith('/admin') || location.hostname.includes('voyageur-admin')) return;
  const base=import.meta.env.VITE_API_BASE_URL || 'https://api.monpetitvoyageur.com';
  function send(kind:string,target:string){void fetch(base+'/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,target}),credentials:'omit',keepalive:true}).catch(()=>{});}
  send('page_view','home');
  document.addEventListener('click',event=>{
    const el=(event.target as HTMLElement)?.closest?.('a');
    if(!el || !/^https?:/.test(el.href))return;
    const url=new URL(el.href);
    if(url.origin===location.origin)return;
    send('click',/booking|skyscanner|getyourguide|viator|airbnb|civitatis/.test(url.hostname)?'booking':'other_external');
  });
}
