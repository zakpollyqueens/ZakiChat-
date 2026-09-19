(function () {
  'use strict';

  const StatusPage = {
    db: null,
    userId: null,

    statuses: [],
    calls: [],

    profiles: new Map(),

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
          this.loadCalls()
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
      document
        .getElementById('addStatusButton')
        ?.addEventListener(
          'click',
          () => this.openComposer()
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
        this.loadCalls()
      ]);
    },

    /* ======================================================
       STATUS SYSTEM
       ====================================================== */

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

      if (!contactStatuses.length) {
        empty.hidden = false;
        return;
      }

      empty.hidden = true;

      for (
        const [
          userId,
          statuses
        ] of contactStatuses
      ) {
        const latest =
          statuses[0];

        const profile =
          this.profiles.get(
            userId
          );

        const name =
          this.getProfileName(
            profile
          );

        const button =
          document.createElement(
            'button'
          );

        button.type = 'button';
        button.className =
          'status-item';

        const avatar =
          document.createElement(
            'div'
          );

        avatar.className =
          'status-avatar';

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
          image.width = 48;
          image.height = 48;

          avatar.appendChild(
            image
          );
        } else {
          avatar.textContent =
            this.getInitials(
              name
            );
        }

        const info =
          document.createElement(
            'div'
          );

        info.className =
          'status-item-info';

        const title =
          document.createElement(
            'strong'
          );

        title.textContent =
          name;

        const subtitle =
          document.createElement(
            'span'
          );

        subtitle.textContent =
          this.statusPreview(
            latest
          );

        info.append(
          title,
          subtitle
        );

        button.append(
          avatar,
          info
        );

        button.addEventListener(
          'click',
          () => {
            this.openViewer(
              latest,
              name
            );
          }
        );

        list.appendChild(
          button
        );
      }
    },

    async publishStatus() {
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
        textarea.value.trim();

      const file =
        mediaInput.files?.[0] ||
        null;

      this.hideComposerError();

      if (!text && !file) {
        this.showComposerError(
          'Write something or choose a photo/video first.'
        );
        return;
      }

      if (
        file &&
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
                file.type.startsWith(
                  'image/'
                )
                  ? 'image'
                  : 'video'
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
            status.media_type ===
            'video'
          ) {
            const video =
              document.createElement(
                'video'
              );

            video.src =
              data.signedUrl;

            video.controls = true;
            video.playsInline = true;

            video.style.width =
              '100%';

            video.style.maxHeight =
              '65vh';

            content.appendChild(
              video
            );
          }
        }
      }

      document.getElementById(
        'statusViewer'
      ).hidden = false;

      if (
        status.user_id !==
        this.userId
      ) {
        await this.recordView(
          status.id
        );
      }
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
      document.getElementById(
        'statusComposer'
      ).hidden = false;

      document.getElementById(
        'statusText'
      ).focus();
    },

    closeComposer() {
      document.getElementById(
        'statusComposer'
      ).hidden = true;

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

        this.calls =
          Array.isArray(data)
            ? data
            : [];

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

      actions.append(
        chatButton,
        callButton
      );

      item.append(
        avatar,
        main,
        actions
      );

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
          ? `chats.html?${query}`
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

  window.ZakiStatus =
    StatusPage;

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

  const fallbackLatestRelease = {
    version: 'zc-vr15',
    description:
      'The latest publicly available ZakiChat version is available for free download.',
    channel: 'Stable',
    releaseDate: null,
    downloadUrl: '#'
  };

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
    upgradeUrl: '#'
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
    upgradeUrl: '#'
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
      data.version || 'zc-vr15'
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

    if (button) {
      button.href = data.downloadUrl || '#';
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

    /*
     * Future implementation:
     *
     * const response = await fetch('/api/public/releases');
     *
     * The backend will return separately:
     *
     * {
     *   latest: {...},
     *   upgrades: [...]
     * }
     *
     * This information will come from the Admin Dashboard.
     *
     * No admin credentials or secret keys belong here.
     */

    renderLatestRelease(fallbackLatestRelease);

    renderPaidUpgrades(fallbackPaidUpgrades);
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
      target_url: '#'
    },
    {
      id: 'demo-business',
      title: 'Business Experience',
      description:
        'Discover business profiles, teams, communication and meetings.',
      category: 'Business',
      image_url: '../static/images/showcase/business.svg',
      target_url: '#'
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
