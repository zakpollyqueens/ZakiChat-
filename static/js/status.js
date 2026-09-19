(function () {
  'use strict';

  const StatusPage = {
    db: null,
    userId: null,
    statuses: [],
    profiles: new Map(),
    realtimeChannel: null,

    async init() {
      try {
        if (!window.supabase || !window.ZakiChatConfig) {
          throw new Error('ZakiChat configuration is unavailable.');
        }

        this.db = window.ZakiChatAuth?.client;

        if (!this.db) {
          throw new Error('Supabase client is unavailable.');
        }

        const { data: sessionData, error: sessionError } =
          await this.db.auth.getSession();

        if (sessionError) throw sessionError;

        this.userId = sessionData?.session?.user?.id;

        if (!this.userId) {
          window.location.href = 'login.html';
          return;
        }

        this.bindEvents();
        await this.loadStatuses();
        this.subscribeRealtime();
      } catch (error) {
        console.error('Status initialization failed:', error);
        this.showError(error.message || 'Unable to load Updates.');
      }
    },

    bindEvents() {
      document
        .getElementById('addStatusButton')
        ?.addEventListener('click', () => this.openComposer());

      document
        .getElementById('closeComposerButton')
        ?.addEventListener('click', () => this.closeComposer());

      document
        .getElementById('closeViewerButton')
        ?.addEventListener('click', () => this.closeViewer());

      document
        .getElementById('publishStatusButton')
        ?.addEventListener('click', () => this.publishStatus());

      document
        .getElementById('statusText')
        ?.addEventListener('input', event => {
          document.getElementById('statusCharacterCount').textContent =
            event.target.value.length;
        });

      document
        .getElementById('statusMedia')
        ?.addEventListener('change', event => {
          this.previewMedia(event.target.files?.[0] || null);
        });

      document.getElementById('statusComposer')
        ?.addEventListener('click', event => {
          if (event.target.id === 'statusComposer') {
            this.closeComposer();
          }
        });

      document.getElementById('statusViewer')
        ?.addEventListener('click', event => {
          if (event.target.id === 'statusViewer') {
            this.closeViewer();
          }
        });
    },

    async loadStatuses() {
      this.hideError();

      const { data, error } = await this.db
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
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      this.statuses = data || [];

      await this.loadProfiles();
      await this.render();
    },

    async loadProfiles() {
      const ids = [...new Set(this.statuses.map(status => status.user_id))];

      if (!ids.length) return;

      const { data, error } = await this.db
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', ids);

      if (error) throw error;

      this.profiles.clear();

      (data || []).forEach(profile => {
        this.profiles.set(profile.id, profile);
      });
    },

    async render() {
      const list = document.getElementById('statusList');
      const empty = document.getElementById('statusEmpty');
      const count = document.getElementById('statusCount');

      list.innerHTML = '';

      const grouped = new Map();

      for (const status of this.statuses) {
        if (!grouped.has(status.user_id)) {
          grouped.set(status.user_id, []);
        }

        grouped.get(status.user_id).push(status);
      }

      const contactStatuses = [...grouped.entries()]
        .filter(([userId]) => userId !== this.userId);

      count.textContent = contactStatuses.length;

      const ownStatuses = grouped.get(this.userId) || [];

      document.getElementById('myStatusSummary').textContent =
        ownStatuses.length
          ? `${ownStatuses.length} active status${ownStatuses.length === 1 ? '' : 'es'}`
          : 'Add a status update';

      if (!contactStatuses.length) {
        empty.hidden = false;
        return;
      }

      empty.hidden = true;

      for (const [userId, statuses] of contactStatuses) {
        const latest = statuses[0];
        const profile = this.profiles.get(userId);
        const name = this.getProfileName(profile);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'status-item';

        const avatar = document.createElement('div');
        avatar.className = 'status-avatar';

        if (profile?.avatar_url) {
          const image = document.createElement('img');
          image.src = profile.avatar_url;
          image.alt = '';
          image.width = 48;
          image.height = 48;
          image.style.width = '100%';
          image.style.height = '100%';
          image.style.objectFit = 'cover';
          image.style.borderRadius = '50%';
          avatar.appendChild(image);
        } else {
          avatar.textContent = this.getInitials(name);
        }

        const info = document.createElement('div');
        info.className = 'status-item-info';

        const title = document.createElement('strong');
        title.textContent = name;

        const subtitle = document.createElement('span');
        subtitle.textContent = this.statusPreview(latest);

        info.append(title, subtitle);
        button.append(avatar, info);

        button.addEventListener('click', () => {
          this.openViewer(latest, name);
        });

        list.appendChild(button);
      }
    },

    async publishStatus() {
      const textarea = document.getElementById('statusText');
      const mediaInput = document.getElementById('statusMedia');
      const button = document.getElementById('publishStatusButton');

      const text = textarea.value.trim();
      const file = mediaInput.files?.[0] || null;

      this.hideComposerError();

      if (!text && !file) {
        this.showComposerError(
          'Write something or choose a photo/video first.'
        );
        return;
      }

      if (file && !file.type.startsWith('image/') &&
          !file.type.startsWith('video/')) {
        this.showComposerError('Only image and video files can be posted.');
        return;
      }

      button.disabled = true;
      button.textContent = file ? 'Uploading...' : 'Posting...';

      let statusId = null;
      let uploadedPath = null;

      try {
        const mediaType = file
          ? (file.type.startsWith('image/') ? 'image' : 'video')
          : null;

        const { data: status, error: insertError } =
          await this.db
            .from('status_updates')
            .insert({
              user_id: this.userId,
              text: text || null,
              media_type: mediaType
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        statusId = status.id;

        if (file) {
          const extension = this.getExtension(file.name);
          const safeName =
            `${Date.now()}-${crypto.randomUUID()}${extension}`;

          uploadedPath =
            `${this.userId}/${statusId}/${safeName}`;

          const { error: uploadError } =
            await this.db.storage
              .from('status-updates')
              .upload(uploadedPath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
              });

          if (uploadError) throw uploadError;

          const { error: updateError } =
            await this.db
              .from('status_updates')
              .update({
                media_path: uploadedPath
              })
              .eq('id', statusId)
              .eq('user_id', this.userId);

          if (updateError) throw updateError;
        }

        textarea.value = '';
        mediaInput.value = '';

        document.getElementById('statusCharacterCount').textContent = '0';
        document.getElementById('statusMediaPreview').innerHTML = '';
        document.getElementById('statusMediaPreview').hidden = true;

        this.closeComposer();
        await this.loadStatuses();
      } catch (error) {
        console.error('Status creation failed:', error);

        if (uploadedPath) {
          await this.db.storage
            .from('status-updates')
            .remove([uploadedPath])
            .catch(() => {});
        }

        if (statusId) {
          await this.db
            .from('status_updates')
            .delete()
            .eq('id', statusId)
            .eq('user_id', this.userId);
        }

        this.showComposerError(
          error.message || 'Unable to publish your status.'
        );
      } finally {
        button.disabled = false;
        button.textContent = 'Post status';
      }
    },

    async openViewer(status, name) {
      document.getElementById('viewerName').textContent = name;
      document.getElementById('viewerTime').textContent =
        this.formatDate(status.created_at);

      const content = document.getElementById('viewerContent');
      content.innerHTML = '';

      if (status.text) {
        const text = document.createElement('div');
        text.textContent = status.text;
        content.appendChild(text);
      }

      if (status.media_path) {
        const { data, error } =
          await this.db.storage
            .from('status-updates')
            .createSignedUrl(status.media_path, 3600);

        if (error) {
          console.warn('Unable to load status media:', error);
        } else if (data?.signedUrl) {
          if (status.media_type === 'image') {
            const image = document.createElement('img');
            image.src = data.signedUrl;
            image.alt = `${name}'s status`;
            image.style.width = '100%';
            image.style.maxHeight = '65vh';
            image.style.objectFit = 'contain';
            content.appendChild(image);
          } else if (status.media_type === 'video') {
            const video = document.createElement('video');
            video.src = data.signedUrl;
            video.controls = true;
            video.playsInline = true;
            video.style.width = '100%';
            video.style.maxHeight = '65vh';
            content.appendChild(video);
          }
        }
      }

      document.getElementById('statusViewer').hidden = false;

      if (status.user_id !== this.userId) {
        await this.recordView(status.id);
      }
    },

    async recordView(statusId) {
      try {
        const { error } = await this.db
          .from('status_views')
          .upsert(
            {
              status_id: statusId,
              viewer_id: this.userId
            },
            {
              onConflict: 'status_id,viewer_id',
              ignoreDuplicates: true
            }
          );

        if (error) {
          console.warn('Unable to record status view:', error);
        }
      } catch (error) {
        console.warn('Status view error:', error);
      }
    },

    previewMedia(file) {
      const preview = document.getElementById('statusMediaPreview');
      preview.innerHTML = '';

      if (!file) {
        preview.hidden = true;
        return;
      }

      if (!file.type.startsWith('image/') &&
          !file.type.startsWith('video/')) {
        this.showComposerError('Only image and video files can be posted.');
        preview.hidden = true;
        return;
      }

      const objectUrl = URL.createObjectURL(file);

      if (file.type.startsWith('image/')) {
        const image = document.createElement('img');
        image.src = objectUrl;
        image.alt = 'Status preview';
        preview.appendChild(image);
      } else {
        const video = document.createElement('video');
        video.src = objectUrl;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;
        preview.appendChild(video);
      }

      preview.hidden = false;
    },

    openComposer() {
      document.getElementById('statusComposer').hidden = false;
      document.getElementById('statusText').focus();
    },

    closeComposer() {
      document.getElementById('statusComposer').hidden = true;
      this.hideComposerError();
    },

    closeViewer() {
      document.getElementById('statusViewer').hidden = true;
    },

    subscribeRealtime() {
      if (!window.ZakiRealtime?.subscribe) return;

      try {
        this.realtimeChannel = window.ZakiRealtime.subscribe(
          'status_updates',
          'status_updates',
          null,
          () => this.loadStatuses(),
          '*'
        );
      } catch (error) {
        console.warn('Status realtime subscription unavailable:', error);
      }
    },

    getProfileName(profile) {
      if (!profile) return 'ZakiChat user';

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
        .map(part => part.charAt(0).toUpperCase())
        .join('') || '?';
    },

    statusPreview(status) {
      if (status.text) {
        return status.text.replace(/\s+/g, ' ').slice(0, 80);
      }

      if (status.media_type === 'image') return '📷 Photo';
      if (status.media_type === 'video') return '🎥 Video';

      return 'Status update';
    },

    getExtension(filename) {
      const match = filename.match(/\.[a-z0-9]+$/i);
      return match ? match[0].toLowerCase() : '';
    },

    formatDate(value) {
      const date = new Date(value);

      return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    },

    showError(message) {
      const element = document.getElementById('statusError');
      element.textContent = message;
      element.hidden = false;
    },

    hideError() {
      document.getElementById('statusError').hidden = true;
    },

    showComposerError(message) {
      const element = document.getElementById('composerError');
      element.textContent = message;
      element.hidden = false;
    },

    hideComposerError() {
      document.getElementById('composerError').hidden = true;
    }
  };

  window.ZakiStatus = StatusPage;

  document.addEventListener('DOMContentLoaded', () => {
    StatusPage.init();
  });
})();
