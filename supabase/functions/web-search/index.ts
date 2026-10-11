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
  return value.replace(/<[^>]*>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#0*39;|&#x0*27;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g," ").trim();
}
function unwrap(raw: string) {
  try {
    const u=new URL(raw, "https://html.duckduckgo.com");
    const target=u.searchParams.get("uddg");
    const url=target?decodeURIComponent(target):u.href;
    const parsed=new URL(url);
    if(!["http:","https:"].includes(parsed.protocol))return "";
    return parsed.href;
  } catch { return ""; }
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
  try{
    const url="https://html.duckduckgo.com/html/?q="+encodeURIComponent(query)+"&kp=1";
    const response=await fetch(url,{headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (compatible; ZakiChatSearch/1.0)"}});
    if(!response.ok)throw new Error("The search provider returned HTTP "+response.status);
    const html=(await response.text()).slice(0,1800000);
    const anchors=[...html.matchAll(/<a\b(?=[^>]*class=["'][^"']*result__a)[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const results=[];const seen=new Set();
    for(const match of anchors){
      const url=unwrap(match[1]);const title=decodeHtml(match[2]);
      if(!url||!title||blocked.test(title)||seen.has(url))continue;
      const start=match.index??0;const nextAnchor=html.indexOf('class="result__a"',start+match[0].length);
      const fragment=html.slice(start,nextAnchor<0?Math.min(html.length,start+5000):nextAnchor);
      const snippetMatch=fragment.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
      const snippet=snippetMatch?decodeHtml(snippetMatch[1]):"";
      if(blocked.test(snippet))continue;
      results.push({title:title.slice(0,240),snippet:snippet.slice(0,600),url});
      seen.add(url);if(results.length>=12)break;
    }
    return json({success:true,query,provider:"DuckDuckGo Safe Search",safeSearch:"strict",results});
  }catch(error){
    console.error("Web search provider error:",error);
    return json({success:false,error:"The web search provider is temporarily unavailable. Please try again."},502);
  }
});