import { getSecurityConfig, updateSecurityConfig } from './securityService.js';

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Infinity Security Dashboard</title>
<style>
:root{color-scheme:dark}body{font-family:Inter,Arial,sans-serif;background:#0b1020;color:#f8fafc;margin:0}main{max-width:1250px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}h1{margin:0 0 4px}.muted{color:#94a3b8;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px}.card{background:#111827;border:1px solid #263244;border-radius:14px;padding:18px;box-shadow:0 10px 30px #0003}.row{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:12px 0}.field{display:block;margin:10px 0}.field span{display:block;color:#cbd5e1;font-size:13px;margin-bottom:5px}input,select,textarea,button{font:inherit;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:8px;padding:9px;box-sizing:border-box}input,select,textarea{width:100%}input[type=checkbox]{width:auto;accent-color:#5865f2}button{cursor:pointer}button.primary{background:#5865f2;border-color:#5865f2}.danger{background:#7f1d1d!important;border-color:#991b1b!important}.status{padding:10px 12px;border-radius:9px;background:#064e3b;margin:16px 0}.status.bad{background:#7f1d1d}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.wide{grid-column:1/-1}.table{width:100%;border-collapse:collapse}.table th,.table td{border-bottom:1px solid #263244;padding:8px;text-align:left}.pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#1e293b;margin:2px}.hidden{display:none}.notice{padding:10px;border:1px solid #475569;border-radius:9px;background:#0f172a;margin-top:10px}
</style>
</head>
<body><main>
<div class="top"><div><h1>Infinity Security</h1><div class="muted">Anti-Nuke • Anti-Raid • Advanced AutoMod • Escalation • Whitelist</div></div><div id="guildName" class="muted"></div></div>
<div id="login" class="card" style="margin-top:18px"><h2>Dashboard Access</h2><p class="muted">Enter the SECURITY_DASHBOARD_TOKEN configured on the bot host.</p><label class="field"><span>Token</span><input id="token" type="password" autocomplete="off"></label><button class="primary" onclick="login()">Open Dashboard</button></div>
<div id="app" class="hidden">
<div id="status" class="status">Loading...</div>
<div class="grid">
<section class="card"><h2>Protection</h2>
<div class="row"><span>Security system</span><input id="enabled" type="checkbox"></div>
<div class="row"><span>Anti-Nuke</span><input id="nuke" type="checkbox"></div>
<div class="row"><span>Anti-Raid</span><input id="raid" type="checkbox"></div>
<div class="row"><span>Advanced AutoMod</span><input id="automod" type="checkbox"></div>
<div class="row"><span>Anti-Nuke lockdown alert</span><input id="nukeLockdown" type="checkbox"></div>
</section>
<section class="card"><h2>Anti-Nuke</h2>
<label class="field"><span>Detection window (ms)</span><input id="nukeWindow" type="number" min="1000"></label>
<label class="field"><span>Channel delete threshold</span><input id="channelDelete" type="number" min="1"></label>
<label class="field"><span>Channel create threshold</span><input id="channelCreate" type="number" min="1"></label>
<label class="field"><span>Role delete threshold</span><input id="roleDelete" type="number" min="1"></label>
<label class="field"><span>Role create threshold</span><input id="roleCreate" type="number" min="1"></label>
<label class="field"><span>Role permission escalation threshold</span><input id="roleUpdate" type="number" min="1"></label>
<label class="field"><span>Webhook changes threshold</span><input id="webhookUpdate" type="number" min="1"></label>
<label class="field"><span>Ban threshold</span><input id="ban" type="number" min="1"></label>
<label class="field"><span>Kick threshold</span><input id="kick" type="number" min="1"></label>
<label class="field"><span>Bot additions threshold</span><input id="botAdd" type="number" min="1"></label>
<label class="field"><span>Response</span><select id="nukeAction"><option value="strip">Strip dangerous roles</option><option value="kick">Kick executor</option><option value="ban">Ban executor</option></select></label>
</section>
<section class="card"><h2>Anti-Raid</h2>
<label class="field"><span>Joins required</span><input id="raidJoins" type="number" min="2"></label>
<label class="field"><span>Join window (ms)</span><input id="raidWindow" type="number" min="1000"></label>
<label class="field"><span>Minimum account age (hours)</span><input id="accountAge" type="number" min="0"></label>
<label class="field"><span>Flagged member action</span><select id="raidAction"><option value="timeout">Timeout</option><option value="kick">Kick</option></select></label>
<label class="field"><span>Timeout (minutes)</span><input id="raidTimeout" type="number" min="1"></label>
<label class="field"><span>Lockdown duration (minutes)</span><input id="lockdownMinutes" type="number" min="1"></label>
<div class="row"><span>Temporary lockdown</span><input id="lockdown" type="checkbox"></div>
</section>
<section class="card"><h2>AutoMod Detection</h2>
<label class="field"><span>Spam messages</span><input id="spamMax" type="number" min="2"></label>
<label class="field"><span>Spam window (ms)</span><input id="spamWindow" type="number" min="1000"></label>
<label class="field"><span>Duplicate repeats</span><input id="duplicateMax" type="number" min="2"></label>
<label class="field"><span>Duplicate window (ms)</span><input id="duplicateWindow" type="number" min="1000"></label>
<label class="field"><span>Max mentions</span><input id="mentionMax" type="number" min="1"></label>
<div class="row"><span>Invite links</span><input id="invites" type="checkbox"></div>
<div class="row"><span>External links</span><input id="links" type="checkbox"></div>
<div class="row"><span>Duplicate messages</span><input id="duplicates" type="checkbox"></div>
<div class="row"><span>Excessive caps</span><input id="caps" type="checkbox"></div>
<div class="row"><span>Blocked words</span><input id="badWordsEnabled" type="checkbox"></div>
<label class="field"><span>Blocked words (one per line)</span><textarea id="badWords" rows="5"></textarea></label>
<label class="field"><span>Default action</span><select id="autoAction"><option value="delete">Delete</option><option value="warn">Warn</option><option value="timeout">Timeout</option></select></label>
</section>
<section class="card"><h2>Escalation</h2><p class="muted">Actions are applied after a violation. Strikes decay automatically after the configured period.</p>
<label class="field"><span>Strike decay (hours)</span><input id="strikeDecay" type="number" min="1"></label>
<div id="escalationRows"></div>
</section>
<section class="card"><h2>Logging</h2>
<label class="field"><span>Security log channel ID</span><input id="logChannel" placeholder="Channel ID"></label>
<label class="field"><span>Ignored channels (one ID per line)</span><textarea id="ignoredChannels" rows="5"></textarea></label>
</section>
<section class="card"><h2>Whitelist</h2>
<label class="field"><span>Users</span><textarea id="users" rows="5" placeholder="One user ID per line"></textarea></label>
<label class="field"><span>Roles</span><textarea id="roles" rows="5" placeholder="One role ID per line"></textarea></label>
<label class="field"><span>Bots</span><textarea id="bots" rows="5" placeholder="One bot ID per line"></textarea></label>
<div class="notice">Whitelisted users/roles/bots bypass Anti-Nuke and AutoMod. The guild owner is always protected.</div>
</section>
</div>
<div class="actions"><button class="primary" onclick="save()">Save Security Settings</button><button onclick="load()">Reload</button><button onclick="logout()">Logout</button></div>
</div></main>
<script>
let cfg=null;const $=id=>document.getElementById(id);
function login(){const token=$("token").value.trim();if(!token)return;localStorage.securityToken=token;load()}
function logout(){localStorage.removeItem('securityToken');location.reload()}
async function api(path,opt={}){opt.headers={...(opt.headers||{}),'X-Security-Token':localStorage.securityToken,'Content-Type':'application/json'};const r=await fetch(path,opt);if(!r.ok)throw new Error(await r.text());return r.json()}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fillEscalation(){const box=$('escalationRows');box.innerHTML='';for(let i=0;i<cfg.escalation.length;i++){const e=cfg.escalation[i]||{};const row=document.createElement('div');row.className='row';row.innerHTML='<span>Strike '+(i+1)+'</span><select data-strike="'+i+'" class="escAction"><option value="warn">Warn</option><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Ban</option></select><input data-strike-duration="'+i+'" type="number" min="0" placeholder="duration ms">';box.appendChild(row);row.querySelector('.escAction').value=e.action||'warn';row.querySelector('[data-strike-duration]').value=e.durationMs||0}}
function fill(){let c=cfg;$('enabled').checked=c.enabled;$('nuke').checked=c.antiNuke.enabled;$('raid').checked=c.antiRaid.enabled;$('automod').checked=c.autoMod.enabled;$('nukeLockdown').checked=!!c.antiNuke.lockdown;$('nukeWindow').value=c.antiNuke.windowMs;$('channelDelete').value=c.antiNuke.thresholds.channelDelete;$('channelCreate').value=c.antiNuke.thresholds.channelCreate;$('roleDelete').value=c.antiNuke.thresholds.roleDelete;$('roleCreate').value=c.antiNuke.thresholds.roleCreate;$('roleUpdate').value=c.antiNuke.thresholds.roleUpdate??3;$('webhookUpdate').value=c.antiNuke.thresholds.webhookUpdate??3;$('ban').value=c.antiNuke.thresholds.ban;$('kick').value=c.antiNuke.thresholds.kick;$('botAdd').value=c.antiNuke.thresholds.botAdd;$('nukeAction').value=c.antiNuke.action;$('raidJoins').value=c.antiRaid.joins;$('raidWindow').value=c.antiRaid.windowMs;$('accountAge').value=c.antiRaid.minAccountAgeMs/3600000;$('raidAction').value=c.antiRaid.action;$('raidTimeout').value=c.antiRaid.timeoutMs/60000;$('lockdownMinutes').value=c.antiRaid.lockdownMs/60000;$('lockdown').checked=c.antiRaid.lockdown;$('spamMax').value=c.autoMod.spam.maxMessages;$('spamWindow').value=c.autoMod.spam.windowMs;$('duplicateMax').value=c.autoMod.duplicate.maxRepeats;$('duplicateWindow').value=c.autoMod.duplicate.windowMs;$('mentionMax').value=c.autoMod.mentions.max;$('invites').checked=c.autoMod.invites.enabled;$('links').checked=c.autoMod.links.enabled;$('duplicates').checked=c.autoMod.duplicate.enabled;$('caps').checked=c.autoMod.caps.enabled;$('badWordsEnabled').checked=c.autoMod.badWords.enabled;$('badWords').value=(c.autoMod.badWords.words||[]).join('\n');$('autoAction').value=c.autoMod.action;$('strikeDecay').value=(c.strikeDecayMs||86400000)/3600000;$('logChannel').value=c.logChannelId||'';$('ignoredChannels').value=(c.ignoredChannels||[]).join('\n');$('users').value=(c.whitelist.users||[]).join('\n');$('roles').value=(c.whitelist.roles||[]).join('\n');$('bots').value=(c.whitelist.bots||[]).join('\n');$('guildName').textContent='Guild: '+(c.guildName||'selected server');fillEscalation();$('status').textContent='Loaded successfully';$('status').className='status'}
function num(id,min=0){const n=Number($(id).value);return Number.isFinite(n)?Math.max(min,n):min}
async function save(){const escalation=[...document.querySelectorAll('.escAction')].map((el,i)=>({strike:i+1,action:el.value,durationMs:num('x',0)}));document.querySelectorAll('[data-strike-duration]').forEach((el,i)=>escalation[i].durationMs=Math.max(0,Number(el.value)||0));const patch={enabled:$('enabled').checked,antiNuke:{enabled:$('nuke').checked,windowMs:num('nukeWindow',1000),lockdown:$('nukeLockdown').checked,thresholds:{channelDelete:num('channelDelete',1),channelCreate:num('channelCreate',1),roleDelete:num('roleDelete',1),roleCreate:num('roleCreate',1),roleUpdate:num('roleUpdate',1),webhookUpdate:num('webhookUpdate',1),ban:num('ban',1),kick:num('kick',1),botAdd:num('botAdd',1)},action:$('nukeAction').value},antiRaid:{enabled:$('raid').checked,joins:num('raidJoins',2),windowMs:num('raidWindow',1000),minAccountAgeMs:num('accountAge',0)*3600000,action:$('raidAction').value,timeoutMs:num('raidTimeout',1)*60000,lockdown:$('lockdown').checked,lockdownMs:num('lockdownMinutes',1)*60000},autoMod:{enabled:$('automod').checked,spam:{enabled:true,maxMessages:num('spamMax',2),windowMs:num('spamWindow',1000)},duplicate:{enabled:$('duplicates').checked,maxRepeats:num('duplicateMax',2),windowMs:num('duplicateWindow',1000)},mentions:{enabled:true,max:num('mentionMax',1)},caps:{enabled:$('caps').checked,ratio:cfg.autoMod.caps.ratio,minLength:cfg.autoMod.caps.minLength},invites:{enabled:$('invites').checked},links:{enabled:$('links').checked},badWords:{enabled:$('badWordsEnabled').checked,words:$('badWords').value.split(/\s+/).map(x=>x.trim()).filter(Boolean).slice(0,100)},action:$('autoAction').value},escalation,strikeDecayMs:num('strikeDecay',1)*3600000,logChannelId:$('logChannel').value.trim()||null,ignoredChannels:$('ignoredChannels').value.split(/\s+/).map(x=>x.trim()).filter(Boolean),whitelist:{users:$('users').value.split(/\s+/).map(x=>x.trim()).filter(Boolean),roles:$('roles').value.split(/\s+/).map(x=>x.trim()).filter(Boolean),bots:$('bots').value.split(/\s+/).map(x=>x.trim()).filter(Boolean)}};try{cfg=await api('/api/security/config',{method:'PATCH',body:JSON.stringify(patch)});fill()}catch(e){$('status').textContent='Save failed: '+e.message;$('status').className='status bad'}}
async function load(){try{cfg=await api('/api/security/config');$('login').classList.add('hidden');$('app').classList.remove('hidden');fill()}catch(e){$('status').textContent='Invalid token or dashboard unavailable';$('status').className='status bad';$('login').classList.remove('hidden');$('app').classList.add('hidden')}}
if(localStorage.securityToken)load();
</script></body></html>`;

function getAllowedGuild(client, guildId) {
  const configured = process.env.SECURITY_DASHBOARD_GUILD_ID || process.env.GUILD_ID || null;
  const selectedId = guildId || configured;
  if (selectedId) return client.guilds.cache.get(selectedId) || null;
  return client.guilds.cache.first() || null;
}

export function registerSecurityDashboard(app, client) {
  const token = process.env.SECURITY_DASHBOARD_TOKEN;
  const authorized = req => Boolean(token && req.headers['x-security-token'] && req.headers['x-security-token'] === token);

  app.get('/security', (req, res) => res.type('html').send(HTML));

  app.get('/api/security/config', async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    const guild = getAllowedGuild(client, req.query.guildId);
    if (!guild) return res.status(503).json({ error: 'Configured guild is not available' });
    try {
      const config = await getSecurityConfig(client, guild.id);
      res.json({ ...config, guildName: guild.name, guildId: guild.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/security/config', async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    const guild = getAllowedGuild(client, req.query.guildId || req.body?.guildId);
    if (!guild) return res.status(503).json({ error: 'Configured guild is not available' });
    try {
      const updated = await updateSecurityConfig(client, guild.id, req.body || {});
      res.json({ ...updated, guildName: guild.name, guildId: guild.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
