(function () {
  'use strict';

  const StatusPage = {
    db: null,
    userId: null,

    statuses: [],
    calls: [],

    profiles: new Map(),
    myProfile: null,

    realtimeChannel: null,
    callsRealtimeChannel: null,

    async init() {
      try {
        if (!window.supabase || !window.ZakiChatConfig) {
          throw new Error(
            'ZakiChat configuration is unavailable.'
          );
        }

        this.db = window.ZakiChatAuth?.client;

        if (!this.db) {
          throw new Error(
            'Supabase client is unavailable.'
          );
        }

        const {
          data: sessionData,
          error: sessionError
        } = await this.db.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        this.userId =
          sessionData?.session?.user?.id;

        if (!this.userId) {
          window.location.href = 'login.html';
          return;
        }

        this.bindEvents();

        await Promise.all([
          this.loadStatuses(),
          this.loadCalls(),
          this.loadMyProfile()
        ]);

        this.subscribeRealtime();
        this.subscribeCallsRealtime();

      } catch (error) {
        console.error(
          'Updates initialization failed:',
          error
        );

        this.showError(
          error.message ||
          'Unable to load Updates.'
        );

        this.showCallsError(
          error.message ||
          'Unable to load call history.'
        );
      }
    },

    bindEvents() {
      const myStatusCard =
        document.getElementById('myStatusCard');

      if (myStatusCard) {
        myStatusCard.addEventListener('click', event => {
          if (event.target.closest('#addStatusButton')) return;
          const own = this.statuses.filter(status => status.user_id === this.userId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          if (own.length) this.openViewer(own[0], 'My Status');
          else this.openComposer();
        });
        myStatusCard.addEventListener('keydown', event => {
          if (event.target.closest('#addStatusButton')) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const own = this.statuses.filter(status => status.user_id === this.userId)
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            if (own.length) this.openViewer(own[0], 'My Status');
            else this.openComposer();
          }
        });
      }

      document
        .getElementById('addStatusButton')
        ?.addEventListener(
          'click',
          event => { event.stopPropagation(); this.openComposer(); }
        );

      document
        .getElementById('closeComposerButton')
        ?.addEventListener(
          'click',
          () => this.closeComposer()
        );

      document
        .getElementById('closeViewerButton')
        ?.addEventListener(
          'click',
          () => this.closeViewer()
        );
      document.getElementById('statusHeartButton')?.addEventListener('click', () => this.sendStatusReaction('❤️'));
      document.getElementById('statusReactButton')?.addEventListener('click', () => { const choice = window.prompt('Choose a reaction: ❤️ 😂 😮 😢 🔥 👍'); if (choice && ['❤️','😂','😮','😢','🔥','👍'].includes(choice.trim())) this.sendStatusReaction(choice.trim()); else if (choice) window.alert('Choose one of the listed reactions.'); });
      document.getElementById('statusViewsButton')?.addEventListener('click', () => this.loadStatusViewers());
      document.getElementById('statusEditButton')?.addEventListener('click', () => this.editMyStatus());
      document.getElementById('statusDeleteButton')?.addEventListener('click', () => this.deleteMyStatus());

      document
        .getElementById('publishStatusButton')
        ?.addEventListener(
          'click',
          () => this.publishStatus()
        );

      document
        .getElementById('refreshUpdatesButton')
        ?.addEventListener(
          'click',
          () => this.refreshAll()
        );

      document
        .getElementById('refreshCallsButton')
        ?.addEventListener(
          'click',
          () => this.loadCalls()
        );

      document
        .getElementById('statusText')
        ?.addEventListener(
          'input',
          event => {
            const counter =
              document.getElementById(
                'statusCharacterCount'
              );

            if (counter) {
              counter.textContent =
                event.target.value.length;
            }
          }
        );

      document
        .getElementById('statusMedia')
        ?.addEventListener(
          'change',
          event => {
            this.previewMedia(
              event.target.files?.[0] ||
              null
            );
          }
        );

      document
        .getElementById('statusComposer')
        ?.addEventListener(
          'click',
          event => {
            if (
              event.target.id ===
              'statusComposer'
            ) {
              this.closeComposer();
            }
          }
        );

      document
        .getElementById('statusViewer')
        ?.addEventListener(
          'click',
          event => {
            if (
              event.target.id ===
              'statusViewer'
            ) {
              this.closeViewer();
            }
          }
        );
    },

    async refreshAll() {
      await Promise.all([
        this.loadStatuses(),
        this.loadCalls(),
        this.loadMyProfile()
      ]);
    },

    /* ======================================================
       STATUS SYSTEM
       ====================================================== */

    async loadMyProfile() {
      try {
        const {
          data,
          error
        } = await this.db
          .from('profiles')
          .select('id,username,full_name,avatar_url')
          .eq('id', this.userId)
          .maybeSingle();

        if (error) {
          console.warn('Unable to load own status profile:', error);
          return;
        }

        this.myProfile = data || null;
        this.renderMyStatusAvatar();
      } catch (error) {
        console.warn('Own status profile loading failed:', error);
      }
    },

    renderMyStatusAvatar() {
      const avatar =
        document.getElementById('myStatusAvatar');

      if (!avatar) return;

      const profile = this.myProfile || {};
      const name =
        profile.full_name ||
        profile.username ||
        'ZakiChat User';

      const initials =
        this.getInitials(name);
      const hasActiveStatus = this.statuses.some(status => status.user_id === this.userId);
      avatar.classList.toggle('has-active-status', hasActiveStatus);
      avatar.setAttribute('aria-label', hasActiveStatus ? 'View your active status' : 'Add a status');

      avatar.innerHTML = '';

      if (profile.avatar_url) {
        const image =
          document.createElement('img');

        image.src =
          profile.avatar_url;

        image.alt =
          'Your profile photo';

        image.width = 54;
        image.height = 54;

        image.addEventListener('error', () => {
          avatar.innerHTML = '';
          const fallback =
            document.createElement('span');

          fallback.className =
            'my-status-avatar-placeholder';

          fallback.textContent =
            initials;

          avatar.appendChild(fallback);
          this.appendStatusPlus(avatar);
        });

        avatar.appendChild(image);
      } else {
        const fallback =
          document.createElement('span');

        fallback.className =
          'my-status-avatar-placeholder';

        fallback.textContent =
          initials;

        avatar.appendChild(fallback);
      }

      this.appendStatusPlus(avatar);
    },

    appendStatusPlus(avatar) {
      const plus =
        document.createElement('span');

      plus.className =
        'my-status-plus';

      plus.setAttribute(
        'aria-hidden',
        'true'
      );

      plus.textContent = '+';

      avatar.appendChild(plus);
    },

    async loadStatuses() {
      this.hideError();

      const {
        data,
        error
      } = await this.db
        .from('status_updates')
        .select(`
          id,
          user_id,
          text,
          media_path,
          media_type,
          created_at,
          expires_at
        `)
        .gt(
          'expires_at',
          new Date().toISOString()
        )
        .order(
          'created_at',
          { ascending: false }
        )
        .limit(100);

      if (error) {
        throw error;
      }

      this.statuses = data || [];

      await this.loadStatusProfiles();
      await this.renderStatuses();
    },

    async loadStatusProfiles() {
      const ids = [
        ...new Set(
          this.statuses.map(
            status => status.user_id
          )
        )
      ];

      if (!ids.length) {
        return;
      }

      const {
        data,
        error
      } = await this.db
        .from('profiles')
        .select(
          'id, username, full_name, avatar_url'
        )
        .in('id', ids);

      if (error) {
        throw error;
      }

      this.profiles.clear();

      (data || []).forEach(
        profile => {
          this.profiles.set(
            profile.id,
            profile
          );
        }
      );
    },

    async renderStatuses() {
      const list =
        document.getElementById(
          'statusList'
        );

      const empty =
        document.getElementById(
          'statusEmpty'
        );

      const count =
        document.getElementById(
          'statusCount'
        );

      if (!list || !empty || !count) {
        return;
      }

      list.innerHTML = '';

      const grouped = new Map();

      for (
        const status of this.statuses
      ) {
        if (
          !grouped.has(
            status.user_id
          )
        ) {
          grouped.set(
            status.user_id,
            []
          );
        }

        grouped
          .get(status.user_id)
          .push(status);
      }

      const contactStatuses =
        [...grouped.entries()]
          .filter(
            ([userId]) =>
              userId !== this.userId
          );

      count.textContent =
        contactStatuses.length;

      const ownStatuses =
        grouped.get(this.userId) ||
        [];

      const summary =
        document.getElementById(
          'myStatusSummary'
        );

      if (summary) {
        summary.textContent =
          ownStatuses.length
            ? `${ownStatuses.length} active status${
                ownStatuses.length === 1
                  ? ''
                  : 'es'
              }`
            : 'Add a status update';
      }

      // The Recent updates feed is the single source of truth for every active
      // status, including the signed-in user's own posts.
      if (!contactStatuses.length && !ownStatuses.length) {
        empty.hidden = false;
        empty.textContent = 'No active updates yet. Add a status or check back when your friends share one.';
        return;
      }
      empty.hidden = true;

      const recentEntries = [];
      // Keep every one of the signed-in user's active statuses individually
      // visible, so a count such as 12 always corresponds to viewable entries.
      for (const ownStatus of ownStatuses) {
        recentEntries.push({ userId: this.userId, statuses: [ownStatus], latest: ownStatus, isOwn: true });
      }
      // Friends are grouped by person; opening a friend's row opens their
      // newest status and the existing viewer can move through their updates.
      for (const [userId, statuses] of contactStatuses) {
        recentEntries.push({ userId, statuses, latest: statuses[0], isOwn: false });
      }
      recentEntries.sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
      count.textContent = String(recentEntries.length);

      for (const entry of recentEntries) {
        const { userId, statuses, latest, isOwn } = entry;
        const profile = this.profiles.get(userId);
        const name = isOwn ? 'My status' : this.getProfileName(profile);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'status-item' + (isOwn ? ' my-status-item' : '');

        const avatar = document.createElement('div');
        avatar.className = 'status-avatar' + (isOwn ? ' status-avatar-own' : '');
        if (profile?.avatar_url) {
          const image = document.createElement('img');
          image.src = profile.avatar_url;
          image.alt = '';
          image.width = 48;
          image.height = 48;
          avatar.appendChild(image);
        } else {
          avatar.textContent = isOwn ? '＋' : this.getInitials(name);
        }

        const info = document.createElement('div');
        info.className = 'status-item-info';
        const title = document.createElement('strong');
        title.textContent = name;
        const subtitle = document.createElement('span');
        subtitle.textContent = this.statusPreview(latest);
        const meta = document.createElement('small');
        meta.className = 'status-recent-meta';
        meta.textContent = isOwn
          ? this.formatDate(latest.created_at) + ' · Yours · Manage status'
          : statuses.length + ' active update' + (statuses.length === 1 ? '' : 's');
        info.append(title, subtitle, meta);
        button.append(avatar, info);
        button.addEventListener('click', () => this.openViewer(latest, name));
        list.appendChild(button);
      }
    },

    async publishStatus(payload = null) {
      const textarea =
        document.getElementById(
          'statusText'
        );

      const mediaInput =
        document.getElementById(
          'statusMedia'
        );

      const button =
        document.getElementById(
          'publishStatusButton'
        );

      const text =
        String(payload?.text ?? payload?.caption ?? textarea.value ?? '').trim();

      let file = payload?.file || mediaInput.files?.[0] || null;
      if (!file && payload?.voiceBlob instanceof Blob) {
        file = new File([payload.voiceBlob], 'voice-status.webm', { type: payload.voiceBlob.type || 'audio/webm' });
      }

      this.hideComposerError();

      if (!text && !file) {
        this.showComposerError(
          'Write something or choose a photo/video first.'
        );
        return;
      }

      if (
        file &&
        !file.type.startsWith('image/') &&
        !file.type.startsWith('video/') &&
        !file.type.startsWith('audio/')
      ) {
        this.showComposerError(
          'Choose a photo, video or recorded voice status.'
        );
        return;
      }

      button.disabled = true;
      button.textContent =
        file
          ? 'Uploading...'
          : 'Posting...';

      let statusId = null;
      let uploadedPath = null;

      try {
        const mediaType =
          file
            ? (
                file.type.startsWith('image/') ? 'image' : (file.type.startsWith('audio/') ? 'audio' : 'video')
              )
            : null;

        /*
         * Generate the status UUID before inserting.
         * This allows media-only statuses to satisfy
         * the database requirement that text OR media
         * exists without creating an incomplete row.
         */
        statusId =
          crypto.randomUUID();

        if (file) {
          const extension =
            this.getExtension(
              file.name
            );

          const safeName =
            `${Date.now()}-${crypto.randomUUID()}${extension}`;

          uploadedPath =
            `${this.userId}/${statusId}/${safeName}`;

          const {
            error: uploadError
          } = await this.db.storage
            .from(
              'status-updates'
            )
            .upload(
              uploadedPath,
              file,
              {
                cacheControl:
                  '3600',
                upsert: false,
                contentType:
                  file.type
              }
            );

          if (uploadError) {
            throw uploadError;
          }
        }

        const {
          error: insertError
        } = await this.db
          .from('status_updates')
          .insert({
            id: statusId,
            user_id:
              this.userId,
            text:
              text || null,
            media_path:
              uploadedPath,
            media_type:
              mediaType
          });

        if (insertError) {
          throw insertError;
        }

        textarea.value = '';
        mediaInput.value = '';
        if (payload) { const textInput = document.getElementById('statusText'); if (textInput) textInput.value = ''; }

        document.getElementById(
          'statusCharacterCount'
        ).textContent = '0';

        document.getElementById(
          'statusMediaPreview'
        ).innerHTML = '';

        document.getElementById(
          'statusMediaPreview'
        ).hidden = true;

        this.closeComposer();

        await this.loadStatuses();

      } catch (error) {
        console.error(
          'Status creation failed:',
          error
        );

        if (uploadedPath) {
          await this.db.storage
            .from(
              'status-updates'
            )
            .remove([
              uploadedPath
            ])
            .catch(
              () => {}
            );
        }

        if (statusId) {
          await this.db
            .from('status_updates')
            .delete()
            .eq(
              'id',
              statusId
            )
            .eq(
              'user_id',
              this.userId
            );
        }

        this.showComposerError(
          error.message ||
          'Unable to publish your status.'
        );

      } finally {
        button.disabled = false;
        button.textContent =
          'Post status';
      }
    },

    async openViewer(
      status,
      name
    ) {
      document.getElementById(
        'viewerName'
      ).textContent = name;

      document.getElementById(
        'viewerTime'
      ).textContent =
        this.formatDate(
          status.created_at
        );

      const content =
        document.getElementById(
          'viewerContent'
        );

      content.innerHTML = '';

      if (status.text) {
        const text =
          document.createElement(
            'div'
          );

        text.textContent =
          status.text;

        content.appendChild(
          text
        );
      }

      if (status.media_path) {
        const {
          data,
          error
        } = await this.db.storage
          .from(
            'status-updates'
          )
          .createSignedUrl(
            status.media_path,
            3600
          );

        if (error) {
          console.warn(
            'Unable to load status media:',
            error
          );
        } else if (
          data?.signedUrl
        ) {
          if (
            status.media_type ===
            'image'
          ) {
            const image =
              document.createElement(
                'img'
              );

            image.src =
              data.signedUrl;

            image.alt =
              `${name}'s status`;

            image.style.width =
              '100%';

            image.style.maxHeight =
              '65vh';

            image.style.objectFit =
              'contain';

            content.appendChild(
              image
            );

          } else if (
            status.media_type === 'video' || status.media_type === 'audio'
          ) {
            const media = document.createElement(status.media_type === 'audio' ? 'audio' : 'video');
            media.src = data.signedUrl;
            media.controls = true;
            media.playsInline = true;
            media.style.width = '100%';
            media.style.maxHeight = '65vh';
            content.appendChild(media);
          }
        }
      }

      const isMine = status.user_id === this.userId;
      const actions = document.getElementById('statusViewerActions'); if (actions) { actions.hidden = false; actions.classList.toggle('is-own-status', isMine); }
      const heartButton = document.getElementById('statusHeartButton');
      const reactButton = document.getElementById('statusReactButton');
      const editButton = document.getElementById('statusEditButton');
      const deleteButton = document.getElementById('statusDeleteButton');
      const viewsButton = document.getElementById('statusViewsButton');
      if (heartButton) heartButton.hidden = isMine;
      if (reactButton) reactButton.hidden = isMine;
      if (editButton) editButton.hidden = !isMine;
      if (deleteButton) deleteButton.hidden = !isMine;
      if (viewsButton) viewsButton.hidden = !isMine;
      const viewsPanel = document.getElementById('statusViewsPanel'); if (viewsPanel) { viewsPanel.hidden = true; viewsPanel.innerHTML = ''; }
      const reactionSummary = document.getElementById('statusReactionSummary'); if (reactionSummary) reactionSummary.textContent = '';
      document.getElementById('statusViewer').dataset.statusId = status.id; document.getElementById('statusViewer').hidden = false;
      if (!isMine) await this.recordView(status.id); await this.loadStatusReactions(status.id);
    },

    async loadStatusReactions(statusId) {
      const summary = document.getElementById('statusReactionSummary'); if (!summary) return;
      try { const { data, error } = await this.db.from('status_reactions').select('reaction,user_id').eq('status_id', statusId); if (error) throw error; const rows = data || []; summary.textContent = '❤️ ' + rows.filter(row => row.reaction === '❤️').length + ' hearts · 😊 ' + rows.filter(row => row.reaction !== '❤️').length + ' other reactions'; }
      catch (error) { console.warn('Could not load status reactions:', error); summary.textContent = 'Reactions unavailable until the database migration is applied.'; }
    },

    async sendStatusReaction(reaction) {
      const statusId = document.getElementById('statusViewer')?.dataset.statusId; if (!statusId) return;
      try { const { error } = await this.db.from('status_reactions').upsert({ status_id: statusId, user_id: this.userId, reaction }, { onConflict: 'status_id,user_id' }); if (error) throw error; await this.loadStatusReactions(statusId); }
      catch (error) { console.error('Status reaction failed:', error); window.alert('Could not send reaction. Please try again.'); }
    },

    async loadStatusViewers() {
      const statusId = document.getElementById('statusViewer')?.dataset.statusId; const panel = document.getElementById('statusViewsPanel'); if (!statusId || !panel) return;
      panel.hidden = false; panel.textContent = 'Loading viewers…';
      try {
        const { data, error } = await this.db.from('status_views').select('viewer_id,viewed_at').eq('status_id', statusId).order('viewed_at', { ascending: false }); if (error) throw error;
        const rows = data || []; panel.innerHTML = ''; const heading = document.createElement('strong'); heading.textContent = 'Viewed by ' + rows.length + (rows.length === 1 ? ' person' : ' people'); panel.append(heading);
        if (!rows.length) { const empty = document.createElement('p'); empty.textContent = 'No views yet.'; panel.append(empty); return; }
        const ids = [...new Set(rows.map(row => row.viewer_id))]; const { data: profiles, error: profileError } = await this.db.from('profiles').select('id,username,full_name,avatar_url').in('id', ids); if (profileError) throw profileError;
        const map = new Map((profiles || []).map(profile => [profile.id, profile]));
        rows.forEach(row => { const p = map.get(row.viewer_id); const line = document.createElement('div'); line.className = 'status-viewer-row'; line.textContent = (p?.full_name || p?.username || 'ZakiChat user') + ' · ' + this.formatDate(row.viewed_at); panel.append(line); });
      } catch (error) { console.error('Unable to load status viewers:', error); panel.textContent = 'Could not load viewers: ' + (error.message || 'Please try again.'); }
    },

    async editMyStatus() {
      const statusId = document.getElementById('statusViewer')?.dataset.statusId; const status = this.statuses.find(item => item.id === statusId && item.user_id === this.userId); if (!status) return;
      const updatedText = window.prompt('Edit your status text:', status.text || ''); if (updatedText === null) return;
      if (!updatedText.trim() && !status.media_path) { window.alert('A text-only status cannot be empty.'); return; }
      try { const { error } = await this.db.from('status_updates').update({ text: updatedText.trim() || null }).eq('id', status.id).eq('user_id', this.userId); if (error) throw error; status.text = updatedText.trim() || null; await this.loadStatuses(); await this.openViewer(status, 'My Status'); }
      catch (error) { console.error('Status edit failed:', error); window.alert('Could not edit status. Check database update permissions and try again.'); }
    },

    async deleteMyStatus() {
      const viewer = document.getElementById('statusViewer'); const statusId = viewer?.dataset.statusId; const status = this.statuses.find(item => item.id === statusId && item.user_id === this.userId); if (!status || !window.confirm('Delete this status permanently?')) return;
      try { if (status.media_path) { const { error: storageError } = await this.db.storage.from('status-updates').remove([status.media_path]); if (storageError) console.warn('Status media cleanup failed:', storageError); }
        const { error } = await this.db.from('status_updates').delete().eq('id', status.id).eq('user_id', this.userId); if (error) throw error; this.closeViewer(); await this.loadStatuses(); }
      catch (error) { console.error('Status delete failed:', error); window.alert('Could not delete status. Please try again.'); }
    },

    async recordView(
      statusId
    ) {
      try {
        const {
          error
        } = await this.db
          .from('status_views')
          .upsert(
            {
              status_id:
                statusId,
              viewer_id:
                this.userId
            },
            {
              onConflict:
                'status_id,viewer_id',
              ignoreDuplicates:
                true
            }
          );

        if (error) {
          console.warn(
            'Unable to record status view:',
            error
          );
        }
      } catch (error) {
        console.warn(
          'Status view error:',
          error
        );
      }
    },

    previewMedia(file) {
      const preview =
        document.getElementById(
          'statusMediaPreview'
        );

      preview.innerHTML = '';

      if (!file) {
        preview.hidden = true;
        return;
      }

      if (
        !file.type.startsWith(
          'image/'
        ) &&
        !file.type.startsWith(
          'video/'
        )
      ) {
        this.showComposerError(
          'Only image and video files can be posted.'
        );

        preview.hidden = true;
        return;
      }

      const objectUrl =
        URL.createObjectURL(
          file
        );

      if (
        file.type.startsWith(
          'image/'
        )
      ) {
        const image =
          document.createElement(
            'img'
          );

        image.src =
          objectUrl;

        image.alt =
          'Status preview';

        preview.appendChild(
          image
        );
      } else {
        const video =
          document.createElement(
            'video'
          );

        video.src =
          objectUrl;

        video.controls = true;
        video.muted = true;
        video.playsInline = true;

        preview.appendChild(
          video
        );
      }

      preview.hidden = false;
    },

    openComposer() {
      const dialog =
        document.getElementById(
          'statusComposer'
        );

      const textarea =
        document.getElementById(
          'statusText'
        );

      if (!dialog) {
        return;
      }

      dialog.hidden = false;

      requestAnimationFrame(() => {
        dialog.classList.add(
          'status-dialog-visible'
        );

        textarea?.focus({
          preventScroll: true
        });
      });
    },

    closeComposer() {
      const dialog =
        document.getElementById(
          'statusComposer'
        );

      if (!dialog) {
        return;
      }

      dialog.classList.remove(
        'status-dialog-visible'
      );

      dialog.hidden = true;

      this.hideComposerError();
    },

    closeViewer() {
      document.getElementById(
        'statusViewer'
      ).hidden = true;
    },

    subscribeRealtime() {
      if (
        !window.ZakiRealtime?.subscribe
      ) {
        return;
      }

      try {
        this.realtimeChannel =
          window.ZakiRealtime.subscribe(
            'status_updates',
            'status_updates',
            null,
            () => this.loadStatuses(),
            '*'
          );
      } catch (error) {
        console.warn(
          'Status realtime subscription unavailable:',
          error
        );
      }
    },

    /* ======================================================
       CALL HISTORY
       ====================================================== */

    async loadCalls() {
      this.hideCallsError();

      const loading =
        document.getElementById(
          'callsLoading'
        );

      const empty =
        document.getElementById(
          'callsEmpty'
        );

      const list =
        document.getElementById(
          'callsList'
        );

      if (loading) {
        loading.hidden = false;
      }

      if (empty) {
        empty.hidden = true;
      }

      if (list) {
        list.innerHTML = '';
      }

      try {
        /*
         * Select only rows involving the signed-in
         * user. Using select('*') keeps this compatible
         * with the existing 024 communication schema
         * without assuming optional future columns.
         */
        const {
          data,
          error
        } = await this.db
          .from('calls')
          .select('*')
          .or(
            `caller_id.eq.${this.userId},callee_id.eq.${this.userId}`
          )
          .order(
            'created_at',
            {
              ascending: false
            }
          )
          .limit(100);

        if (error) {
          throw error;
        }

        const { data: hiddenRows, error: hiddenError } = await this.db.from('call_history_hidden').select('call_id').eq('user_id', this.userId);
        if (hiddenError) throw hiddenError;
        const hiddenCallIds = new Set((hiddenRows || []).map(row => row.call_id));
        this.calls = (Array.isArray(data) ? data : []).filter(call => !hiddenCallIds.has(call.id));

        await this.loadCallProfiles();
        this.renderCalls();

      } catch (error) {
        console.error(
          'Call history loading failed:',
          error
        );

        this.calls = [];

        this.showCallsError(
          error.message ||
          'Unable to load call history.'
        );

      } finally {
        if (loading) {
          loading.hidden = true;
        }
      }
    },

    async loadCallProfiles() {
      const ids = [
        ...new Set(
          this.calls
            .map(call =>
              call.caller_id ===
              this.userId
                ? call.callee_id
                : call.caller_id
            )
            .filter(Boolean)
        )
      ];

      if (!ids.length) {
        return;
      }

      const {
        data,
        error
      } = await this.db
        .from('profiles')
        .select(
          'id, username, full_name, avatar_url'
        )
        .in(
          'id',
          ids
        );

      if (error) {
        throw error;
      }

      /*
       * Do not clear the status profiles. Calls and
       * statuses can share this cache.
       */
      (data || []).forEach(
        profile => {
          this.profiles.set(
            profile.id,
            profile
          );
        }
      );
    },

    renderCalls() {
      const list =
        document.getElementById(
          'callsList'
        );

      const empty =
        document.getElementById(
          'callsEmpty'
        );

      if (!list || !empty) {
        return;
      }

      list.innerHTML = '';

      const total =
        this.calls.length;

      let missed = 0;
      let outgoing = 0;
      let incoming = 0;

      for (
        const call of this.calls
      ) {
        const direction =
          this.getCallDirection(
            call
          );

        if (
          direction === 'outgoing'
        ) {
          outgoing++;
        } else {
          incoming++;
        }

        if (
          this.isMissedCall(
            call
          )
        ) {
          missed++;
        }
      }

      this.setText(
        'totalCallsCount',
        total
      );

      this.setText(
        'missedCallsCount',
        missed
      );

      this.setText(
        'outgoingCallsCount',
        outgoing
      );

      this.setText(
        'incomingCallsCount',
        incoming
      );

      const badge =
        document.getElementById(
          'missedCallBadge'
        );

      if (badge) {
        badge.textContent =
          missed;

        badge.hidden =
          missed === 0;
      }

      if (!this.calls.length) {
        empty.hidden = false;
        return;
      }

      empty.hidden = true;

      this.calls.forEach(
        call => {
          list.appendChild(
            this.createCallItem(
              call
            )
          );
        }
      );
    },
createCallItem(call) {
      const direction =
        this.getCallDirection(
          call
        );

      const missed =
        this.isMissedCall(
          call
        );

      const type =
        call.call_type ===
        'video'
          ? 'video'
          : 'voice';

      const otherUserId =
        direction ===
        'outgoing'
          ? call.callee_id
          : call.caller_id;

      const profile =
        this.profiles.get(
          otherUserId
        );

      const name =
        this.getProfileName(
          profile
        );

      const item =
        document.createElement(
          'article'
        );

      item.className =
        'call-item' +
        (
          missed
            ? ' missed'
            : ''
        );

      const avatar =
        document.createElement(
          'div'
        );

      avatar.className =
        'call-avatar';

      if (
        profile?.avatar_url
      ) {
        const image =
          document.createElement(
            'img'
          );

        image.src =
          profile.avatar_url;

        image.alt = '';

        avatar.appendChild(
          image
        );
      } else {
        avatar.textContent =
          this.getInitials(
            name
          );
      }

      const main =
        document.createElement(
          'div'
        );

      main.className =
        'call-main';

      const nameElement =
        document.createElement(
          'strong'
        );

      nameElement.className =
        'call-name';

      nameElement.textContent =
        name;

      const meta =
        document.createElement(
          'div'
        );

      meta.className =
        'call-meta';

      const directionElement =
        document.createElement(
          'span'
        );

      directionElement.className =
        'call-direction ' +
        (
          missed
            ? 'missed'
            : direction
        );

      directionElement.textContent =
        this.getDirectionLabel(
          call,
          missed
        );

      const typeElement =
        document.createElement(
          'span'
        );

      typeElement.textContent =
        type === 'video'
          ? '📹 Video'
          : '📞 Voice';

      const statusElement =
        document.createElement(
          'span'
        );

      statusElement.textContent =
        this.getStatusLabel(
          call,
          missed
        );

      const timeElement =
        document.createElement(
          'span'
        );

      timeElement.textContent =
        this.formatDate(
          this.getCallDate(
            call
          )
        );

      meta.append(
        directionElement,
        document.createTextNode('·'),
        typeElement,
        document.createTextNode('·'),
        statusElement,
        document.createTextNode('·'),
        timeElement
      );

      main.append(
        nameElement,
        meta
      );

      const actions =
        document.createElement(
          'div'
        );

      actions.className =
        'call-actions';

      const chatButton =
        document.createElement(
          'button'
        );

      chatButton.type =
        'button';

      chatButton.className =
        'call-action-button';

      chatButton.title =
        'Open chat';

      chatButton.setAttribute(
        'aria-label',
        `Open chat with ${name}`
      );

      chatButton.textContent =
        '💬';

      chatButton.addEventListener(
        'click',
        () => {
          this.openConversation(
            call
          );
        }
      );

      const callButton =
        document.createElement(
          'button'
        );

      callButton.type =
        'button';

      callButton.className =
        'call-action-button primary';

      callButton.title =
        type === 'video'
          ? 'Start video call'
          : 'Start voice call';

      callButton.setAttribute(
        'aria-label',
        callButton.title
      );

      callButton.textContent =
        type === 'video'
          ? '📹'
          : '📞';

      callButton.addEventListener(
        'click',
        () => {
          this.callAgain(
            call,
            type
          );
        }
      );

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'call-action-button call-delete-button';
      deleteButton.title = 'Remove from my call history';
      deleteButton.setAttribute('aria-label', 'Delete this call from your history');
      deleteButton.textContent = '🗑';
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm('Remove this call from your call history? It will not delete it from the other participant’s history.')) return;
        deleteButton.disabled = true;
        try {
          const { error } = await this.db.from('call_history_hidden').upsert({ user_id: this.userId, call_id: call.id }, { onConflict: 'user_id,call_id' });
          if (error) throw error;
          this.calls = this.calls.filter(entry => entry.id !== call.id);
          this.renderCalls();
        } catch (error) {
          console.error('Could not remove call history item:', error);
          window.alert(error.message || 'Could not remove this call from your history.');
          deleteButton.disabled = false;
        }
      });
      actions.append(chatButton, callButton, deleteButton);
      item.append(avatar, main, actions);
      return item;
    },

    getCallDirection(call) {
      return call.caller_id ===
        this.userId
        ? 'outgoing'
        : 'incoming';
    },

    isMissedCall(call) {
      const direction =
        this.getCallDirection(
          call
        );

      /*
       * A call is considered missed when the
       * current user was the callee and the call
       * never became active.
       */
      if (
        direction !== 'incoming'
      ) {
        return false;
      }

      const status =
        String(
          call.status ||
          ''
        ).toLowerCase();

      if (
        status === 'active'
      ) {
        return false;
      }

      if (
        call.started_at
      ) {
        return false;
      }

      return [
        'ringing',
        'cancelled',
        'ended',
        'failed',
        'declined'
      ].includes(status);
    },
