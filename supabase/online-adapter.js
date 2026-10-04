// Optional online adapter. It uses Supabase REST/Auth directly and keeps the manager dependency-free.
(function () {
  const config = window.BURDA_SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey || config.url.includes('YOUR_PROJECT')) return;

  const headers = {
    apikey: config.anonKey,
    'Content-Type': 'application/json'
  };
  const authHeaders = () => ({ ...headers, Authorization: `Bearer ${window.BURDA_SUPABASE_SESSION?.access_token || config.anonKey}` });

  window.burdaOnline = {
    enabled: true,
    async signIn(email, password) {
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers, body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw new Error('تعذر تسجيل الدخول إلى Supabase.');
      const session = await response.json();
      window.BURDA_SUPABASE_SESSION = session;
      return session;
    },
    async loadProject() {
      const session = window.BURDA_SUPABASE_SESSION;
      if (!session?.user?.id) throw new Error('سجّل الدخول قبل تحميل المشروع.');
      const query = `owner_id=eq.${encodeURIComponent(session.user.id)}&slug=eq.${encodeURIComponent(config.projectSlug || 'default')}`;
      const response = await fetch(`${config.url}/rest/v1/burdah_projects?select=data&${query}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('تعذر تحميل البيانات من قاعدة البيانات.');
      const rows = await response.json();
      return rows[0]?.data || null;
    },
    async saveProject(data) {
      const session = window.BURDA_SUPABASE_SESSION;
      if (!session?.user?.id) throw new Error('سجّل الدخول قبل حفظ المشروع.');
      const payload = { owner_id: session.user.id, slug: config.projectSlug || 'default', data };
      const response = await fetch(`${config.url}/rest/v1/burdah_projects?on_conflict=owner_id,slug`, {
        method: 'POST', headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('تعذر حفظ البيانات في قاعدة البيانات.');
    }
  };
})();
