(function () {
  "use strict";

  const ZakiCommunication = {
    db: null,
    config: null,
    currentUser: null,
    targetUser: null,
    conversationId: null,

    callId: null,
    callType: null,
    peer: null,
    signalChannel: null,
    callSubscription: null,
    signalSubscription: null,

    localStream: null,
    remoteStream: null,

    recording: false,
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartedAt: null,
    recordingTimer: null,

    initialized: false,

    init(config, options = {}) {
      this.config = config || null;
      this.db = window.ZakiChatAuth?.client || null;

      this.currentUser =
        options.currentUser || null;

      this.targetUser =
        options.targetUser || null;

      this.conversationId =
        options.conversationId || null;

      if (!this.db) {
        console.error(
          "ZakiCommunication: Supabase client unavailable."
        );
        return false;
      }

      this.createUI();

      this.bindEvents();

      this.initialized = true;

      return true;
    },

    setConversation(options = {}) {
      this.currentUser =
        options.currentUser || this.currentUser;

      this.targetUser =
        options.targetUser || this.targetUser;

      this.conversationId =
        options.conversationId ||
        this.conversationId;
    },

    escape(value) {
      const div =
        document.createElement("div");

      div.textContent =
        value == null ? "" : String(value);

      return div.innerHTML;
    },

    createUI() {
      if (
        document.getElementById(
          "zaki-communication-layer"
        )
      ) {
        return;
      }

      const layer =
        document.createElement("div");

      layer.id =
        "zaki-communication-layer";

      layer.innerHTML = `
        <div
          class="zaki-share-menu"
          id="zaki-share-menu"
          hidden
          aria-label="Share"
        >
          <button type="button" data-share-action="photo">
            <span>📷</span>
            <strong>Photo</strong>
            <small>Choose a photo</small>
          </button>

          <button type="button" data-share-action="video">
            <span>🎥</span>
            <strong>Video</strong>
            <small>Choose a video</small>
          </button>

          <button type="button" data-share-action="file">
            <span>📄</span>
            <strong>Document</strong>
            <small>Share a file</small>
          </button>

          <button type="button" data-share-action="voice">
            <span>🎙️</span>
            <strong>Voice note</strong>
            <small>Record a message</small>
          </button>

          <button type="button" data-share-action="location">
            <span>📍</span>
            <strong>Location</strong>
            <small>Share your current location</small>
          </button>
        </div>

        <div
          class="zaki-recording-bar"
          id="zaki-recording-bar"
          hidden
        >
          <div class="zaki-recording-dot"></div>

          <div class="zaki-recording-info">
            <strong>Recording voice note</strong>
            <span id="zaki-recording-time">0:00</span>
          </div>

          <button
            type="button"
            id="zaki-cancel-recording"
          >
            Cancel
          </button>

          <button
            type="button"
            id="zaki-send-recording"
          >
            Send
          </button>
        </div>

        <div
          class="zaki-call-overlay"
          id="zaki-call-overlay"
          hidden
        >
          <div class="zaki-call-window">

            <div class="zaki-call-header">
              <div>
                <strong id="zaki-call-name">
                  ZakiChat User
                </strong>

                <span id="zaki-call-status">
                  Connecting...
                </span>
              </div>

              <button
                type="button"
                id="zaki-close-call"
                aria-label="Close call"
              >
                ×
              </button>
            </div>

            <div class="zaki-video-stage">
              <video
                id="zaki-remote-video"
                autoplay
                playsinline
              ></video>

              <video
                id="zaki-local-video"
                autoplay
                muted
                playsinline
              ></video>

              <div
                class="zaki-call-avatar"
                id="zaki-call-avatar"
              >
                Z
              </div>
            </div>

            <div class="zaki-call-controls">

              <button
                type="button"
                id="zaki-toggle-mic"
                aria-label="Mute microphone"
                title="Mute microphone"
              >
                🎙️
              </button>

              <button
                type="button"
                id="zaki-toggle-camera"
                aria-label="Turn camera off"
                title="Turn camera off"
              >
                📹
              </button>

              <button
                type="button"
                class="zaki-end-call"
                id="zaki-end-call"
                aria-label="End call"
                title="End call"
              >
                ☎
              </button>

            </div>
          </div>
        </div>

        <div
          class="zaki-incoming-call"
          id="zaki-incoming-call"
          hidden
        >
          <div class="zaki-incoming-card">

            <div
              class="zaki-incoming-avatar"
              id="zaki-incoming-avatar"
            >
              Z
            </div>

            <strong id="zaki-incoming-name">
              Incoming call
            </strong>

            <span id="zaki-incoming-type">
              Voice call
            </span>

            <div class="zaki-incoming-actions">

              <button
                type="button"
                id="zaki-decline-call"
              >
                Decline
              </button>

              <button
                type="button"
                id="zaki-answer-call"
              >
                Answer
              </button>

            </div>
          </div>
        </div>
      `;

      document.body.appendChild(layer);
    },

    bindEvents() {
      document.addEventListener(
        "click",
        event => {
          const shareAction =
            event.target.closest(
              "[data-share-action]"
            );

          if (shareAction) {
            event.preventDefault();

            this.handleShareAction(
              shareAction.dataset.shareAction
            );

            return;
          }

          if (
            event.target.closest(
              "#zaki-cancel-recording"
            )
          ) {
            this.cancelRecording();
            return;
          }

          if (
            event.target.closest(
              "#zaki-send-recording"
            )
          ) {
            this.sendRecording();
            return;
          }

          if (
            event.target.closest(
              "#zaki-end-call"
            ) ||
            event.target.closest(
              "#zaki-close-call"
            )
          ) {
            this.endCall("ended");
            return;
          }

          if (
            event.target.closest(
              "#zaki-toggle-mic"
            )
          ) {
            this.toggleMicrophone();
            return;
          }

          if (
            event.target.closest(
              "#zaki-toggle-camera"
            )
          ) {
            this.toggleCamera();
            return;
          }

          if (
            event.target.closest(
              "#zaki-answer-call"
            )
          ) {
            this.answerIncomingCall();
            return;
          }

          if (
            event.target.closest(
              "#zaki-decline-call"
            )
          ) {
            this.declineIncomingCall();
          }
        }
      );

      document.addEventListener(
        "click",
        event => {
          const shareButton =
            event.target.closest(
              "#attach-file-button"
            );

          if (!shareButton) {
            return;
          }

          event.preventDefault();

          this.toggleShareMenu();
        }
      );
    },

    toggleShareMenu() {
      const menu =
        document.getElementById(
          "zaki-share-menu"
        );

      if (!menu) {
        return;
      }

      menu.hidden =
        !menu.hidden;
    },

    closeShareMenu() {
      const menu =
        document.getElementById(
          "zaki-share-menu"
        );

      if (menu) {
        menu.hidden = true;
      }
    },

    async handleShareAction(action) {
      this.closeShareMenu();

      if (
        !this.currentUser ||
        !this.conversationId
      ) {
        return;
      }

      if (
        action === "photo"
      ) {
        this.openFilePicker(
          "image/*"
        );
        return;
      }

      if (
        action === "video"
      ) {
        this.openFilePicker(
          "video/*"
        );
        return;
      }

      if (
        action === "file"
      ) {
        this.openFilePicker(
          ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        );
        return;
      }

      if (
        action === "voice"
      ) {
        await this.startRecording();
        return;
      }

      if (
        action === "location"
      ) {
        await this.shareLocation();
      }
    },

    openFilePicker(accept) {
      const input =
        document.createElement("input");

      input.type = "file";
      input.accept = accept;
      input.hidden = true;

      document.body.appendChild(
        input
      );

      input.addEventListener(
        "change",
        async () => {
          const file =
            input.files?.[0];

          input.remove();

          if (!file) {
            return;
          }

          if (
            !window.ZakiMedia
          ) {
            alert(
              "Media system is unavailable."
            );

            return;
          }

          const validation =
            window.ZakiMedia.validate(
              file
            );

          if (!validation.ok) {
            alert(
              validation.error
            );

            return;
          }

          await this.sendFile(
            file
          );
        },
        { once: true }
      );

      input.click();
    },

    async sendFile(file) {
      try {
        this.setCallStatus(
          "Uploading..."
        );

        const attachment =
          await window.ZakiMedia.upload(
            file,
            this.conversationId,
            this.currentUser.id
          );

        const {
          data,
          error
        } =
          await window.ZakiMessages.sendAttachment(
            this.conversationId,
            this.currentUser.id,
            attachment,
            null
          );

        if (error) {
          await window.ZakiMedia.remove(
            attachment.path
          );

          throw error;
        }

        this.appendMessage(
          data
        );
      } catch (error) {
        console.error(
          "ZakiCommunication file upload failed:",
          error
        );

        alert(
          error?.message ||
          "Unable to send the file."
        );
      }
    },

    appendMessage(message) {
      const panel =
        document.querySelector(
          ".messages-panel"
        );

      if (
        panel &&
        message &&
        window.ZakiMessages
      ) {
        window.ZakiMessages.appendIfMissing(
          panel,
          message,
          this.currentUser.id
        );

        panel.scrollTop =
          panel.scrollHeight;
      }
    },

    async startRecording() {
      if (
        this.recording ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return;
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true
            }
          );

        const mimeType =
          this.getRecorderMimeType();

        this.mediaRecorder =
          mimeType
            ? new MediaRecorder(
                stream,
                { mimeType }
              )
            : new MediaRecorder(
                stream
              );

        this.localRecordingStream =
          stream;

        this.recordedChunks =
          [];

        this.mediaRecorder.ondataavailable =
          event => {
            if (
              event.data &&
              event.data.size > 0
            ) {
              this.recordedChunks.push(
                event.data
              );
            }
          };

        this.mediaRecorder.onstop =
          () => {
            stream
              .getTracks()
              .forEach(track =>
                track.stop()
              );
          };

        this.mediaRecorder.start();

        this.recording =
          true;

        this.recordingStartedAt =
          Date.now();

        const bar =
          document.getElementById(
            "zaki-recording-bar"
          );

        if (bar) {
          bar.hidden = false;
        }

        this.startRecordingTimer();
      } catch (error) {
        console.error(
          "Voice recording failed:",
          error
        );

        alert(
          "Microphone permission is required to record a voice note."
        );
      }
    },

    getRecorderMimeType() {
      const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4"
      ];

      return types.find(
        type =>
          typeof MediaRecorder !==
            "undefined" &&
          MediaRecorder.isTypeSupported(
            type
          )
      ) || "";
    },

    startRecordingTimer() {
      this.stopRecordingTimer();

      this.recordingTimer =
        setInterval(() => {
          const elapsed =
            Math.floor(
              (
                Date.now() -
                this.recordingStartedAt
              ) / 1000
            );

          const minutes =
            Math.floor(
              elapsed / 60
            );

          const seconds =
            elapsed % 60;

          const element =
            document.getElementById(
              "zaki-recording-time"
            );

          if (element) {
            element.textContent =
              `${minutes}:${String(
                seconds
              ).padStart(2, "0")}`;
          }
        }, 500);
    },

    stopRecordingTimer() {
      if (
        this.recordingTimer
      ) {
        clearInterval(
          this.recordingTimer
        );

        this.recordingTimer =
          null;
      }
    },

    cancelRecording() {
      if (
        this.mediaRecorder &&
        this.mediaRecorder.state !==
          "inactive"
      ) {
        this.mediaRecorder.stop();
      }

      this.stopRecordingTimer();

      if (
        this.localRecordingStream
      ) {
        this.localRecordingStream
          .getTracks()
          .forEach(track =>
            track.stop()
          );

        this.localRecordingStream =
          null;
      }

      this.mediaRecorder =
        null;

      this.recordedChunks =
        [];

      this.recording =
        false;

      const bar =
        document.getElementById(
          "zaki-recording-bar"
        );

      if (bar) {
        bar.hidden = true;
      }
    },

    async sendRecording() {
      if (
        !this.recording ||
        !this.mediaRecorder
      ) {
        return;
      }

      const recorder =
        this.mediaRecorder;

      recorder.stop();

      this.stopRecordingTimer();

      this.recording =
        false;

      const bar =
        document.getElementById(
          "zaki-recording-bar"
        );

      if (bar) {
        bar.hidden = true;
      }

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            100
          )
      );

      if (
        !this.recordedChunks.length
      ) {
        this.cleanupRecording();
        return;
      }

      const mime =
        recorder.mimeType ||
        "audio/webm";

      const extension =
        mime.includes("ogg")
          ? "ogg"
          : mime.includes("mp4")
            ? "m4a"
            : "webm";

      const blob =
        new Blob(
          this.recordedChunks,
          {
            type: mime
          }
        );

      const file =
        new File(
          [blob],
          `voice-note-${Date.now()}.${extension}`,
          {
            type: mime
          }
        );

      this.cleanupRecording();

      await this.sendFile(
        file
      );
    },

    cleanupRecording() {
      if (
        this.localRecordingStream
      ) {
        this.localRecordingStream
          .getTracks()
          .forEach(track =>
            track.stop()
          );
      }

      this.localRecordingStream =
        null;

      this.mediaRecorder =
        null;

      this.recordedChunks =
        [];
    },

    async shareLocation() {
      if (
        !navigator.geolocation
      ) {
        alert(
          "Location services are not available in this browser."
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Share your current location with this chat?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const position =
          await new Promise(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true,
                  timeout: 15000,
                  maximumAge: 0
                }
              );
            }
          );

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const content =
          "📍 Shared location";

        const {
          data,
          error
        } =
          await this.db
            .from("messages")
            .insert({
              conversation_id:
                this.conversationId,

              sender_id:
                this.currentUser.id,

              content,

              message_type:
                "location",

              location_latitude:
                latitude,

              location_longitude:
                longitude
            })
            .select(`
              id,
              conversation_id,
              sender_id,
              content,
              message_type,
              created_at,
              updated_at,
              edited_at,
              read_at,
              reply_to_message_id,
              deleted_at,
              attachment_path,
              attachment_name,
              attachment_mime_type,
              attachment_size,
              location_latitude,
              location_longitude,
              location_label
            `)
            .single();

        if (error) {
          throw error;
        }

        this.appendLocationMessage(
          data
        );
      } catch (error) {
        console.error(
          "Location sharing failed:",
          error
        );

        if (
          error?.code === 1
        ) {
          alert(
            "Location permission was denied."
          );
        } else {
          alert(
            error?.message ||
            "Unable to share your location."
     );
        }
      }
    },

    appendLocationMessage(
      message
    ) {
      const panel =
        document.querySelector(
          ".messages-panel"
        );

      if (!panel || !message) {
        return;
      }

      if (
        panel.querySelector(
          `[data-message-id="${CSS.escape(
            message.id
          )}"]`
        )
      ) {
        return;
      }

      const mine =
        message.sender_id ===
        this.currentUser.id;

      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.className =
        `message-row ${
          mine
            ? "sent-row"
            : "received-row"
        }`;

      wrapper.dataset.messageId =
        message.id;

      const latitude =
        Number(
          message.location_latitude
        );

      const longitude =
        Number(
          message.location_longitude
        );

      const mapUrl =
        `https://www.google.com/maps?q=${encodeURIComponent(
          `${latitude},${longitude}`
        )}`;

      wrapper.innerHTML = `
        <div class="message-bubble ${
          mine
            ? "sent-bubble"
            : "received-bubble"
        }">
          <div class="zaki-location-card">
            <div class="zaki-location-icon">
              📍
            </div>

            <div class="zaki-location-details">
              <strong>Shared location</strong>
              <span>
                ${this.escape(
                  latitude.toFixed(6)
                )},
                ${this.escape(
                  longitude.toFixed(6)
                )}
              </span>
            </div>

            <a
              href="${mapUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open map
            </a>
          </div>

          <span class="message-time">
            ${new Date(
              message.created_at
            ).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
          </span>
        </div>
      `;

      panel.appendChild(
        wrapper
      );

      panel.scrollTop =
        panel.scrollHeight;
    },