getDirectionLabel(
      call,
      missed
    ) {
      if (missed) {
        return 'Missed call';
      }

      return this.getCallDirection(
        call
      ) === 'outgoing'
        ? 'Outgoing'
        : 'Incoming';
    },

    getStatusLabel(
      call,
      missed
    ) {
      if (missed) {
        return 'Unanswered';
      }

      const status =
        String(
          call.status ||
          ''
        ).toLowerCase();

      const labels = {
        ringing: 'Ringing',
        connecting: 'Connecting',
        active: 'Active',
        ended: 'Completed',
        declined: 'Declined',
        cancelled: 'Cancelled',
        failed: 'Failed'
      };

      return (
        labels[status] ||
        'Call'
      );
    },

    getCallDate(call) {
      return (
        call.created_at ||
        call.started_at ||
        call.ended_at ||
        new Date().toISOString()
      );
    },

    async callAgain(
      call,
      type
    ) {
      const otherUserId =
        this.getCallDirection(
          call
        ) === 'outgoing'
          ? call.callee_id
          : call.caller_id;

      if (!otherUserId) {
        return;
      }

      /*
       * Return to the chat where the existing
       * communication system can handle the actual
       * WebRTC call setup.
       */
      this.openConversation(
        call
      );

      /*
       * The current communication implementation
       * initializes calls from the individual chat.
       * We intentionally do not duplicate WebRTC
       * signaling here.
       */
      void type;
    },

    openConversation(call) {
      const params =
        new URLSearchParams();

      if (
        call.conversation_id
      ) {
        params.set(
          'conversation',
          call.conversation_id
        );
      }

      const otherUserId =
        this.getCallDirection(
          call
        ) === 'outgoing'
          ? call.callee_id
          : call.caller_id;

      if (otherUserId) {
        params.set(
          'user',
          otherUserId
        );
      }

      const query =
        params.toString();

      window.location.href =
        query
          ? `chat.html?${query}`
          : 'chats.html';
    },

    subscribeCallsRealtime() {
      if (
        !window.ZakiRealtime?.subscribe
      ) {
        return;
      }

      try {
        this.callsRealtimeChannel =
          window.ZakiRealtime.subscribe(
            'calls-updates',
            'calls',
            null,
            () => {
              this.loadCalls()
                .catch(
                  error =>
                    console.warn(
                      'Call realtime refresh failed:',
                      error
                    )
                );
            },
            '*'
          );
      } catch (error) {
        console.warn(
          'Call realtime subscription unavailable:',
          error
        );
      }
    },

    /* ======================================================
       SHARED HELPERS
       ====================================================== */

    getProfileName(profile) {
      if (!profile) {
        return 'ZakiChat user';
      }

      return (
        profile.full_name ||
        profile.username ||
        'ZakiChat user'
      );
    },

    getInitials(name) {
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(
          part =>
            part
              .charAt(0)
              .toUpperCase()
        )
        .join('') || '?';
    },

    statusPreview(status) {
      if (status.text) {
        return status.text
          .replace(/\s+/g, ' ')
          .slice(0, 80);
      }

      if (
        status.media_type ===
        'image'
      ) {
        return '📷 Photo';
      }

      if (
        status.media_type ===
        'video'
      ) {
        return '🎥 Video';
      }

      return 'Status update';
    },

    getExtension(filename) {
      const match =
        filename.match(
          /\.[a-z0-9]+$/i
        );

      return match
        ? match[0].toLowerCase()
        : '';
    },

    formatDate(value) {
      if (!value) {
        return 'Unknown time';
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return 'Unknown time';
      }

      return date.toLocaleString(
        [],
        {
          dateStyle: 'medium',
          timeStyle: 'short'
        }
      );
    },

    setText(
      id,
      value
    ) {
      const element =
        document.getElementById(
          id
        );

      if (element) {
        element.textContent =
          String(value);
      }
    },

    showError(message) {
      const element =
        document.getElementById(
          'statusError'
        );

      if (!element) {
        return;
      }

      element.textContent =
        message;

      element.hidden = false;
    },

    hideError() {
      const element =
        document.getElementById(
          'statusError'
        );

      if (element) {
        element.hidden = true;
      }
    },

    showCallsError(message) {
      const element =
        document.getElementById(
          'callsError'
        );

      if (!element) {
        return;
      }

      element.textContent =
        message;

      element.hidden = false;
    },

    hideCallsError() {
      const element =
        document.getElementById(
          'callsError'
        );

      if (element) {
        element.hidden = true;
      }
    },
