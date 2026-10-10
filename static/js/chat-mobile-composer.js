(function () {
  "use strict";

  const Composer = {
    composer: null,
    input: null,
    voiceButton: null,
    sendButton: null,
    viewport: null,
    raf: 0,
    baselineHeight: 0,

    init() {
      this.composer =
        document.getElementById("message-composer");

      this.input =
        this.composer?.querySelector(
          'input[name="message"]'
        );

      this.voiceButton =
        document.getElementById(
          "voice-note-button"
        );

      this.sendButton =
        document.getElementById(
          "send-message-button"
        );

      this.viewport =
        window.visualViewport || null;
      this.baselineHeight = Math.max(
        window.innerHeight || 0,
        this.viewport ? this.viewport.height + Math.max(0, this.viewport.offsetTop || 0) : 0
      );

      if (!this.composer || !this.input) {
        return;
      }

      // Always allow Android/iOS to open the device keyboard (Gboard, etc.).
      // A stale readonly attribute can silently prevent the native IME.
      this.input.readOnly = false;
      this.input.removeAttribute("readonly");
      this.input.setAttribute("inputmode", "text");
      this.input.setAttribute("enterkeyhint", "send");

      this.bind();

      document.body.classList.remove(
        "zaki-keyboard-open"
      );

      this.composer.classList.remove(
        "keyboard-raised"
      );

      this.composer.style.removeProperty(
        "--zaki-composer-bottom"
      );

      this.update();
      this.updateButtons();
    },

    bind() {
      // Do not preventDefault on pointer/touch events here: Android WebView
      // requires a real user gesture to open the system keyboard.
      this.input.addEventListener("pointerdown", () => {
        this.input.readOnly = false;
        this.input.removeAttribute("readonly");
      }, { passive: true });

      this.input.addEventListener("touchend", () => {
        this.input.readOnly = false;
        this.input.removeAttribute("readonly");
      }, { passive: true });

      this.input.addEventListener(
        "focus",
        () => {
          document.body.classList.add(
            "zaki-composer-focused"
          );
          // Refresh baseline immediately before the Android IME resizes
          // the visual viewport, avoiding a false zero keyboard height.
          this.baselineHeight = Math.max(
            this.baselineHeight,
            Math.round(window.innerHeight || 0)
          );

          this.schedule();

          setTimeout(() => {
            this.update();
            this.scrollMessagesToBottom();
            this.keepInputVisible();
          }, 100);

          setTimeout(() => {
            this.update();
            this.keepInputVisible();
          }, 350);
        }
      );

      this.input.addEventListener(
        "blur",
        () => {
          document.body.classList.remove(
            "zaki-composer-focused"
          );

          setTimeout(() => {
            this.update();
          }, 200);
        }
      );

      this.input.addEventListener(
        "input",
        () => {
          this.updateButtons();
          this.schedule();
        }
      );

      this.input.addEventListener(
        "click",
        () => {
          // Focus from the direct tap (not from a timer) so the OS keyboard
          // is permitted to appear in Android WebView.
          if (document.activeElement !== this.input) {
            this.input.focus({ preventScroll: true });
          }
          this.keepInputVisible();
          this.scrollMessagesToBottom();
        }
      );

      if (this.viewport) {
        this.viewport.addEventListener(
          "resize",
          () => this.schedule()
        );

        this.viewport.addEventListener(
          "scroll",
          () => this.schedule()
        );
      }

      window.addEventListener(
        "resize",
        () => this.schedule()
      );

      window.addEventListener(
        "orientationchange",
        () => {
          setTimeout(() => {
            this.update();
            this.keepInputVisible();
            this.scrollMessagesToBottom();
          }, 350);
        }
      );
    },

    schedule() {
      cancelAnimationFrame(this.raf);

      this.raf =
        requestAnimationFrame(() => {
          this.update();
        });
    },

    update() {
      if (!this.composer) {
        return;
      }

      const vv = window.visualViewport;
      const visibleBottom = vv
        ? Math.round(vv.height + Math.max(0, vv.offsetTop || 0))
        : Math.round(window.innerHeight || 0);
      const focused = document.activeElement === this.input;
      if (!focused || visibleBottom > this.baselineHeight) {
        this.baselineHeight = Math.max(visibleBottom, Math.round(window.innerHeight || 0));
      }
      const visualHeight = vv ? Math.round(vv.height) : Math.round(window.innerHeight || 0);
      const keyboardHeight = focused
        ? Math.max(0, Math.round(this.baselineHeight - visibleBottom))
        : 0;
      const keyboardOpen = keyboardHeight > 80 && focused;

      document.documentElement.style.setProperty(
        "--zaki-visual-height",
        `${visualHeight}px`
      );

      document.documentElement.style.setProperty(
        "--zaki-keyboard-height",
        `${keyboardHeight}px`
      );

      document.body.classList.toggle(
        "zaki-keyboard-open",
        keyboardOpen
      );

      this.composer.classList.toggle(
        "keyboard-raised",
        keyboardOpen
      );

      /*
       * Android WebViews differ: some move fixed elements with the visual
       * viewport, while others leave them at the layout-viewport bottom.
       * Measure the composer instead of assuming either behaviour. Adding
       * the current offset back gives the unadjusted bottom edge, preventing
       * the correction from oscillating across resize events.
       */
      this.syncComposerBottom(visibleBottom);

      if (keyboardOpen) {
        this.scrollMessagesToBottom();
        this.keepInputVisible();
      }
    },

    syncComposerBottom(visibleBottom) {
      if (!this.composer) return;
      requestAnimationFrame(() => {
        if (!this.composer?.isConnected) return;
        const currentOffset = Number.parseFloat(
          this.composer.style.getPropertyValue("--zaki-composer-bottom")
        ) || 0;
        const rect = this.composer.getBoundingClientRect();
        const unadjustedBottom = rect.bottom + currentOffset;
        const requiredOffset = Math.max(
          0,
          Math.round(unadjustedBottom - visibleBottom)
        );
        const nextValue = `${requiredOffset}px`;
        if (this.composer.style.getPropertyValue("--zaki-composer-bottom") !== nextValue) {
          this.composer.style.setProperty("--zaki-composer-bottom", nextValue);
        }
      });
    },

    updateButtons() {
      if (!this.input) {
        return;
      }

      const hasText =
        this.input.value.trim().length > 0;

      if (this.voiceButton) {
        this.voiceButton.hidden =
          hasText;

        this.voiceButton.setAttribute(
          "aria-hidden",
          hasText
            ? "true"
            : "false"
        );
      }

      if (this.sendButton) {
        this.sendButton.hidden =
          !hasText;

        this.sendButton.setAttribute(
          "aria-hidden",
          hasText
            ? "false"
            : "true"
        );
      }
    },

    keepInputVisible() {
      if (!this.input) {
        return;
      }

      setTimeout(() => {
        try {
          const rect =
            this.input.getBoundingClientRect();

          const vv =
            window.visualViewport;

          const visibleBottom =
            vv
              ? vv.height +
                Math.max(
                  0,
                  vv.offsetTop
                )
              : window.innerHeight;

          if (
            rect.bottom >
            visibleBottom - 8
          ) {
            this.input.scrollIntoView({
              block: "nearest",
              inline: "nearest",
              behavior: "smooth"
            });
          }
        } catch {}
      }, 50);
    },

    scrollMessagesToBottom() {
      const list =
        document.getElementById(
          "messages-list"
        );

      if (!list) {
        return;
      }

      requestAnimationFrame(() => {
        try {
          list.scrollTo({
            top: list.scrollHeight,
            behavior: "smooth"
          });
        } catch {
          list.scrollTop =
            list.scrollHeight;
        }
      });
    }
  };

  window.ZakiMobileComposer =
    Composer;

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => Composer.init(),
      { once: true }
    );
  } else {
    Composer.init();
  }
})();