async startCall(
      type
    ) {
      if (
        !this.currentUser ||
        !this.targetUser ||
        !this.conversationId
      ) {
        return;
      }

      if (
        this.callId
      ) {
        return;
      }

      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        alert(
          "Calling is not supported by this browser."
        );

        return;
      }

      this.callType =
        type === "video"
          ? "video"
          : "voice";

      try {
        const {
          data,
          error
        } =
          await this.db
            .from("calls")
            .insert({
              conversation_id:
                this.conversationId,

              caller_id:
                this.currentUser.id,

              callee_id:
                this.targetUser.id,

              call_type:
                this.callType,

              status:
                "ringing"
            })
            .select()
            .single();

        if (error) {
          throw error;
        }

        this.callId =
          data.id;

        await this.setupLocalMedia(
          this.callType
        );

        this.showCallOverlay(
          "Calling..."
        );

        await this.subscribeToCall(
          this.callId
        );

        const offer =
          await this.createPeer();

        await this.sendSignal(
          "offer",
          offer
        );

        await this.updateCall(
          {
            status:
              "connecting"
          }
        );
      } catch (error) {
        console.error(
          "Failed to start call:",
          error
        );

        alert(
          error?.message ||
          "Unable to start the call."
        );

        await this.cleanupCall(
          "failed"
        );
      }
    },async setupLocalMedia(
      type
    ) {
      this.localStream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
            video:
              type === "video"
          }
        );

      const localVideo =
        document.getElementById(
          "zaki-local-video"
        );

      if (localVideo) {
        localVideo.srcObject =
          this.localStream;

        localVideo.hidden =
          type !== "video";
      }

      const avatar =
        document.getElementById(
          "zaki-call-avatar"
        );

      if (avatar) {
        avatar.hidden =
          type === "video";
      }
    },

    async createPeer() {
      this.peer =
        new RTCPeerConnection(
          {
            iceServers: [
              {
                urls:
                  "stun:stun.l.google.com:19302"
              },
              {
                urls:
                  "stun:stun1.l.google.com:19302"
              }
            ]
          }
        );

      this.remoteStream =
        new MediaStream();

      const remoteVideo =
        document.getElementById(
          "zaki-remote-video"
        );

      if (remoteVideo) {
        remoteVideo.srcObject =
          this.remoteStream;
      }

      this.localStream
        ?.getTracks()
        .forEach(track => {
          this.peer.addTrack(
            track,
            this.localStream
          );
        });

      this.peer.ontrack =
        event => {
          event.streams?.[0]
            ?.getTracks()
            .forEach(track =>
              this.remoteStream.addTrack(
                track
              )
            );

          if (remoteVideo) {
            remoteVideo.srcObject =
              this.remoteStream;
          }
        };

      this.peer.onicecandidate =
        async event => {
          if (
            event.candidate
          ) {
            await this.sendSignal(
              "ice-candidate",
              event.candidate
            );
          }
        };

      this.peer.onconnectionstatechange =
        async () => {
          const state =
            this.peer?.connectionState;

          if (
            state === "connected"
          ) {
            await this.updateCall(
              {
                status:
                  "active",
                started_at:
                  new Date().toISOString()
              }
            );

            this.setCallStatus(
              "Connected"
            );
          }

          if (
            state === "failed"
          ) {
            await this.endCall(
              "failed"
            );
          }

          if (
            state === "disconnected"
          ) {
            this.setCallStatus(
              "Connection interrupted"
            );
          }
        };

      return this.peer;
    },

    async subscribeToCall(
      callId
    ) {
      if (
        !this.db ||
        !callId
      ) {
        return;
      }

      if (
        this.callSubscription
      ) {
        await this.db.removeChannel(
          this.callSubscription
        );
      }

      if (
        this.signalSubscription
      ) {
        await this.db.removeChannel(
          this.signalSubscription
        );
      }

      this.callSubscription =
        this.db
          .channel(
            `zaki-call-${callId}`
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "calls",
              filter:
                `id=eq.${callId}`
            },
            payload => {
              const call =
                payload.new;

              if (
                !call ||
                call.id !==
                  this.callId
              ) {
                return;
              }

              if (
                call.status ===
                  "declined" ||
                call.status ===
                  "cancelled" ||
                call.status ===
                  "ended" ||
                call.status ===
                  "failed"
              ) {this.setCallStatus(
                  this.statusText(
                    call.status
                  )
                );

                setTimeout(
                  () =>
                    this.cleanupCall(),
                  500
                );
              }
            }
          )
          .subscribe();

      this.signalSubscription =
        this.db
          .channel(
            `zaki-signals-${callId}`
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "call_signals",
              filter:
                `call_id=eq.${callId}`
            },
            async payload => {
              const signal =
                payload.new;

              if (
                !signal ||
                signal.sender_id ===
                  this.currentUser.id
              ) {
                return;
              }

              await this.handleSignal(
                signal
              );
            }
          )
          .subscribe();
    },

    async handleSignal(
      signal
    ) {
      if (
        !this.peer
      ) {
        return;
      }

      try {
        if (
          signal.signal_type ===
          "offer"
        ) {
          await this.peer.setRemoteDescription(
            new RTCSessionDescription(
              signal.payload
            )
          );

          const answer =
            await this.peer.createAnswer();

          await this.peer.setLocalDescription(
            answer
          );

          await this.sendSignal(
            "answer",
            answer
          );

          this.setCallStatus(
            "Connecting..."
          );

          return;
        }

        if (
          signal.signal_type ===
          "answer"
        ) {
          await this.peer.setRemoteDescription(
            new RTCSessionDescription(
              signal.payload
            )
          );

          return;
        }

        if (
          signal.signal_type ===
          "ice-candidate"
        ) {
          await this.peer.addIceCandidate(
            new RTCIceCandidate(
              signal.payload
            )
          );
        }
      } catch (error) {
        console.error(
          "WebRTC signaling error:",
          error
        );
      }
    },

    async sendSignal(
      signalType,
      payload
    ) {
      if (
        !this.callId ||
        !this.currentUser
      ) {
        return;
      }

      const {
        error
      } =
        await this.db
          .from("call_signals")
          .insert({
            call_id:
              this.callId,

            sender_id:
              this.currentUser.id,

            signal_type:
              signalType,

            payload
          });

      if (error) {
        throw error;
      }
    },

    async updateCall(
      values
    ) {
      if (
        !this.callId
      ) {
        return;
      }

      const {
        error
      } =
        await this.db
          .from("calls")
          .update(values)
          .eq(
            "id",
            this.callId
          );

      if (error) {
        throw error;
      }
    },

    showCallOverlay(
      status
    ) {
      const overlay =
        document.getElementById(
          "zaki-call-overlay"
        );

      if (overlay) {
        overlay.hidden = false;
      }

      const name =
        document.getElementById(
          "zaki-call-name"
        );

      if (name) {
        name.textContent =
          this.targetUser?.full_name ||
          this.targetUser?.username ||
          "ZakiChat User";
      }

      const statusElement =
        document.getElementById(
          "zaki-call-status"
        );

      if (statusElement) {
        statusElement.textContent =
          status ||
          "Connecting...";
   }

      const type =
        this.callType;

      const cameraButton =
        document.getElementById(
          "zaki-toggle-camera"
        );

      if (cameraButton) {
        cameraButton.hidden =
          type !== "video";
      }
    },

    setCallStatus(
      status
    ) {
      const element =
        document.getElementById(
          "zaki-call-status"
        );

      if (element) {
        element.textContent =
          status;
      }
    },

    statusText(
      status
    ) {
      const map = {
        declined:
          "Call declined",
        cancelled:
          "Call cancelled",
        ended:
          "Call ended",
        failed:
          "Call failed"
      };

      return (
        map[status] ||
        "Call ended"
      );
    },

    toggleMicrophone() {
      const track =
        this.localStream
          ?.getAudioTracks?.()[0];

      if (!track) {
        return;
      }

      track.enabled =
        !track.enabled;

      const button =
        document.getElementById(
          "zaki-toggle-mic"
        );

      if (button) {
        button.textContent =
          track.enabled
            ? "🎙️"
            : "🔇";

        button.title =
          track.enabled
            ? "Mute microphone"
            : "Unmute microphone";
      }
    },

    toggleCamera() {
      const track =
        this.localStream
          ?.getVideoTracks?.()[0];

      if (!track) {
        return;
      }

      track.enabled =
        !track.enabled;

      const button =
        document.getElementById(
          "zaki-toggle-camera"
        );

      if (button) {
        button.textContent =
          track.enabled
            ? "📹"
            : "🚫";

        button.title =
          track.enabled
            ? "Turn camera off"
            : "Turn camera on";
      }
    },

    async endCall(
      status = "ended"
    ) {
      if (
        this.callId
      ) {
        try {
          await this.updateCall({
            status
          });
        } catch (error) {
          console.error(
            "Unable to update call status:",
            error
          );
        }
      }

      await this.cleanupCall();
    },

    async cleanupCall() {
      this.stopRecordingTimer();

      if (
        this.peer
      ) {
        this.peer.ontrack =
          null;

        this.peer.onicecandidate =
          null;

        this.peer.close();

        this.peer =
          null;
      }

      if (
        this.localStream
      ) {
        this.localStream
          .getTracks()
          .forEach(track =>
            track.stop()
          );

        this.localStream =
          null;
      }

      this.remoteStream =
        null;

      if (
        this.callSubscription
      ) {
        try {
          await this.db.removeChannel(
            this.callSubscription
          );
        } catch (_) {}

        this.callSubscription =
          null;
      }

      if (
        this.signalSubscription
      ) {
        try {
          await this.db.removeChannel(
            this.signalSubscription
          );
        } catch (_) {}

        this.signalSubscription =
          null;
      }

      this.callId =
        null;

      this.callType =
        null;

      const overlay =
        document.getElementById(
          "zaki-call-overlay"
        );

      if (overlay) {
        overlay.hidden = true;
      }

      const localVideo =
        document.getElementById(
          "zaki-local-video"
        );

      const remoteVideo =
        document.getElementById(
          "zaki-remote-video"
        );

      if (localVideo) {
        localVideo.srcObject =
          null;
      }

      if (remoteVideo) {
        remoteVideo.srcObject =
          null;
      }
    },

    async answerIncomingCall() {
      const incoming =
        document.getElementById(
          "zaki-incoming-call"
        );

      if (incoming) {
        incoming.hidden =
          true;
      }

      /*
       * Incoming-call handling is intentionally completed
       * through the same call record/signaling channel.
       * The call record is assigned below.
       */
      const callId =
        this.pendingIncomingCallId;

      if (!callId) {
        return;
      }

      try {
        const {
          data,
          error
        } =
          await this.db
            .from("calls")
            .select("*")
            .eq(
              "id",
              callId
            )
            .single();

        if (error) {
          throw error;
        }

        this.callId =
          data.id;

        this.callType =
          data.call_type;

        this.targetUser =
          {
            id:
              data.caller_id
          };

        await this.setupLocalMedia(
          this.callType
        );

        this.showCallOverlay(
          "Connecting..."
        );

        await this.subscribeToCall(
          this.callId
        );

        await this.updateCall({
          status:
            "connecting"
        });

        await this.createPeer();
      } catch (error) {
        console.error(
          "Unable to answer call:",
          error
        );

        alert(
          error?.message ||
          "Unable to answer the call."
        );

        await this.cleanupCall(
          "failed"
        );
      }

      this.pendingIncomingCallId =
        null;
    },

    async declineIncomingCall() {
      const callId =
        this.pendingIncomingCallId;

      const incoming =
        document.getElementById(
          "zaki-incoming-call"
        );

      if (incoming) {
        incoming.hidden =
          true;
      }

      this.pendingIncomingCallId =
        null;

      if (!callId) {
        return;
      }

      try {
        await this.db
          .from("calls")
          .update({
            status:
              "declined"
          })
          .eq(
            "id",
            callId
          );
      } catch (error) {
        console.error(
          "Unable to decline call:",
          error
        );
      }
    },