showComposerError(message) {
      const element =
        document.getElementById(
          'composerError'
        );

      if (!element) {
        return;
      }

      element.textContent =
        message;

      element.hidden = false;
    },

    hideComposerError() {
      const element =
        document.getElementById(
          'composerError'
        );

      if (element) {
        element.hidden = true;
      }
    }
  };

  window.ZakiStatus = StatusPage;
  // Keep the legacy status engine available to the newer composer UI.
  window.StatusPage = StatusPage;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      StatusPage.init();
    }
  );

})();


/*
 * ============================================================
 * ZAKICHAT NEW RELEASES
 * ============================================================
 *
 * Release types are intentionally separate:
 *
 * latest  = FREE DOWNLOAD
 * upgrade = PAID UPGRADE
 *
 * Future data will be supplied by the Admin Dashboard through
 * the secure ZakiChat backend.
 *
 * Payment authorization MUST be enforced server-side.
 * Frontend JavaScript must never be the authority for payment.
 * ============================================================
 */

(function () {
  'use strict';

  const OTA_RELEASE_API = 'https://api.github.com/repos/zakpollyqueens/ZakiChat-/releases/latest';
  const OTA_BUNDLE_URL = 'https://github.com/zakpollyqueens/ZakiChat-/releases/latest/download/ota-bundle.zip';
  let latestOta = null;
  let otaBusy = false;
  const fallbackLatestRelease = {
    version: 'Latest Android release',
    description: 'Compatible ZakiChat features and fixes can be installed directly inside the app. Native Android changes may still require an APK update.',
    channel: 'Stable',
    releaseDate: null,
    downloadUrl: 'https://github.com/zakpollyqueens/ZakiChat-/releases/latest/download/app-release.apk'
  };
  function isNativeApp() {
    return !!(window.ZakiChatNative &&
      typeof window.ZakiChatNative.downloadAndApplyOta === 'function' &&
      typeof window.ZakiChatNative.getInstalledOtaVersion === 'function');
  }
  async function fetchLatestOta() {
    const response = await fetch(OTA_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Could not check for ZakiChat updates.');
    const release = await response.json();
    const body = String(release.body || '');
    const versionMatch = body.match(/^OTA_VERSION=([A-Za-z0-9._-]{1,100})$/m);
    const hashMatch = body.match(/^OTA_SHA256=([a-fA-F0-9]{64})$/m);
    if (!versionMatch || !hashMatch) throw new Error('The latest release does not contain a valid in-app update package yet.');
    latestOta = { version: versionMatch[1], sha256: hashMatch[1].toLowerCase(), releaseDate: release.published_at || null, releaseName: release.name || 'ZakiChat update' };
    return latestOta;
  }
  function setOtaButtonState(text, disabled) {
    const button = document.getElementById('updatesLatestDownload');
    if (!button) return;
    button.textContent = text;
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    button.setAttribute('tabindex', disabled ? '-1' : '0');
    button.classList.toggle('is-disabled', !!disabled);
    if (disabled) button.removeAttribute('href'); else button.href = '#';
  }
  function bindNativeOtaButton() {
    const button = document.getElementById('updatesLatestDownload');
    if (!button || button.dataset.otaBound === 'true') return;
    button.dataset.otaBound = 'true';
    button.addEventListener('click', async event => {
      if (!isNativeApp()) return;
      event.preventDefault();
      if (otaBusy) return;
      otaBusy = true;
      setOtaButtonState('Checking update…', true);
      try {
        const ota = await fetchLatestOta();
        const installed = String(window.ZakiChatNative.getInstalledOtaVersion() || '');
        if (installed === ota.version) {
          setOtaButtonState('You are up to date ✓', true);
          setReleaseText('updatesLatestDescription', 'You already have the latest in-app features installed.');
          return;
        }
        setOtaButtonState('Downloading update…', true);
        window.ZakiChatNative.downloadAndApplyOta(ota.version, OTA_BUNDLE_URL, ota.sha256);
      } catch (error) {
        setOtaButtonState('Retry in-app update', false);
        setReleaseText('updatesLatestDescription', error.message || 'Unable to check for updates. Please try again when online.');
      } finally { otaBusy = false; }
    });
    window.addEventListener('zaki-ota-event', event => {
      const detail = event.detail || {};
      if (detail.type === 'progress') setOtaButtonState(detail.message || 'Updating…', true);
      else if (detail.type === 'applied') {
        setOtaButtonState('Update applied ✓', true);
        setReleaseText('updatesLatestDescription', detail.message || 'Update installed.');
      } else if (detail.type === 'error') {
        setOtaButtonState('Retry in-app update', false);
        setReleaseText('updatesLatestDescription', detail.message || 'Update failed; your current app is unchanged.');
      }
    });
  }

  const fallbackPaidUpgrades = [
  {
    id: 'personal_monthly',
    title: 'Customized Personal',
    description:
      'Premium Personal features with larger file transfers and additional customized features.',
    accountType: 'Personal',
    price: '$2',
    billingInterval: 'Monthly',
    features: [
      'Larger file transfers',
      'Files up to 100 MB',
      'Customized Personal experience',
      'Additional premium features as released'
    ],
    upgradeUrl: 'about.html?upgrade=personal_monthly#paid-upgrades'
  },
  {
    id: 'business_monthly',
    title: 'Customized Business',
    description:
      'Business features for profiles, teams, employee groups, meetings and business communication.',
    accountType: 'Business',
    price: '$10',
    billingInterval: 'Monthly',
    features: [
      'Upgraded Business profile',
      'Business chat and communication',
      'Employee and team groups',
      'Business meetings',
      'Business-focused communication features'
    ],
    upgradeUrl: 'about.html?upgrade=business_monthly#paid-upgrades'
  }
];

  function setReleaseText(id, value) {
    const element = document.getElementById(id);

    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  function formatReleaseDate(value) {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function escapeReleaseHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderLatestRelease(release) {
    const data = release || fallbackLatestRelease;

    setReleaseText(
      'updatesLatestVersion',
      data.version || 'zc-vr16'
    );

    setReleaseText(
      'updatesLatestDescription',
      data.description || ''
    );

    setReleaseText(
      'updatesLatestChannel',
      data.channel || 'Stable'
    );

    setReleaseText(
      'updatesLatestDate',
      formatReleaseDate(data.releaseDate)
    );

    const button = document.getElementById(
      'updatesLatestDownload'
    );

    if (button && button.dataset.downloadGuarded !== 'true') {
      button.dataset.downloadGuarded = 'true';
      button.addEventListener('click', event => {
        if (button.getAttribute('aria-disabled') === 'true') event.preventDefault();
      });
    }

    if (button) {
      const downloadUrl = data.downloadUrl || '';
      if (isNativeApp()) {
        button.href = '#';
        button.removeAttribute('aria-disabled');
        button.removeAttribute('tabindex');
        button.classList.remove('is-disabled');
        button.textContent = 'Check for in-app update';
        bindNativeOtaButton();
      } else if (downloadUrl) {
        button.href = downloadUrl;
        button.removeAttribute('aria-disabled');
        button.removeAttribute('tabindex');
        button.classList.remove('is-disabled');
        button.textContent = 'Download Latest APK';
      } else {
        button.href = '#';
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('tabindex', '-1');
        button.classList.add('is-disabled');
        button.textContent = 'No published download yet';
      }
    }
  }

  function renderPaidUpgrades(upgrades) {
    const container = document.getElementById(
      'updatesUpgradeList'
    );

    if (!container) {
      return;
    }

    if (!Array.isArray(upgrades) || upgrades.length === 0) {
      return;
    }

    container.innerHTML = upgrades
      .map(function (upgrade) {
        return `
          <article class="release-upgrade-item">

            <h4>
              ${escapeReleaseHtml(
                upgrade.title || upgrade.version || 'ZakiChat Upgrade'
              )}
            </h4>

            <p>
              ${escapeReleaseHtml(
                upgrade.description || ''
              )}
            </p>

            <span class="upgrade-price">
              Upgrade fee:
              ${escapeReleaseHtml(
                upgrade.price || 'See upgrade details'
              )}
            </span>

            <a
              class="release-upgrade-button"
              href="${escapeReleaseHtml(
                upgrade.upgradeUrl || '#'
              )}"
            >
              Upgrade Now
            </a>

          </article>
        `;
      })
      .join('');
  }

  async function loadAdminPublishedReleases() {
    if (isNativeApp()) {
      renderLatestRelease(fallbackLatestRelease);
      renderPaidUpgrades(fallbackPaidUpgrades);
      try {
        const ota = await fetchLatestOta();
        setReleaseText('updatesLatestVersion', ota.releaseName + ' · In-app update');
        setReleaseText('updatesLatestDate', formatReleaseDate(ota.releaseDate));
        setReleaseText('updatesLatestDescription', 'Tap Update Now to download and apply verified features inside ZakiChat. No APK download is needed for compatible web updates.');
        const installed = String(window.ZakiChatNative.getInstalledOtaVersion() || '');
        setOtaButtonState(installed === ota.version ? 'You are up to date ✓' : 'Update Now', installed === ota.version);
        bindNativeOtaButton();
      } catch (error) {
        console.warn('OTA release check failed:', error);
        setReleaseText('updatesLatestDescription', 'Connect to the internet and retry to check for the latest in-app features.');
        setOtaButtonState('Check for in-app update', false);
        bindNativeOtaButton();
      }
      return;
    }
    const config = window.ZakiChatConfig;
    if (!config?.supabaseUrl || !config?.supabaseKey) {
      renderLatestRelease({ ...fallbackLatestRelease, downloadUrl: fallbackLatestRelease.downloadUrl });
      renderPaidUpgrades(fallbackPaidUpgrades);
      return;
    }

    try {
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
      const latest = releases.find(item => item.channel === 'stable') || releases[0];
      if (!latest) {
        renderLatestRelease(fallbackLatestRelease);
      } else {
        renderLatestRelease({
          version: latest.version,
          description: latest.description,
          channel: latest.channel
            ? latest.channel.charAt(0).toUpperCase() + latest.channel.slice(1)
            : 'Stable',
          releaseDate: latest.publishedAt,
          downloadUrl: latest.downloadUrl || fallbackLatestRelease.downloadUrl
        });
      }
      renderPaidUpgrades(fallbackPaidUpgrades);
    } catch (error) {
      console.error('Unable to load admin-published releases on the Updates page; using the official latest APK release:', error);
      // Keep the free Android update available even if the optional admin
      // release-management endpoint is temporarily unavailable.
      renderLatestRelease(fallbackLatestRelease);
      renderPaidUpgrades(fallbackPaidUpgrades);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      loadAdminPublishedReleases
    );
  } else {
    loadAdminPublishedReleases();
  }

})();

/*
 * ============================================================
 * ZAKICHAT SHOWCASE
 * ============================================================
 *
 * Published showcase content comes from:
 * public.update_showcase_items
 *
 * The Admin Dashboard will eventually create/update/delete
 * these records and upload the associated images.
 *
 * No admin credentials or service-role keys belong here.
 * ============================================================
 */
(function () {
  'use strict';

  const fallbackShowcase = [
    {
      id: 'demo-personal',
      title: 'Personal Plus',
      description:
        'Explore the customized Personal experience and larger file transfers.',
      category: 'Personal',
      image_url: '../static/images/showcase/personal-plus.svg',
      target_url: 'about.html?upgrade=personal_monthly#paid-upgrades'
    },
    {
      id: 'demo-business',
      title: 'Business Experience',
      description:
        'Discover business profiles, teams, communication and meetings.',
      category: 'Business',
      image_url: '../static/images/showcase/business.svg',
      target_url: 'about.html?upgrade=business_monthly#paid-upgrades'
    },
    {
      id: 'demo-security',
      title: 'Security & Privacy',
      description:
        'Explore the tools designed to help protect your account and conversations.',
      category: 'Security',
      image_url: '../static/images/showcase/security.svg',
      target_url: '#'
    },
    {
      id: 'demo-features',
      title: 'New Features',
      description:
        'Keep discovering new communication features as ZakiChat evolves.',
      category: 'Features',
      image_url: '../static/images/showcase/features.svg',
      target_url: '#'
    }
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function renderShowcase(items) {
    const track =
      document.getElementById('updateShowcaseTrack');

    const status =
      document.getElementById('updateShowcaseStatus');

    if (!track) {
      return;
    }

    const source =
      Array.isArray(items) && items.length
        ? items
        : fallbackShowcase;

    const cards = source.map(function (item) {
      const title =
        escapeHtml(
          item.title || 'ZakiChat Feature'
        );

      const description =
        escapeHtml(
          item.description || ''
        );

      const category =
        escapeHtml(
          item.category || 'Feature'
        );

      const image =
        escapeAttribute(
          item.image_url || ''
        );

      const target =
        escapeAttribute(
          item.target_url || '#'
        );

      return `
        <a
          class="update-showcase-card"
          href="${target}"
          aria-label="${title}"
        >
          <img
            class="update-showcase-card-image"
            src="${image}"
            alt="${title}"
            loading="lazy"
          >

          <span class="update-showcase-card-overlay">
            <span class="update-showcase-category">
              ${category}
            </span>

            <strong class="update-showcase-card-title">
              ${title}
            </strong>

            <span class="update-showcase-card-description">
              ${description}
            </span>
          </span>
        </a>
      `;
    }).join('');

    /*
     * Duplicate the exact sequence so the CSS animation can move
     * through one complete set and immediately continue into the
     * identical second set.
     */
    track.innerHTML = cards + cards;

    if (status) {
      status.textContent =
        `${source.length} showcase ${source.length === 1 ? 'item' : 'items'}`;
    }
  }

  async function loadShowcase() {
    const client =
      window.ZakiChatAuth?.client;

    if (!client) {
      renderShowcase(fallbackShowcase);
      return;
    }

    try {
      const {
        data,
        error
      } = await client
        .from('update_showcase_items')
        .select(`
          id,
          title,
          description,
          category,
          image_url,
          target_url,
          sort_order,
          created_at
        `)
        .eq('is_published', true)
        .order(
          'sort_order',
          { ascending: true }
        )
        .order(
          'created_at',
          { ascending: false }
        )
        .limit(30);

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length) {
        renderShowcase(data);
      } else {
        renderShowcase(fallbackShowcase);
      }

    } catch (error) {
      console.warn(
        'Showcase could not be loaded from Supabase. Using fallback content.',
        error
      );

      renderShowcase(fallbackShowcase);
    }
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      loadShowcase
    );
  } else {
    loadShowcase();
  }

})();

/* ============================================================
   ZAKICHAT AURORA STATUS COMPOSER
   ============================================================ */

(function () {
  "use strict";

  function initComposer() {
    const composer = document.getElementById("statusComposer");
    if (!composer) return;

    const text = document.getElementById("statusText");
    const media = document.getElementById("statusMedia");
    const caption = document.getElementById("statusCaption");
    const preview = document.getElementById("statusMediaPreview");
    const textPreview = document.getElementById("statusTextPreview");
    const canvas = document.getElementById("statusComposerCanvas");
    const count = document.getElementById("statusCharacterCount");
    const error = document.getElementById("composerError");

    const state = {
      mode: "text",
      font: "system",
      background: "aurora",
      music: "None",
      voiceBlob: null,
      voiceRecorder: null,
      voiceChunks: [],
      voiceTimer: null,
      voiceStarted: 0
    };

    function showError(message) {
      if (!error) return;
      error.textContent = message;
      error.hidden = false;
    }

    function clearError() {
      if (!error) return;
      error.textContent = "";
      error.hidden = true;
    }

    function updatePreview() {
      if (textPreview) {
        textPreview.textContent =
          text?.value.trim() || "What's on your mind?";

        textPreview.className =
          "status-text-preview" +
          (state.font !== "system"
            ? " font-" + state.font
            : "");
      }

      if (canvas) {
        canvas.className =
          "status-composer-canvas" +
          (state.background !== "aurora"
            ? " bg-" + state.background
            : "");
      }

      if (count && text) {
        count.textContent = text.value.length;
      }
    }

    function setMode(mode) {
      state.mode = mode;

      document.querySelectorAll("[data-composer-mode]")
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.composerMode === mode
          );
        });

      const textTools =
        document.getElementById("statusTextTools");

      const mediaTools =
        document.getElementById("statusMediaTools");

      const voiceTools =
        document.getElementById("statusVoiceTools");

      const textPreviewElement =
        document.getElementById("statusTextPreview");

      const mediaPreviewElement =
        document.getElementById("statusMediaPreview");

      const voicePreviewElement =
        document.getElementById("statusVoicePreview");

      if (textTools) textTools.hidden = mode !== "text";
      if (mediaTools) mediaTools.hidden = mode !== "media";
      if (voiceTools) voiceTools.hidden = mode !== "voice";

      if (textPreviewElement) {
        textPreviewElement.hidden = mode !== "text";
      }

      if (mediaPreviewElement) {
        mediaPreviewElement.hidden = mode !== "media";
      }

      if (voicePreviewElement) {
        voicePreviewElement.hidden = mode !== "voice";
      }

      clearError();
    }

    function openComposer() {
      clearError();
      composer.hidden = false;
      setMode("text");
      updatePreview();

      setTimeout(() => {
        text?.focus();
      }, 80);
    }

    function closeComposer() {
      stopVoiceRecording();
      composer.hidden = true;
    }

    function toggleTray(name) {
      const map = {
        emoji: "statusEmojiTray",
        sticker: "statusStickerTray",
        font: "statusFontTray",
        background: "statusBackgroundTray",
        music: "statusMusicTray"
      };

      const target = map[name];
      if (!target) return;

      document.querySelectorAll(".status-choice-tray")
        .forEach(tray => {
          if (tray.id !== target) tray.hidden = true;
        });

      const tray = document.getElementById(target);

      if (tray) {
        tray.hidden = !tray.hidden;
      }
    }

    function previewMedia(file) {
      if (!preview) return;

      preview.innerHTML = "";

      if (!file) {
        preview.hidden = true;
        return;
      }

      const url = URL.createObjectURL(file);

      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");

        video.src = url;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;

        preview.appendChild(video);
      } else if (file.type.startsWith("image/")) {
        const image = document.createElement("img");

        image.src = url;
        image.alt = "Status preview";

        preview.appendChild(image);
      }

      preview.hidden = false;
    }

    function startVoiceTimer() {
      state.voiceStarted = Date.now();

      const time =
        document.getElementById("statusVoiceTime");

      state.voiceTimer = setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - state.voiceStarted) / 1000
        );

        const minutes =
          String(Math.floor(seconds / 60)).padStart(2, "0");

        const remaining =
          String(seconds % 60).padStart(2, "0");

        if (time) {
          time.textContent =
            minutes + ":" + remaining;
        }
      }, 250);
    }

    function stopVoiceTimer() {
      if (state.voiceTimer) {
        clearInterval(state.voiceTimer);
        state.voiceTimer = null;
      }
    }

    async function startVoiceRecording() {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        !window.MediaRecorder
      ) {
        showError(
          "Voice recording is not supported on this device."
        );
        return;
      }

      if (state.voiceRecorder) return;

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true
          });

        state.voiceChunks = [];

        const recorder =
          new MediaRecorder(stream);

        state.voiceRecorder = recorder;

        recorder.ondataavailable = event => {
          if (event.data && event.data.size) {
            state.voiceChunks.push(event.data);
          }
        };

        recorder.onstop = () => {
          const mime =
            recorder.mimeType || "audio/webm";

          state.voiceBlob =
            new Blob(state.voiceChunks, {
              type: mime
            });

          stream.getTracks().forEach(
            track => track.stop()
          );

          state.voiceRecorder = null;

          const clearButton =
            document.getElementById(
              "statusVoiceClearButton"
            );

          if (clearButton) {
            clearButton.hidden = false;
          }

          const recordButton =
            document.getElementById(
              "statusRecordButton"
            );

          if (recordButton) {
            recordButton.classList.remove(
              "recording"
            );

            recordButton.textContent =
              "🎙 Hold to record again";
          }

          stopVoiceTimer();
        };

        recorder.start();
        startVoiceTimer();

        const recordButton =
          document.getElementById(
            "statusRecordButton"
          );

        if (recordButton) {
          recordButton.classList.add("recording");
          recordButton.textContent =
            "● Recording… release to stop";
        }

        clearError();

      } catch (err) {
        showError(
          "Microphone permission is required."
        );
      }
    }

    function stopVoiceRecording() {
      const recorder = state.voiceRecorder;

      if (
        recorder &&
        recorder.state === "recording"
      ) {
        recorder.stop();
      }

      stopVoiceTimer();
    }

    function clearVoiceRecording() {
      state.voiceBlob = null;
      state.voiceChunks = [];

      const clearButton =
        document.getElementById(
          "statusVoiceClearButton"
        );

      if (clearButton) {
        clearButton.hidden = true;
      }

      const recordButton =
        document.getElementById(
          "statusRecordButton"
        );

      if (recordButton) {
        recordButton.classList.remove("recording");
        recordButton.textContent =
          "🎙 Hold to record";
      }

      const time =
        document.getElementById(
          "statusVoiceTime"
        );

      if (time) {
        time.textContent = "00:00";
      }
    }

    function resetComposer() {
      if (text) text.value = "";
      if (media) media.value = "";
      if (caption) caption.value = "";

      state.mode = "text";
      state.font = "system";
      state.background = "aurora";
      state.music = "None";

      clearVoiceRecording();

      if (preview) {
        preview.innerHTML = "";
        preview.hidden = true;
      }

      document.querySelectorAll(
        ".status-choice-tray"
      ).forEach(tray => {
        tray.hidden = true;
      });

      updatePreview();
      setMode("text");
    }

    async function publish() {
      clearError();

      const button =
        document.getElementById(
          "publishStatusButton"
        );

      if (button) {
        button.disabled = true;
        button.textContent = "Posting…";
      }

      try {
        const textValue =
          text?.value.trim() || "";

        const captionValue =
          caption?.value.trim() || "";

        const selectedFile =
          media?.files?.[0] || null;

        if (
          state.mode === "text" &&
          !textValue
        ) {
          throw new Error(
            "Write something before posting."
          );
        }

        if (
          state.mode === "media" &&
          !selectedFile
        ) {
          throw new Error(
            "Choose a photo or video first."
          );
        }

        if (
          state.mode === "voice" &&
          !state.voiceBlob
        ) {
          throw new Error(
            "Record a voice status first."
          );
        }

        /*
         * If the existing StatusPage implementation exposes
         * publishStatus(), use it so existing Supabase logic,
         * RLS and status refresh behavior remain intact.
         */
        if (
          (window.StatusPage || window.ZakiStatus) &&
          typeof (window.StatusPage || window.ZakiStatus).publishStatus ===
            "function"
        ) {
          (window.StatusPage || window.ZakiStatus).__composerPayload = {
            mode: state.mode,
            text: textValue,
            caption: captionValue,
            file: selectedFile,
            voiceBlob: state.voiceBlob,
            font: state.font,
            background: state.background,
            music: state.music,
            audience:
              document.getElementById(
                "statusAudience"
              )?.value || "contacts",
            mentions:
              document.getElementById(
                "statusMentions"
              )?.value.trim() || ""
          };

          await (window.StatusPage || window.ZakiStatus).publishStatus(
            (window.StatusPage || window.ZakiStatus).__composerPayload
          );

          resetComposer();
          closeComposer();
          return;
        }

        throw new Error(
          "Status publishing module is not available."
        );

      } catch (err) {
        showError(
          err?.message ||
          "Unable to publish this status."
        );
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Post status";
        }
      }
    }

    document.getElementById("myStatusCard")
      ?.addEventListener(
        "click",
        openComposer
      );

    document.getElementById("addStatusButton")
      ?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          openComposer();
        }
      );

    document.getElementById("closeComposerButton")
      ?.addEventListener(
        "click",
        closeComposer
      );

    document.querySelectorAll(
      "[data-composer-mode]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => setMode(
          button.dataset.composerMode
        )
      );
    });

    document.querySelectorAll(
      "[data-action]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => toggleTray(
          button.dataset.action
        )
      );
    });

    document.querySelectorAll(
      "[data-font]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.font =
            button.dataset.font;

          updatePreview();

          const tray =
            document.getElementById(
              "statusFontTray"
            );

          if (tray) tray.hidden = true;
        }
      );
    });

    document.querySelectorAll(
      "[data-bg]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.background =
            button.dataset.bg;

          updatePreview();

          const tray =
            document.getElementById(
              "statusBackgroundTray"
            );

          if (tray) tray.hidden = true;
        }
      );
    });

    document.querySelectorAll(
      "[data-music]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.music =
            button.dataset.music;

          const tray =
            document.getElementById(
              "statusMusicTray"
            );

          if (tray) tray.hidden = true;
        }
      );
    });

    text?.addEventListener(
      "input",
      updatePreview
    );

    media?.addEventListener(
      "change",
      event => {
        previewMedia(
          event.target.files?.[0]
        );
      }
    );

    document.getElementById(
      "statusEmojiTray"
    )?.addEventListener(
      "click",
      event => {
        const emoji =
          event.target.textContent.trim();

        if (!emoji || !text) return;

        text.value +=
          (text.value ? " " : "") + emoji;

        text.dispatchEvent(
          new Event(
            "input",
            { bubbles: true }
          )
        );
      }
    );

    document.getElementById(
      "statusStickerTray"
    )?.addEventListener(
      "click",
      event => {
        const sticker =
          event.target.textContent.trim();

        if (!sticker || !text) return;

        text.value +=
          (text.value ? " " : "") + sticker;

        text.dispatchEvent(
          new Event(
            "input",
            { bubbles: true }
          )
        );
      }
    );

    const recordButton =
      document.getElementById(
        "statusRecordButton"
      );

    if (recordButton) {

      recordButton.addEventListener(
        "pointerdown",
        event => {
          event.preventDefault();
          startVoiceRecording();
        }
      );

      [
        "pointerup",
        "pointercancel",
        "pointerleave"
      ].forEach(type => {
        recordButton.addEventListener(
          type,
          event => {
            event.preventDefault();
            stopVoiceRecording();
          }
        );
      });
    }

    document.getElementById(
      "statusVoiceClearButton"
    )?.addEventListener(
      "click",
      clearVoiceRecording
    );

    document.getElementById(
      "publishStatusButton"
    )?.addEventListener(
      "click",
      publish
    );

    composer.addEventListener(
      "click",
      event => {
        if (event.target === composer) {
          closeComposer();
        }
      }
    );

    updatePreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initComposer
    );
  } else {
    initComposer();
  }

})();

