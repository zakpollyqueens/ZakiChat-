(function () {
  'use strict';

  const FALLBACK_VERSION = 'zc-vr15';

  const fallbackLatestVersion = {
    version: 'zc-vr15',
    title: 'ZakiChat zc-vr15',
    description:
      'The latest publicly available ZakiChat version is available for free download.',
    releaseDate: null,
    channel: 'Stable',
    downloadUrl: '#'
  };

  const fallbackVersions = [
    {
      version: 'zc-vr15',
      title: 'Current Version',
      description: 'Current ZakiChat starting release.',
      state: 'Current',
      current: true
    },
    {
      version: 'zc-vr14',
      title: 'Recent Version',
      description: 'Previous ZakiChat version.',
      state: 'Previous',
      current: false
    },
    {
      version: 'zc-vr13',
      title: 'Former Version',
      description: 'Earlier ZakiChat version.',
      state: 'Archived',
      current: false
    }
  ];

  const fallbackPaidUpgrades = [];

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function renderLatestVersion(release) {
    const data = release || fallbackLatestVersion;

    const version = data.version || FALLBACK_VERSION;

    setText('current-version', version);
    setText('info-version', version);
    setText('footer-version', version);

    setText('latest-free-version', version);

    setText(
      'latest-free-title',
      data.title || `ZakiChat ${version}`
    );

    setText(
      'latest-free-description',
      data.description || ''
    );

    setText(
      'latest-free-date',
      formatDate(data.releaseDate)
    );

    setText(
      'latest-free-channel',
      data.channel || 'Stable'
    );

    const button = document.getElementById(
      'latest-download-button'
    );

    if (button && button.dataset.downloadGuarded !== 'true') {
      button.dataset.downloadGuarded = 'true';
      button.addEventListener('click', event => {
        if (button.getAttribute('aria-disabled') === 'true') event.preventDefault();
      });
    }

    if (button) {
      const downloadUrl = data.downloadUrl || '';
      if (downloadUrl) {
        button.href = downloadUrl;
        button.removeAttribute('aria-disabled');
        button.removeAttribute('tabindex');
        button.classList.remove('is-disabled');
        button.textContent = 'Download Latest Version';
      } else {
        button.href = '#';
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('tabindex', '-1');
        button.classList.add('is-disabled');
        button.textContent = 'No published download yet';
      }
    }

    setText(
      'release-channel',
      data.channel || 'Stable'
    );
  }

  function renderPaidUpgrades(upgrades) {
    const container = document.getElementById('paid-upgrades');

    if (!container) {
      return;
    }

    if (!Array.isArray(upgrades) || upgrades.length === 0) {
      return;
    }

    container.innerHTML = upgrades
      .map(function (upgrade) {
        return `
          <article class="upgrade-placeholder">

            <div class="upgrade-icon">↑</div>

            <div>
              <h3>${escapeHtml(upgrade.title || upgrade.version)}</h3>

              <p>
                ${escapeHtml(upgrade.description || '')}
              </p>

              <p>
                Upgrade fee:
                <strong>
                  ${escapeHtml(upgrade.price || 'See upgrade details')}
                </strong>
              </p>

              <a
                class="release-action"
                href="${escapeAttribute(upgrade.upgradeUrl || '#')}"
              >
                Upgrade Now
              </a>
            </div>

          </article>
        `;
      })
      .join('');
  }

  function renderVersions(versions) {
    const container = document.getElementById(
      'version-history'
    );

    if (!container) {
      return;
    }

    const list = Array.isArray(versions) ? versions : fallbackVersions;

    if (list.length === 0) {
      container.innerHTML = '<p class="empty-state">No published release history is available yet.</p>';
      return;
    }

    container.innerHTML = list
      .map(function (item) {
        return `
          <article class="version-item">

            <div class="version-number">
              ${escapeHtml(item.version || '')}
            </div>

            <div class="version-details">

              <h3>
                ${escapeHtml(item.title || '')}
              </h3>

              <p>
                ${escapeHtml(item.description || '')}
              </p>

            </div>

            <span class="version-state ${item.current ? 'current' : ''}">
              ${escapeHtml(item.state || '')}
            </span>

          </article>
        `;
      })
      .join('');
  }

  function renderNotes(notes) {
    const container = document.getElementById(
      'release-notes'
    );

    if (!container) {
      return;
    }

    if (!Array.isArray(notes) || notes.length === 0) {
      container.innerHTML = '<div class="note-item"><p>No release notes have been published yet.</p></div>';
      return;
    }

    container.innerHTML = notes
      .map(function (note) {
        return `
          <div class="note-item">
            <span class="note-dot"></span>
            <p>${escapeHtml(note)}</p>
          </div>
        `;
      })
      .join('');
  }

  function renderPublicUpdates(updates) {
    const container = document.getElementById(
      'public-updates'
    );

    if (!container) {
      return;
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      container.innerHTML = '<p class="empty-state">No public updates have been published yet.</p>';
      return;
    }

    container.innerHTML = updates
      .map(function (update) {
        return `
          <article class="public-update">

            <div class="public-update-top">

              <span class="update-type">
                ${escapeHtml(update.type || 'Update')}
              </span>

              <time>
                ${escapeHtml(formatDate(update.date))}
              </time>

            </div>

            <h3>
              ${escapeHtml(update.title || '')}
            </h3>

            <p>
              ${escapeHtml(update.message || '')}
            </p>

          </article>
        `;
      })
      .join('');
  }

  function renderNotice(notice) {
    if (!notice) {
      return;
    }

    setText('notice-title', notice.title);
    setText('notice-message', notice.message);
    setText('notice-date', formatDate(notice.date));

    const status = document.getElementById(
      'notice-status'
    );

    if (status) {
      status.textContent = notice.status || 'Published';
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }


  /*
   * ============================================================
   * FUTURE ADMIN RELEASE SYSTEM
   * ============================================================
   *
   * The administration backend will eventually provide:
   *
   * 1. Latest free release
   * 2. Paid upgrades
   * 3. Version history
   * 4. Release notes
   * 5. Public announcements
   * 6. Release dates
   * 7. Release channels
   * 8. Secure download authorization
   *
   * IMPORTANT:
   *
   * "latest" and "upgrade" are intentionally separate.
   *
   * A latest-version release is free.
   *
   * A paid upgrade requires backend payment verification
   * before the protected upgrade download is authorized.
   *
   * Payment enforcement must NEVER depend only on frontend
   * JavaScript.
   */


  async function loadAdminPublishedInformation() {
    try {
      const config = window.ZakiChatConfig;
      if (!config?.supabaseUrl || !config?.supabaseKey) {
        throw new Error('Supabase configuration is unavailable.');
      }

      const response = await fetch(
        `${config.supabaseUrl}/functions/v1/release-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`
          },
          body: JSON.stringify({ action: 'public-list' })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || 'Unable to load published releases.');
      }

      const releases = Array.isArray(payload.releases) ? payload.releases : [];
      if (!releases.length) {
        renderLatestVersion({ ...fallbackLatestVersion, downloadUrl: '' });
        renderPaidUpgrades(fallbackPaidUpgrades);
        renderVersions([]);
        return;
      }

      const latest = releases.find(item => item.channel === 'stable') || releases[0];
      renderLatestVersion({
        version: latest.version,
        title: latest.title,
        description: latest.description,
        releaseDate: latest.publishedAt,
        channel: latest.channel
          ? latest.channel.charAt(0).toUpperCase() + latest.channel.slice(1)
          : 'Stable',
        downloadUrl: latest.downloadUrl || ''
      });

      renderPaidUpgrades(fallbackPaidUpgrades);
      renderVersions(releases.map((item, index) => ({
        version: item.version,
        title: item.title,
        description: item.description,
        state: index === 0 ? 'Latest' : 'Previous',
        current: index === 0
      })));

      const notes = String(latest.releaseNotes || '')
        .split(/\r?\n/)
        .map(note => note.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
      renderNotes(notes);

      try {
        const noticeResponse = await fetch(
          `${config.supabaseUrl}/functions/v1/admin-content`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: config.supabaseKey,
              Authorization: `Bearer ${config.supabaseKey}`
            },
            body: JSON.stringify({ action: 'public-notices' })
          }
        );
        const noticePayload = await noticeResponse.json().catch(() => ({}));
        if (!noticeResponse.ok || noticePayload.success !== true) {
          throw new Error(noticePayload.error || 'Unable to load public notices.');
        }
        renderPublicUpdates((noticePayload.notices || []).map(notice => ({
          type: notice.notice_type,
          date: notice.created_at,
          title: notice.title,
          message: notice.message
        })));
      } catch (noticeError) {
        console.warn('Unable to load public updates:', noticeError);
        renderPublicUpdates([]);
      }
    } catch (error) {
      console.error('Unable to load published ZakiChat releases:', error);
      renderLatestVersion({ ...fallbackLatestVersion, downloadUrl: '' });
      renderPaidUpgrades(fallbackPaidUpgrades);
      renderVersions([]);
    }
  }


  document.addEventListener(
    'DOMContentLoaded',
    function () {

      setText(
        'current-year',
        new Date().getFullYear()
      );

      loadAdminPublishedInformation();
    }
  );

})();

