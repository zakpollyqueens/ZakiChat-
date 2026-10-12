(function () {
  "use strict";

  async function init() {
    const nav = document.querySelector('.bottom-nav, .zc-bottom-nav');
    const profileLink = nav?.querySelector('[data-nav-key="profile"], a[href$="profile.html"]');

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

    const settingsAvatar = document.querySelector('.settings-profile-avatar');
    if (settingsAvatar) {
      settingsAvatar.replaceChildren();
      if (profile.avatar_url) {
        const settingsImage = document.createElement('img');
        settingsImage.src = profile.avatar_url;
        settingsImage.alt = 'Your profile photo';
        settingsImage.className = 'settings-profile-avatar-image';
        settingsImage.onerror = () => { settingsAvatar.textContent = initials; };
        settingsAvatar.appendChild(settingsImage);
      } else {
        settingsAvatar.textContent = initials;
      }
    }

    let icon = profileLink.querySelector('.bottom-nav-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'bottom-nav-icon';
      icon.setAttribute('aria-hidden', 'true');
      const oldSvg = profileLink.querySelector('svg');
      if (oldSvg) oldSvg.replaceWith(icon);
      else profileLink.insertBefore(icon, profileLink.querySelector('span:not(.bottom-nav-icon)'));
    }
    if (!document.getElementById('zc-nav-profile-avatar-style')) {
      const style = document.createElement('style'); style.id = 'zc-nav-profile-avatar-style';
      style.textContent = '.settings-profile-avatar-image{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}.zc-bottom-nav .bottom-nav-icon,.bottom-nav .bottom-nav-icon{display:grid;place-items:center;width:25px;height:25px;overflow:hidden;border-radius:50%;font-size:11px;font-weight:850;background:linear-gradient(135deg,#173e58,#071624);border:1px solid #5ddfff70;color:#dffaff}.bottom-nav-profile-avatar{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}.zc-bottom-nav a.profile-online .bottom-nav-icon,.bottom-nav a.profile-online .bottom-nav-icon{outline:2px solid #39e9a2;outline-offset:2px}'; document.head.appendChild(style);
    }

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
          const settingsAvatar = document.querySelector('.settings-profile-avatar');
          if (settingsAvatar) { settingsAvatar.replaceChildren(); if (url) { const image = document.createElement('img'); image.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; image.alt = 'Your profile photo'; image.className = 'settings-profile-avatar-image'; image.onerror = () => { settingsAvatar.textContent = initials; }; settingsAvatar.appendChild(image); } else { settingsAvatar.textContent = initials; } }

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
