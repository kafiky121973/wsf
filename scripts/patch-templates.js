const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "templates");

const simple = {
  "main.index": "/",
  "auth.login": "/auth/login",
  "auth.logout": "/auth/logout",
  "register.start": "/join",
  "register.account": "/join/account",
  "register.pledge": "/join/pledge",
  "register.quiz": "/join/quiz",
  "register.status": "/join/status",
  "library.index": "/library",
  "library.search": "/library/search",
  "community.index": "/community",
  "community.journal_list": "/community/journal",
  "community.journal_new": "/community/journal/new",
  "community.submit_post": "/community/submit",
  "community.moderation": "/community/moderation",
  "cadres.index": "/cadres",
  "cadres.consult": "/cadres/consult",
  "cadres.my_consultations": "/cadres/my-consultations",
  "cadres.knowledge_search": "/cadres/knowledge/search",
  "cadres.panel": "/cadres/panel",
  "market.index": "/market",
  "market.order": "/market/order",
  "market.my_orders": "/market/my-orders",
  "market.manage_points": "/market/manage",
  "market.add_point": "/market/manage/add",
  "admin.dashboard": "/admin",
  "admin.users": "/admin/users",
  "admin.permissions": "/admin/permissions",
  "admin.update_permissions": "/admin/permissions/update",
  "admin.newsletter": "/admin/newsletter",
  "admin.library_manage": "/admin/library/manage",
  "designer.studio": "/designer",
  "designer.save": "/designer/save",
  "designer.preview": "/",
};

function patch(content) {
  let c = content;
  Object.entries(simple).forEach(([name, url]) => {
    c = c.replace(new RegExp(`\\{\\{\\s*url_for\\('${name.replace(".", "\\.")}'\\)\\s*\\}\\}`, "g"), url);
    c = c.replace(new RegExp(`url_for\\('${name.replace(".", "\\.")}'\\)`, "g"), `'${url}'`);
  });
  c = c.replace(
    /\{\{\s*url_for\('static',\s*filename='([^']+)'\)\s*\}\}/g,
    "/static/$1"
  );
  c = c.replace(
    /url_for\('static',\s*filename='([^']+)'\)/g,
    "'/static/$1'"
  );
  c = c.replace(
    /\{\{\s*url_for\('library\.level',\s*level_num=([^)]+)\)\s*\}\}/g,
    "/library/level/{{ $1 }}"
  );
  c = c.replace(
    /url_for\('library\.level',\s*level_num=([^)]+)\)/g,
    "'/library/level/' + $1"
  );
  c = c.replace(
    /\{\{\s*url_for\('library\.video',\s*video_id=([^)]+)\)\s*\}\}/g,
    "/library/video/{{ $1 }}"
  );
  c = c.replace(
    /url_for\('library\.video',\s*video_id=([^)]+)\)/g,
    "'/library/video/' + $1"
  );
  c = c.replace(
    /action="\{\{\s*url_for\('admin\.approve_user',\s*user_id=([^)]+)\)\s*\}\}"/g,
    'action="/admin/users/{{ $1 }}/approve"'
  );
  c = c.replace(
    /action="\{\{\s*url_for\('admin\.set_role',\s*user_id=([^)]+)\)\s*\}\}"/g,
    'action="/admin/users/{{ $1 }}/role"'
  );
  c = c.replace(
    /action="\{\{\s*url_for\('community\.moderate_post',\s*post_id=([^,]+),\s*action='([^']+)'\)\s*\}\}"/g,
    'action="/community/moderation/{{ $1 }}/$2"'
  );
  c = c.replace(
    /action="\{\{\s*url_for\('cadres\.reply_consultation',\s*cid=([^)]+)\)\s*\}\}"/g,
    'action="/cadres/panel/{{ $1 }}/reply"'
  );
  c = c.replace(
    /\{\{\s*url_for\('library\.video',\s*video_id=r\.video_id\)\s*\}\}#t=\{\{\s*r\.start_seconds\|int\s*\}\}/g,
    "/library/video/{{ r.video_id }}#t={{ r.start_seconds | int }}"
  );
  c = c.replace(
    /\{% with messages = get_flashed_messages\(with_categories=true\) %\}[\s\S]*?\{% endwith %\}/g,
    `{% if messages %}
      <motion class="wrap flash-messages">
        {% for category, message in messages %}
        <div class="alert alert-{{ category }}">{{ message }}</motion>
        {% endfor %}
      </div>
      {% endif %}`
  );
  c = c.replace(/<motion /g, "<div ");
  c = c.replace(/<\/motion>/g, "</motion>");
  c = c.replace(
    /url_for\('library\.index'\) if current_user and current_user\.status == 'active' else url_for\('register\.start'\)/g,
    "('/library' if current_user and current_user.status == 'active' else '/join')"
  );
  c = c.replace(
    /url_for\('community\.index'\) if current_user and current_user\.status == 'active' else url_for\('register\.start'\)/g,
    "('/community' if current_user and current_user.status == 'active' else '/join')"
  );
  c = c.replace(
    /url_for\('market\.index'\) if current_user and current_user\.status == 'active' else url_for\('register\.start'\)/g,
    "('/market' if current_user and current_user.status == 'active' else '/join')"
  );
  c = c.replace(
    /\{\{\s*\('\/library' if current_user and current_user\.status == 'active' else '\/join'\)\s*\}\}/g,
    "{{ '/library' if current_user and current_user.status == 'active' else '/join' }}"
  );
  c = c.replace(
    /\{\{\s*'%02d:%02d'\|format\(\(s\.start_seconds\s*\/\/\s*60\)\|int,\s*\(s\.start_seconds\s*%\s*60\)\|int\)\s*\}\}/g,
    "{{ fmtTime(s.start_seconds) }}"
  );
  return c;
}

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".html")) {
      const orig = fs.readFileSync(p, "utf8");
      const next = patch(orig);
      if (next !== orig) fs.writeFileSync(p, next, "utf8");
    }
  }
}

walk(dir);
console.log("Templates patched for Node/Nunjucks.");