/* =========================================================
   ZAKICHAT UPGRADE REQUEST CONTROLLER
   Requests are recorded securely; no plan is activated until payment is verified.
   ========================================================= */
(function () {
  'use strict';

  const upgradePlans = {
    personal_monthly: { id: 'personal_monthly', accountType: 'Personal', price: 2, currency: 'USD', billingInterval: 'monthly' },
    business_monthly: { id: 'business_monthly', accountType: 'Business', price: 10, currency: 'USD', billingInterval: 'monthly' }
  };

  function showUpgradeStatus(message, isError = false, showLoginLink = false) {
    let status = document.getElementById('upgradeCheckoutStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'upgradeCheckoutStatus';
      status.className = 'upgrade-checkout-status';
      status.setAttribute('role', 'status');
      document.querySelector('.upgrade-plans-grid')?.prepend(status);
    }
    status.hidden = false;
    status.classList.toggle('error', isError);
    status.replaceChildren(document.createTextNode(message));
    if (showLoginLink) {
      status.appendChild(document.createTextNode(' '));
      const link = document.createElement('a');
      link.href = 'login.html';
      link.textContent = 'Sign in';
      status.appendChild(link);
      status.appendChild(document.createTextNode(', then return here and select your plan again.'));
    }
    status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleUpgrade(planId, button) {
    const plan = upgradePlans[planId];
    if (!plan) return;
    const client = window.ZakiChatAuth?.client;
    const config = window.ZakiChatConfig;
    if (!client || !config?.supabaseUrl || !config?.supabaseKey) {
      showUpgradeStatus('ZakiChat sign-in is still initializing. Refresh the page and try again.', true);
      return;
    }

    const oldText = button?.textContent || 'Request Upgrade';
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting...';
    }

    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData?.session;
      if (!session?.access_token) {
        showUpgradeStatus('Sign in to request the ' + plan.accountType + ' plan. No payment has been taken.', false, true);
        return;
      }

      const response = await fetch(config.supabaseUrl + '/functions/v1/upgrade-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.supabaseKey,
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ planId: plan.id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || 'Unable to submit your upgrade request.');
      }

      if (result.alreadyActive) {
        showUpgradeStatus(result.message || 'This plan is already active on your account.');
        return;
      }

      showUpgradeStatus(
        (result.message || 'Your upgrade request has been recorded.') +
        ' Request reference: ' + result.requestId +
        '. No charge has been made. Automatic checkout still needs the approved payment-provider credentials and webhook verification.'
      );
    } catch (error) {
      console.error('Upgrade request failed:', error);
      showUpgradeStatus(error.message || 'Unable to submit your upgrade request. Please try again later.', true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  function bindUpgradeButtons() {
    document.querySelectorAll('[data-upgrade-plan]').forEach(button => {
      if (button.dataset.upgradeBound === 'true') return;
      button.dataset.upgradeBound = 'true';
      button.addEventListener('click', () => handleUpgrade(button.dataset.upgradePlan, button));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUpgradeButtons);
  } else {
    bindUpgradeButtons();
  }
})();
