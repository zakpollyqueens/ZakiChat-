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

    if (button) {
      button.href = data.downloadUrl || '#';
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

    const list =
      Array.isArray(versions) && versions.length
        ? versions
        : fallbackVersions;

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

    /*
     * Admin/Supabase integration will be connected here when
     * the administration database and release API are created.
     *
     * Until then, safe fallback information is displayed.
     */

    renderLatestVersion(fallbackLatestVersion);

    renderPaidUpgrades(fallbackPaidUpgrades);

    renderVersions(fallbackVersions);
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
   ZAKICHAT UPGRADE PLAN CONTROLLER
   Payment and entitlement activation will be connected
   through the secure backend in a later implementation.
   ========================================================= */

(function () {
  'use strict';

  const upgradePlans = {
    personal_monthly: {
      id: 'personal_monthly',
      accountType: 'Personal',
      price: 2,
      currency: 'USD',
      billingInterval: 'monthly'
    },

    business_monthly: {
      id: 'business_monthly',
      accountType: 'Business',
      price: 10,
      currency: 'USD',
      billingInterval: 'monthly'
    }
  };

  function handleUpgrade(planId) {
    const plan = upgradePlans[planId];

    if (!plan) return;

    const message =
      `${plan.accountType} upgrade selected.\n\n` +
      `Price: $${plan.price}/month\n` +
      `Billing: Monthly\n\n` +
      `Secure payment and subscription activation will be connected after ` +
      `the ZakiChat Admin and payment system are completed.`;

    window.alert(message);
  }

  function bindUpgradeButtons() {
    document.querySelectorAll('[data-upgrade-plan]').forEach((button) => {
      if (button.dataset.upgradeBound === 'true') return;

      button.dataset.upgradeBound = 'true';

      button.addEventListener('click', () => {
        handleUpgrade(button.dataset.upgradePlan);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUpgradeButtons);
  } else {
    bindUpgradeButtons();
  }
})();

/*
 * ============================================================
 * SHOWCASE → UPGRADE ROUTING
 * ============================================================
 *
 * A showcase item may open:
 *
 *   about.html?upgrade=personal_monthly#paid-upgrades
 *   about.html?upgrade=business_monthly#paid-upgrades
 *
 * This only selects/highlights the relevant plan.
 * Payment and entitlement activation remain backend-controlled.
 * ============================================================
 */
(function () {
  'use strict';

  function focusUpgradePlan() {
    const params = new URLSearchParams(
      window.location.search
    );

    const requestedPlan =
      params.get('upgrade');

    if (!requestedPlan) {
      return;
    }

    const plan =
      document.querySelector(
        `[data-upgrade-plan="${CSS.escape(requestedPlan)}"]`
      );

    if (!plan) {
      console.warn(
        'Requested upgrade plan was not found:',
        requestedPlan
      );
      return;
    }

    const card =
      plan.closest('.upgrade-plan-card');

    if (!card) {
      return;
    }

    window.setTimeout(function () {
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      card.classList.add(
        'upgrade-plan-highlight'
      );

      window.setTimeout(function () {
        card.classList.remove(
          'upgrade-plan-highlight'
        );
      }, 2200);
    }, 150);
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      focusUpgradePlan
    );
  } else {
    focusUpgradePlan();
  }

})();
