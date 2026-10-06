import { get, put } from '@vercel/blob';
import crypto from 'node:crypto';

const USERS_PATH='classroom-compass/users.json';
const COOKIE='cc_session';
const json=(res,status=200)=>new Response(JSON.stringify(res),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const parseCookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
const secret=()=>process.env.SESSION_SECRET||'dev-only-change-me';
const sign=s=>crypto.createHmac('sha256',secret()).update(s).digest('base64url');
const tokenFor=u=>{const p=Buffer.from(JSON.stringify({id:u.id,email:u.email,role:u.role,exp:Date.now()+1000*60*60*24*14})).toString('base64url');return p+'.'+sign(p)};
const verify=t=>{try{const [p,s]=String(t||'').split('.');if(!p||!s||!crypto.timingSafeEqual(Buffer.from(sign(p)),Buffer.from(s)))return null;const d=JSON.parse(Buffer.from(p,'base64url').toString());if(d.exp<Date.now())return null;return d}catch{return null}};
const hashPass=(password,salt=crypto.randomBytes(16).toString('hex'))=>{const hash=crypto.scryptSync(String(password),salt,64).toString('hex');return {salt,hash}};
const checkPass=(password,u)=>{try{return crypto.timingSafeEqual(Buffer.from(hashPass(password,u.salt).hash,'hex'),Buffer.from(u.passwordHash,'hex'))}catch{return false}};
async function readJson(path,fallback){const r=await get(path,{access:'private'});if(!r||r.statusCode!==200)return fallback;const txt=await new Response(r.stream).text();try{return JSON.parse(txt)}catch{return fallback}}
async function writeJson(path,data){await put(path,JSON.stringify(data),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true});}
async function users(){return await readJson(USERS_PATH,{users:[],updatedAt:null})}
const safeUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,active:u.active!==false,createdAt:u.createdAt,lastLoginAt:u.lastLoginAt||null});
async function authed(req){const t=parseCookies(req)[COOKIE];const claims=verify(t);if(!claims)return null;const db=await users();const u=db.users.find(x=>x.id===claims.id&&x.active!==false);return u||null}
const cookie=(value,maxAge=1209600)=>`${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export default async function handler(req){
  try{
    const url=new URL(req.url);const action=url.searchParams.get('action')||'me';
    const method=req.method||'GET';
    const body=method==='POST'||method==='PUT'||method==='PATCH'?await req.json().catch(()=>({})):{};
    if(action==='setup-status') { const db=await users(); return json({needsSetup:db.users.length===0}); }
    if(action==='setup'&&method==='POST'){
      const db=await users();if(db.users.length) return json({error:'Setup already completed'},409);
      if(!body.setupToken||body.setupToken!==process.env.ADMIN_SETUP_TOKEN) return json({error:'Invalid setup token'},403);
      if(!body.email||!body.password||String(body.password).length<8)return json({error:'Email and password of at least 8 characters required'},400);
      const hp=hashPass(body.password);const u={id:crypto.randomUUID(),name:String(body.name||'Administrator').trim(),email:String(body.email).trim().toLowerCase(),role:'admin',active:true,salt:hp.salt,passwordHash:hp.hash,createdAt:new Date().toISOString(),lastLoginAt:new Date().toISOString()};db.users.push(u);db.updatedAt=new Date().toISOString();await writeJson(USERS_PATH,db);return new Response(JSON.stringify({ok:true,user:safeUser(u)}),{headers:{'content-type':'application/json','set-cookie':cookie(tokenFor(u))}});
    }
    if(action==='login'&&method==='POST'){
      const db=await users();const email=String(body.email||'').trim().toLowerCase();const u=db.users.find(x=>x.email===email);if(!u||u.active===false||!checkPass(body.password,u))return json({error:'Invalid email or password'},401);u.lastLoginAt=new Date().toISOString();db.updatedAt=new Date().toISOString();await writeJson(USERS_PATH,db);return new Response(JSON.stringify({ok:true,user:safeUser(u)}),{headers:{'content-type':'application/json','set-cookie':cookie(tokenFor(u))}});
    }
    if(action==='logout'){return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','set-cookie':cookie('',0)}})};
    const u=await authed(req);if(!u)return json({error:'Unauthorized'},401);
    if(action==='me')return json({user:safeUser(u)});
    if(action==='data'){
      const path=`classroom-compass/user-${u.id}.json`;
      if(method==='GET')return json({data:await readJson(path,{classes:[],activeClassId:null})});
      if(method==='POST'){if(u.role==='viewer')return json({error:'Viewer is read-only'},403);await writeJson(path,body.data||{});return json({ok:true,savedAt:new Date().toISOString()});}
    }
    if(action==='users'){
      if(u.role!=='admin')return json({error:'Admin only'},403);const db=await users();
      if(method==='GET')return json({users:db.users.map(safeUser)});
      if(method==='POST'){
        const email=String(body.email||'').trim().toLowerCase();if(!email||!body.password||String(body.password).length<8)return json({error:'Valid email and password required'},400);if(db.users.some(x=>x.email===email))return json({error:'Email already exists'},409);const role=body.role==='viewer'?'viewer':'teacher';const hp=hashPass(body.password);const nu={id:crypto.randomUUID(),name:String(body.name||'Teacher').trim(),email,role,active:true,salt:hp.salt,passwordHash:hp.hash,createdAt:new Date().toISOString()};db.users.push(nu);db.updatedAt=new Date().toISOString();await writeJson(USERS_PATH,db);return json({ok:true,user:safeUser(nu)},201);
      }
      if(method==='PATCH'){
        const t=db.users.find(x=>x.id===body.id);if(!t)return json({error:'User not found'},404);
        if(t.role==='admin'){
          if(body.role&&body.role!=='admin')return json({error:'Super Admin role cannot be changed'},403);
          if(body.active===false)return json({error:'Super Admin cannot be disabled'},403);
        }else if(body.role){
          if(!['teacher','viewer'].includes(body.role))return json({error:'Only Teacher or Viewer roles are allowed'},400);
          t.role=body.role;
        }
        if(typeof body.active==='boolean'&&t.role!=='admin')t.active=body.active;
        if(body.name)t.name=String(body.name).trim();
        if(body.password&&String(body.password).length>=8){const hp=hashPass(body.password);t.salt=hp.salt;t.passwordHash=hp.hash}
        db.updatedAt=new Date().toISOString();await writeJson(USERS_PATH,db);return json({ok:true,user:safeUser(t)});
      }
    }
    if(action==='stats'){
      if(u.role!=='admin')return json({error:'Admin only'},403);const db=await users();const counts={total:db.users.length,active:db.users.filter(x=>x.active!==false).length,admins:db.users.filter(x=>x.role==='admin').length,teachers:db.users.filter(x=>x.role==='teacher').length,viewers:db.users.filter(x=>x.role==='viewer').length};return json(counts);
    }
    return json({error:'Not found'},404);
  }catch(e){console.error(e);return json({error:'Server error'},500)}
}
