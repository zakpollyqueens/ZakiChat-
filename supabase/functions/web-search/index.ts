
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://zakpollyqueens.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};
const blocked = /\b(porn(?:ography)?|xxx|hentai|onlyfans|nudes?|erotic|escort|camgirl|adult\s+(?:videos?|content|sites?)|sex\s+(?:tape|videos?|cams?)|live\s+sex)\b/i;
function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), {status, headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function decodeHtml(value: string) {
  return value.replace(/<[^>]*>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#0*39;|&#x0*27;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g," ").trim();
}
function safeUrl(raw: string) {
  try { const u=new URL(raw); return ["http:","https:"].includes(u.protocol)?u.href:""; } catch { return ""; }
}
function cleanResult(title:string,snippet:string,url:string) {
  title=decodeHtml(title).slice(0,240);snippet=decodeHtml(snippet).slice(0,600);url=safeUrl(url);
  if(!title||!url||blocked.test(title)||blocked.test(snippet))return null;
  return {title,snippet,url};
}
async function ddg(query:string) {
  const response=await fetch("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query)+"&kp=1",{headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
  if(!response.ok)throw new Error("DuckDuckGo HTTP "+response.status);
  const html=(await response.text()).slice(0,1800000);
  const results:any[]=[];const seen=new Set<string>();
  const re=/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(re)){
    let target=m[1];try{const parsed=new URL(target,"https://html.duckduckgo.com");target=parsed.searchParams.get("uddg")||parsed.href}catch{continue}
    const start=m.index||0;const fragment=html.slice(start,Math.min(html.length,start+4500));
    const sm=fragment.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    const item=cleanResult(m[2],sm?.[1]||"",target);
    if(item&&!seen.has(item.url)){seen.add(item.url);results.push(item);if(results.length>=12)break}
  }
  return results;
}
async function bing(query:string) {
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
Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405);
  const origin=req.headers.get("Origin");
  if(origin && origin!=="https://zakpollyqueens.github.io")return json({success:false,error:"Origin is not authorized."},403);
  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return json({success:false,error:"A valid JSON body is required."},400)}
  let query=typeof body.query==="string"?body.query.trim().slice(0,160):"";
  if(query.length<2)return json({success:false,error:"Enter at least two characters to search."},400);
  if(blocked.test(query))return json({success:false,error:"Adult-content searches are not allowed. Try a different, safe-search phrase."},400);
  query=query.replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim();
  for(const [provider,search] of [["DuckDuckGo",ddg],["Bing",bing]] as const){
    try{
      const results=await search(query);
      if(results.length)return json({success:true,query,provider,safeSearch:"strict",results});
      console.warn("Web search provider returned no parseable results:",provider);
    }catch(error){console.error("Web search provider failed:",provider,error)}
  }
  return json({success:false,error:"Search providers are temporarily unavailable. Please try again shortly."},502);
});
