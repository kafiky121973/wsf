/** مسارات التطبيق — للقوالب عبر url_for('name') */
const ROUTES = {
  "main.index": "/",
  "auth.login": "/auth/login",
  "auth.logout": "/auth/logout",
  "register.start": "/join",
  "register.account": "/join/account",
  "register.status": "/join/status",
  "profile.location": "/profile/location",
  "gallery.index": "/gallery",
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
  "admin.dashboard": "/admin",
  "admin.users": "/admin/users",
  "admin.permissions": "/admin/permissions",
  "admin.newsletter": "/admin/newsletter",
  "admin.owner_messages": "/admin/owner-messages",
  "owner.thread": "/owner",
  "admin.library_manage": "/admin/library/manage",
  "admin.library_template": "/admin/library/template",
  "admin.knowledge": "/admin/knowledge",
  "admin.knowledge_qa_edit": "/admin/knowledge/qa/:slug/edit",
  "designer.studio": "/designer",
  "designer.save": "/designer/save",
};

function urlFor(name, params = {}) {
  if (name === "static") {
    const f = params.filename || params["filename"] || "";
    return "/static/" + String(f).replace(/^\.\.\//, "").replace(/^uploads\//, "");
  }
  if (name === "uploads") {
    const f = params.filename || params.path || "";
    return "/uploads/" + String(f).replace(/^\//, "");
  }
  if (name === "library.level") {
    return `/library/level/${params.level_num ?? params.level ?? params.num}`;
  }
  if (name === "library.video") {
    return `/library/video/${params.video_id ?? params.id}`;
  }
  if (name === "gallery.show") {
    return `/gallery/${params.post_id ?? params.id}`;
  }
  if (name === "community.journal_view") {
    return `/community/journal/${params.id ?? params.entry_id}`;
  }
  if (name === "community.journal_edit") {
    return `/community/journal/${params.id}/edit`;
  }
  if (name === "admin.library_video_edit") {
    return `/admin/library/video/${params.id ?? params.video_id}/edit`;
  }
  if (name === "admin.knowledge_qa_edit") {
    return `/admin/knowledge/qa/${params.slug ?? params.id}/edit`;
  }
  if (name === "admin.users_rate") {
    return `/admin/users/${params.id}/rate`;
  }
  if (name === "admin.library_toggle") {
    return `/admin/library/${params.id}/toggle`;
  }
  if (name === "admin.library_delete") {
    return `/admin/library/${params.id}/delete`;
  }
  if (name === "admin.library_segment_update") {
    return `/admin/library/segments/${params.id}/update`;
  }
  if (name === "admin.library_segment_delete") {
    return `/admin/library/segments/${params.id}/delete`;
  }
  if (name === "community.moderate_post") {
    const id = params.post_id ?? params.id;
    const action = params.action;
    return `/community/moderation/${id}/${action}`;
  }
  if (name === "cadres.reply_consultation") {
    return `/cadres/panel/${params.cid}/reply`;
  }
  return ROUTES[name] || "/";
}

module.exports = { urlFor, ROUTES };
