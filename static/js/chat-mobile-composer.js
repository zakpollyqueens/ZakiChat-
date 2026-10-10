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
      this.input.addEventListener(
        "focus",
        () => {
          document.body.classList.add(
            "zaki-composer-focused"
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
      if (!this.composer) return;

      const vv = window.visualViewport;
      const visualHeight = Math.round(
        vv ? vv.height : (window.innerHeight || document.documentElement.clientHeight || 0)
      );
      const visibleBottom = Math.round(
        vv ? vv.height + Math.max(0, vv.offsetTop || 0) : visualHeight
      );
      const focused = document.activeElement === this.input;
      if (!focused || visibleBottom > this.baselineHeight) {
        this.baselineHeight = Math.max(
          visibleBottom,
          Math.round(window.innerHeight || 0)
        );
      }

      const keyboardHeight = focused
        ? Math.max(0, Math.round(this.baselineHeight - visibleBottom))
        : 0;
      const keyboardOpen = focused && keyboardHeight > 80;

      /* Let the chat shell follow Android's actual visual viewport. Avoid
         repeatedly measuring and offsetting the composer, which can create
         a feedback loop and make the input jump when the keyboard animates. */
      document.documentElement.style.setProperty(
        "--zaki-visual-height",
        `${visualHeight}px`
      );
      document.documentElement.style.setProperty(
        "--zaki-keyboard-height",
        `${keyboardHeight}px`
      );
      document.body.classList.toggle("zaki-keyboard-open", keyboardOpen);
      this.composer.classList.toggle("keyboard-raised", keyboardOpen);
      this.composer.style.removeProperty("--zaki-composer-bottom");

      if (keyboardOpen) {
        this.scrollMessagesToBottom();
      }
    },

    syncComposerBottom() {
      if (this.composer) {
        this.composer.style.removeProperty("--zaki-composer-bottom");
      }
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
