(function () {
  "use strict";

  async function init() {
    const nav = document.querySelector('.bottom-nav');
    const profileLink = nav?.querySelector('[data-nav-key="profile"]');

    if (!profileLink || !window.ZakiChatAuth?.client) return;

    const client = window.ZakiChatAuth.client;

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user?.id) return;

    const { data: profile, error } = await client
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_online, last_seen')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) return;

    const icon = profileLink.querySelector('.bottom-nav-icon');
    if (!icon) return;

    const name =
      profile.full_name ||
      profile.username ||
      user.email?.split('@')[0] ||
      'User';

    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || '?';

    icon.innerHTML = '';

    if (profile.avatar_url) {
      const img = document.createElement('img');
      img.src = profile.avatar_url;
      img.alt = 'Profile';
      img.className = 'bottom-nav-profile-avatar';
      img.loading = 'eager';
      img.addEventListener('error', () => {
        icon.textContent = initials;
      });
      icon.appendChild(img);
    } else {
      icon.textContent = initials;
    }

    profileLink.setAttribute(
      'aria-label',
      `Profile: ${name}`
    );

    profileLink.title = name;

    if (profile.is_online) {
      profileLink.classList.add('profile-online');
    } else {
      profileLink.classList.remove('profile-online');
    }

    if (profileLink.dataset.profileReady === 'true') return;

    profileLink.dataset.profileReady = 'true';

    client
      .channel('bottom-nav-profile')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        payload => {
          const updated = payload.new || {};
          const url = updated.avatar_url;

          icon.innerHTML = '';

          if (url) {
            const img = document.createElement('img');
            img.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
            img.alt = 'Profile';
            img.className = 'bottom-nav-profile-avatar';
            icon.appendChild(img);
          } else {
            icon.textContent = initials;
          }

          profileLink.classList.toggle(
            'profile-online',
            Boolean(updated.is_online)
          );
        }
      )
      .subscribe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
