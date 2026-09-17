import{c as e}from"./index-B-qRLH-J.js";
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t=e("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]),a=e("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]),o="vorder_seo_articles_cache";
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */async function n(){try{const e=await fetch(`/api/articles?_t=${Date.now()}`,{cache:"no-store",headers:{Pragma:"no-cache","Cache-Control":"no-cache"}});if(e.ok){const t=await e.json();return"undefined"!=typeof window&&localStorage.setItem(o,JSON.stringify(t)),t}}catch(e){console.warn("[ArticleStore] Cloud fetch failed, falling back to cache:",e)}if("undefined"!=typeof window)try{const e=localStorage.getItem(o);return e?JSON.parse(e):[]}catch{return[]}return[]}async function c(e){try{const t=await fetch(`/api/articles?slug=${encodeURIComponent(e)}&_t=${Date.now()}`,{cache:"no-store"});if(t.ok)return await t.json()}catch(t){console.warn("[ArticleStore] Single article fetch error:",t)}return(await n()).find(t=>t.slug===e)}async function r(e){try{const t=await fetch("/api/articles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(t.ok){const e=await t.json();return await n(),"undefined"!=typeof window&&window.dispatchEvent(new CustomEvent("vorder_articles_updated",{detail:e})),e}}catch(t){console.error("[ArticleStore] Failed to save article to cloud:",t)}return null}async function i(e){try{if((await fetch(`/api/articles?id=${encodeURIComponent(e)}`,{method:"DELETE"})).ok)return await n(),"undefined"!=typeof window&&window.dispatchEvent(new CustomEvent("vorder_articles_updated",{detail:{id:e,deleted:!0}})),!0}catch(t){console.error("[ArticleStore] Failed to delete article from cloud:",t)}return!1}async function s(e){try{await fetch(`/api/articles?slug=${encodeURIComponent(e)}`)}catch{}}export{t as A,a as C,c as a,i as d,n as g,s as r,r as s};
