
const ALLOWED_ORIGINS = new Set([
  "https://zakpollyqueens.github.io",
  "https://zakichat.local",
  "http://zakichat.local",
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:8100",
  "capacitor://localhost",
  "ionic://localhost"
]);
function corsHeadersFor(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://zakpollyqueens.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
const blocked = /\b(porn(?:ography)?|xxx|hentai|onlyfans|nudes?|erotic|escort|camgirl|adult\s+(?:videos?|content|sites?)|sex\s+(?:tape|videos?|cams?)|live\s+sex)\b/i;
function json(body: unknown, status=200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {status, headers:{...corsHeadersFor(origin),"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function decodeHtml(value: string) {
  return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]*>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#0*39;|&#x0*27;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g," ").trim();
}
function safeUrl(raw: string) {
  try { const u=new URL(raw); return ["http:","https:"].includes(u.protocol)?u.href:""; } catch { return ""; }
}
function cleanResult(title:string,snippet:string,url:string,extra:Record<string,string>={}) {
  title=decodeHtml(title).slice(0,240);snippet=decodeHtml(snippet).slice(0,600);url=safeUrl(url);
  const thumbnail=extra.thumbnail?safeUrl(extra.thumbnail):"";
  if(!title||!url||blocked.test(title)||blocked.test(snippet))return null;
  return {title,snippet,url,...(thumbnail?{thumbnail}:{}),...(extra.mediaUrl?{mediaUrl:safeUrl(extra.mediaUrl)}:{}),...(extra.kind?{kind:extra.kind}:{})};
}
async function bingRss(query:string) {
  const response=await fetch("https://www.bing.com/search?format=rss&adlt=strict&q="+encodeURIComponent(query),{headers:{"Accept":"application/rss+xml, application/xml, text/xml","User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
  if(!response.ok)throw new Error("Bing HTTP "+response.status);
  const xml=(await response.text()).slice(0,1800000);
  const results:any[]=[];const re=/<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  for(const m of xml.matchAll(re)){
    const block=m[1];const title=block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||"";
    const url=block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||"";
    const snippet=block.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||"";
    const item=cleanResult(title,snippet,url);
    if(item&&!results.some(x=>x.url===item.url)){results.push(item);if(results.length>=12)break}
  }
  return results;
}
async function ddg(query:string) {
  const response=await fetch("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query)+"&kp=1",{headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
  if(!response.ok)throw new Error("DuckDuckGo HTTP "+response.status);
  const html=(await response.text()).slice(0,1800000);
  const results:any[]=[];const seen=new Set<string>();
  const re=/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(re)){
    let target=m[1];try{const parsed=new URL(target,"https://html.duckduckgo.com");target=parsed.searchParams.get("uddg")||parsed.href}catch{continue}
    const fragment=html.slice(m.index||0,Math.min(html.length,(m.index||0)+4500));
    const sm=fragment.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    const item=cleanResult(m[2],sm?.[1]||"",target);
    if(item&&!seen.has(item.url)){seen.add(item.url);results.push(item);if(results.length>=12)break}
  }
  return results;
}
function attr(tag:string,name:string) {
 const re=new RegExp(name+"\\s*=\\s*([\"'])([\\s\\S]*?)\\1","i");
 return tag.match(re)?.[2]||"";
}
async function bingImages(query:string) {
 const response=await fetch("https://www.bing.com/images/search?adlt=strict&q="+encodeURIComponent(query),{headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
 if(!response.ok)throw new Error("Bing Images HTTP "+response.status);
 const html=(await response.text()).slice(0,2200000), results:any[]=[];
 const re=/<a\b[^>]*class=["'][^"']*\biusc\b[^"']*["'][^>]*>/gi;
 for(const match of html.matchAll(re)){
  const tag=match[0],raw=attr(tag,"m");if(!raw)continue;
  try{
   const meta=JSON.parse(decodeHtml(raw));
   const url=safeUrl(meta.purl||meta.murl||"");
   const thumb=safeUrl(meta.turl||meta.murl||"");
   const item=cleanResult(meta.t||meta.desc||"Image result",meta.desc||"",url,{thumbnail:thumb,mediaUrl:meta.murl||meta.turl||"",kind:"image"});
   if(item&&!results.some(x=>x.url===item.url))results.push(item);
   if(results.length>=24)break;
  }catch{}
 }
 return results;
}
async function bingVideos(query:string) {
 const response=await fetch("https://www.bing.com/videos/search?adlt=strict&q="+encodeURIComponent(query),{headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
 if(!response.ok)throw new Error("Bing Videos HTTP "+response.status);
 const html=(await response.text()).slice(0,2200000), results:any[]=[];
 const re=/<a\b[^>]*class=["'][^"']*(?:mc_vtvc|mc_vtvc_con_rc)[^"']*["'][^>]*>/gi;
 for(const match of html.matchAll(re)){
  const tag=match[0],url=safeUrl(attr(tag,"href"));if(!url)continue;
  const title=attr(tag,"aria-label")||attr(tag,"title")||"Video result";
  const item=cleanResult(title,"Open the source page to watch this video.",url,{thumbnail:attr(tag,"data-thumb")||attr(tag,"data-src")||"",kind:"video"});
  if(item&&!results.some(x=>x.url===item.url))results.push(item);
  if(results.length>=20)break;
 }
 if(!results.length)return bingRss(query+" video");
 return results;
}
async function documentSearch(query:string) {
 const terms=query+" (filetype:pdf OR filetype:doc OR filetype:docx OR filetype:ppt OR filetype:pptx)";
 const results=await bingRss(terms);
 const docs=results.filter((x:any)=>/\.(pdf|docx?|pptx?|xlsx?)(?:$|[?#])/i.test(x.url)||/\b(pdf|document|download|notes|paper|examination|exam|results|newspaper|syllabus|report)\b/i.test(x.title+" "+x.snippet));
 return docs.length?docs:results;
}
Deno.serve(async (req: Request) => {
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeadersFor(req.headers.get("Origin"))});
 if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405,req.headers.get("Origin"));
 const origin=req.headers.get("Origin");
 if(origin&&!ALLOWED_ORIGINS.has(origin))return json({success:false,error:"Origin is not authorized."},403,origin);
 let body:Record<string,unknown>;try{body=await req.json()}catch{return json({success:false,error:"A valid JSON body is required."},400,origin)}
 let query=typeof body.query==="string"?body.query.trim().slice(0,160):"";
 const type=typeof body.type==="string"?body.type:"web";
 if(query.length<2)return json({success:false,error:"Enter at least two characters to search."},400,origin);
 if(blocked.test(query))return json({success:false,error:"Adult-content searches are not allowed. Try a different, safe-search phrase."},400,origin);
 query=query.replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim();
 try {
  let results:any[]=[],provider="Bing";
  if(type==="images"){results=await bingImages(query);provider="Bing Images";}
  else if(type==="videos"){results=await bingVideos(query)}
  else if(type==="documents"){results=await documentSearch(query)}
  else {
   const scoped=type==="telegram"?query+" site:t.me":type==="whatsapp"?query+" site:chat.whatsapp.com":query;
   try{results=await ddg(scoped);provider="DuckDuckGo"}catch(error){console.warn("DuckDuckGo failed; trying Bing",error)}
   if(!results.length){results=await bingRss(scoped);provider="Bing"}
  }
  return json({success:true,query,provider,safeSearch:"strict",type,results},200,origin);
 } catch(error) {
  console.error("Search provider failed:",type,error);
  return json({success:false,error:"This search category is temporarily unavailable. Please try again shortly."},502,origin);
 }
});