async listenForIncomingCalls() {
      if (
        !this.db ||
        !this.currentUser
      ) {
        return;
      }

      const channel =
        this.db.channel(
          `zaki-incoming-calls-${this.currentUser.id}`
        );

      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter:
            `callee_id=eq.${this.currentUser.id}`
        },
        payload => {
          const call =
            payload.new;

          if (
            !call ||
            call.callee_id !==
              this.currentUser.id
          ) {
            return;
          }

          if (
            call.status !==
            "ringing"
          ) {
            return;
          }

          this.showIncomingCall(
            call
          );
        }
      );

      channel.subscribe();

      this.incomingCallChannel =
        channel;
    },

    showIncomingCall(
      call
    ) {
      if (
        this.callId
      ) {
        return;
      }

      this.pendingIncomingCallId =
        call.id;

      this.pendingIncomingCallType =
        call.call_type;

      const incoming =
        document.getElementById(
          "zaki-incoming-call"
        );

      const name =
        document.getElementById(
          "zaki-incoming-name"
        );

      const type =
        document.getElementById(
          "zaki-incoming-type"
        );

      if (name) {
        name.textContent =
          "Incoming call";
      }

      if (type) {
        type.textContent =
          call.call_type ===
          "video"
            ? "Video call"
            : "Voice call";
      }

      if (incoming) {
        incoming.hidden =
          false;
      }

      /*
       * The caller profile is fetched asynchronously.
       */
      this.db
        .from("profiles")
        .select(
          "id,username,full_name,avatar_url"
        )
        .eq(
          "id",
          call.caller_id
        )
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            return;
          }

          if (name) {
            name.textContent =
              data.full_name ||
              data.username ||
              "ZakiChat User";
          }

          const avatar =
            document.getElementById(
              "zaki-incoming-avatar"
            );

          if (avatar) {
            avatar.textContent =
              (
                data.full_name ||
                data.username ||
                "Z"
              )
                .split(/\s+/)
                .slice(0, 2)
                .map(
                  part =>
                    part[0]
                      ?.toUpperCase()
                )
                .join("") ||
              "Z";
          }
        });
    }
  };

  window.ZakiCommunication =
    ZakiCommunication;
})();