/* ============================================================
   ZAKICHAT AURORA STATUS COMPOSER
   ============================================================ */

(function () {
  "use strict";

  function initComposer() {
    const composer = document.getElementById("statusComposer");
    if (!composer) return;

    const text = document.getElementById("statusText");
    const media = document.getElementById("statusMedia");
    const caption = document.getElementById("statusCaption");
    const preview = document.getElementById("statusMediaPreview");
    const textPreview = document.getElementById("statusTextPreview");
    const canvas = document.getElementById("statusComposerCanvas");
    const count = document.getElementById("statusCharacterCount");
    const error = document.getElementById("composerError");

    const state = {
      mode: "text",
      font: "system",
      background: "aurora",
      music: "None",
      voiceBlob: null,
      voiceRecorder: null,
      voiceChunks: [],
      voiceTimer: null,
      voiceStarted: 0
    };

    function showError(message) {
      if (!error) return;
      error.textContent = message;
      error.hidden = false;
    }

    function clearError() {
      if (!error) return;
      error.textContent = "";
      error.hidden = true;
    }

    function updatePreview() {
      if (textPreview) {
        textPreview.textContent =
          text?.value.trim() || "What's on your mind?";

        textPreview.className =
          "status-text-preview" +
          (state.font !== "system"
            ? " font-" + state.font
            : "");
      }

      if (canvas) {
        canvas.className =
          "status-composer-canvas" +
          (state.background !== "aurora"
            ? " bg-" + state.background
            : "");
      }

      if (count && text) {
        count.textContent = text.value.length;
      }
    }

    function setMode(mode) {
      state.mode = mode;

      document.querySelectorAll("[data-composer-mode]")
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.composerMode === mode
          );
        });

      const textTools =
        document.getElementById("statusTextTools");

      const mediaTools =
        document.getElementById("statusMediaTools");

      const voiceTools =
        document.getElementById("statusVoiceTools");

      const textPreviewElement =
        document.getElementById("statusTextPreview");

      const mediaPreviewElement =
        document.getElementById("statusMediaPreview");

      const voicePreviewElement =
        document.getElementById("statusVoicePreview");

      if (textTools) textTools.hidden = mode !== "text";
      if (mediaTools) mediaTools.hidden = mode !== "media";
      if (voiceTools) voiceTools.hidden = mode !== "voice";

      if (textPreviewElement) {
        textPreviewElement.hidden = mode !== "text";
      }

      if (mediaPreviewElement) {
        mediaPreviewElement.hidden = mode !== "media";
      }

      if (voicePreviewElement) {
        voicePreviewElement.hidden = mode !== "voice";
      }

      clearError();
    }

    function openComposer() {
      clearError();
      composer.hidden = false;
      setMode("text");
      updatePreview();

      setTimeout(() => {
        text?.focus();
      }, 80);
    }

    function closeComposer() {
      stopVoiceRecording();
      composer.hidden = true;
    }

    function toggleTray(name) {
      const map = {
        emoji: "statusEmojiTray",
        sticker: "statusStickerTray",
        font: "statusFontTray",
        background: "statusBackgroundTray",
        music: "statusMusicTray"
      };

      const target = map[name];
      if (!target) return;

      document.querySelectorAll(".status-choice-tray")
        .forEach(tray => {
          if (tray.id !== target) tray.hidden = true;
        });

      const tray = document.getElementById(target);

      if (tray) {
        tray.hidden = !tray.hidden;
      }
    }

    function previewMedia(file) {
      if (!preview) return;

      preview.innerHTML = "";

      if (!file) {
        preview.hidden = true;
        return;
      }

      const url = URL.createObjectURL(file);

      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");

        video.src = url;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;

        preview.appendChild(video);
      } else if (file.type.startsWith("image/")) {
        const image = document.createElement("img");

        image.src = url;
        image.alt = "Status preview";

        preview.appendChild(image);
      }

      preview.hidden = false;
    }

    function startVoiceTimer() {
      state.voiceStarted = Date.now();

      const time =
        document.getElementById("statusVoiceTime");

      state.voiceTimer = setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - state.voiceStarted) / 1000
        );

        const minutes =
          String(Math.floor(seconds / 60)).padStart(2, "0");

        const remaining =
          String(seconds % 60).padStart(2, "0");

        if (time) {
          time.textContent =
            minutes + ":" + remaining;
        }
      }, 250);
    }

    function stopVoiceTimer() {
      if (state.voiceTimer) {
        clearInterval(state.voiceTimer);
        state.voiceTimer = null;
      }
    }

    async function startVoiceRecording() {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        !window.MediaRecorder
      ) {
        showError(
          "Voice recording is not supported on this device."
        );
        return;
      }

      if (state.voiceRecorder) return;

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true
          });

        state.voiceChunks = [];

        const recorder =
          new MediaRecorder(stream);

        state.voiceRecorder = recorder;

        recorder.ondataavailable = event => {
          if (event.data && event.data.size) {
            state.voiceChunks.push(event.data);
          }
        };

        recorder.onstop = () => {
          const mime =
            recorder.mimeType || "audio/webm";

          state.voiceBlob =
            new Blob(state.voiceChunks, {
              type: mime
            });

          stream.getTracks().forEach(
            track => track.stop()
          );

          state.voiceRecorder = null;

          const clearButton =
            document.getElementById(
              "statusVoiceClearButton"
            );

          if (clearButton) {
            clearButton.hidden = false;
          }

          const recordButton =
            document.getElementById(
              "statusRecordButton"
            );

          if (recordButton) {
            recordButton.classList.remove(
              "recording"
            );

            recordButton.textContent =
              "🎙 Hold to record again";
          }

          stopVoiceTimer();
        };

        recorder.start();
        startVoiceTimer();

        const recordButton =
          document.getElementById(
            "statusRecordButton"
          );

        if (recordButton) {
          recordButton.classList.add("recording");
          recordButton.textContent =
            "● Recording… release to stop";
        }

        clearError();

      } catch (err) {
        showError(
          "Microphone permission is required."
        );
      }
    }

    function stopVoiceRecording() {
      const recorder = state.voiceRecorder;

      if (
        recorder &&
        recorder.state === "recording"
      ) {
        recorder.stop();
      }

      stopVoiceTimer();
    }

    function clearVoiceRecording() {
      state.voiceBlob = null;
      state.voiceChunks = [];

      const clearButton =
        document.getElementById(
          "statusVoiceClearButton"
        );

      if (clearButton) {
        clearButton.hidden = true;
      }

      const recordButton =
        document.getElementById(
          "statusRecordButton"
        );

      if (recordButton) {
        recordButton.classList.remove("recording");
        recordButton.textContent =
          "🎙 Hold to record";
      }

      const time =
        document.getElementById(
          "statusVoiceTime"
        );

      if (time) {
        time.textContent = "00:00";
      }
    }

    function resetComposer() {
      if (text) text.value = "";
      if (media) media.value = "";
      if (caption) caption.value = "";

      state.mode = "text";
      state.font = "system";
      state.background = "aurora";
      state.music = "None";

      clearVoiceRecording();

      if (preview) {
        preview.innerHTML = "";
        preview.hidden = true;
      }

      document.querySelectorAll(
        ".status-choice-tray"
      ).forEach(tray => {
        tray.hidden = true;
      });

      updatePreview();
      setMode("text");
    }

    async function publish() {
      clearError();

      const button =
        document.getElementById(
          "publishStatusButton"
        );

      if (button) {
        button.disabled = true;
        button.textContent = "Posting…";
      }

      try {
        const textValue =
          text?.value.trim() || "";

        const captionValue =
          caption?.value.trim() || "";

        const selectedFile =
          media?.files?.[0] || null;

        if (
          state.mode === "text" &&
          !textValue
        ) {
          throw new Error(
            "Write something before posting."
          );
        }

        if (
          state.mode === "media" &&
          !selectedFile
        ) {
          throw new Error(
            "Choose a photo or video first."
          );
        }

        if (
          state.mode === "voice" &&
          !state.voiceBlob
        ) {
          throw new Error(
            "Record a voice status first."
          );
        }

        /*
         * If the existing StatusPage implementation exposes
         * publishStatus(), use it so existing Supabase logic,
         * RLS and status refresh behavior remain intact.
         */
        if (
          (window.StatusPage || window.ZakiStatus) &&
          typeof (window.StatusPage || window.ZakiStatus).publishStatus ===
            "function"
        ) {
          (window.StatusPage || window.ZakiStatus).__composerPayload = {
            mode: state.mode,
            text: textValue,
            caption: captionValue,
            file: selectedFile,
            voiceBlob: state.voiceBlob,
            font: state.font,
            background: state.background,
            music: state.music,
            audience:
              document.getElementById(
                "statusAudience"
              )?.value || "contacts",
            mentions:
              document.getElementById(
                "statusMentions"
              )?.value.trim() || ""
          };

          await (window.StatusPage || window.ZakiStatus).publishStatus(
            (window.StatusPage || window.ZakiStatus).__composerPayload
          );

          resetComposer();
          closeComposer();
          return;
        }

        throw new Error(
          "Status publishing module is not available."
        );

      } catch (err) {
        showError(
          err?.message ||
          "Unable to publish this status."
        );
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Post status";
        }
      }
    }

    document.getElementById("myStatusCard")
      ?.addEventListener(
        "click",
        openComposer
      );

    document.getElementById("addStatusButton")
      ?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          openComposer();
        }
      );

    document.getElementById("closeComposerButton")
      ?.addEventListener(
        "click",
        closeComposer
      );

    document.querySelectorAll(
      "[data-composer-mode]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => setMode(
          button.dataset.composerMode
        )
      );
    });

    document.querySelectorAll(
      "[data-action]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => toggleTray(
          button.dataset.action
        )
      );
    });

    document.querySelectorAll(
      "[data-font]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.font =
            button.dataset.font;

          updatePreview();

          const tray =
            document.getElementById(
              "statusFontTray"
            );

          if (tray) tray.hidden = true;
        }
      );
    });

    document.querySelectorAll(
      "[data-bg]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.background =
            button.dataset.bg;

          updatePreview();

          const tray =
            document.getElementById(
              "statusBackgroundTray"
            );

          if (tray) tray.hidden = true;
        }
      );
    });

    document.querySelectorAll(
      "[data-music]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.music =
            button.dataset.music;

          const tray =
            document.getElementById(
              "statusMusicTray"
            );

          if (tray) tray.hidden = true;
        }
      );
    });

    text?.addEventListener(
      "input",
      updatePreview
    );

    media?.addEventListener(
      "change",
      event => {
        previewMedia(
          event.target.files?.[0]
        );
      }
    );

    document.getElementById(
      "statusEmojiTray"
    )?.addEventListener(
      "click",
      event => {
        const emoji =
          event.target.textContent.trim();

        if (!emoji || !text) return;

        text.value +=
          (text.value ? " " : "") + emoji;

        text.dispatchEvent(
          new Event(
            "input",
            { bubbles: true }
          )
        );
      }
    );

    document.getElementById(
      "statusStickerTray"
    )?.addEventListener(
      "click",
      event => {
        const sticker =
          event.target.textContent.trim();

        if (!sticker || !text) return;

        text.value +=
          (text.value ? " " : "") + sticker;

        text.dispatchEvent(
          new Event(
            "input",
            { bubbles: true }
          )
        );
      }
    );

    const recordButton =
      document.getElementById(
        "statusRecordButton"
      );

    if (recordButton) {

      recordButton.addEventListener(
        "pointerdown",
        event => {
          event.preventDefault();
          startVoiceRecording();
        }
      );

      [
        "pointerup",
        "pointercancel",
        "pointerleave"
      ].forEach(type => {
        recordButton.addEventListener(
          type,
          event => {
            event.preventDefault();
            stopVoiceRecording();
          }
        );
      });
    }

    document.getElementById(
      "statusVoiceClearButton"
    )?.addEventListener(
      "click",
      clearVoiceRecording
    );

    document.getElementById(
      "publishStatusButton"
    )?.addEventListener(
      "click",
      publish
    );

    composer.addEventListener(
      "click",
      event => {
        if (event.target === composer) {
          closeComposer();
        }
      }
    );

    updatePreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initComposer
    );
  } else {
    initComposer();
  }

})();
