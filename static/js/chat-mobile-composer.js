(function () {
  "use strict";

  const Composer = {
    composer: null,
    input: null,
    voiceButton: null,
    sendButton: null,
    viewport: null,
    raf: 0,

    init() {
      this.composer = document.getElementById("message-composer");
      this.input = this.composer?.querySelector('input[name="message"]');
      this.voiceButton = document.getElementById("voice-note-button");
      this.sendButton = document.getElementById("send-message-button");
      this.viewport = window.visualViewport || null;

      if (!this.composer || !this.input) return;

      this.bind();
      this.update();
      this.updateButtons();
    },

    bind() {
      this.input.addEventListener("focus", () => {
        document.body.classList.add("zaki-composer-focused");

        setTimeout(() => {
          this.update();
          this.keepInputVisible();
          this.scrollMessagesToBottom();
        }, 80);

        setTimeout(() => {
          this.update();
          this.keepInputVisible();
        }, 300);
      });

      this.input.addEventListener("blur", () => {
        document.body.classList.remove("zaki-composer-focused");

        setTimeout(() => this.update(), 120);
      });

      this.input.addEventListener("input", () => {
        this.updateButtons();
        this.update();
      });

      this.input.addEventListener("click", () => {
        this.keepInputVisible();
      });

      this.viewport?.addEventListener("resize", () => this.schedule());
      this.viewport?.addEventListener("scroll", () => this.schedule());

      window.addEventListener("resize", () => this.schedule());

      window.addEventListener("orientationchange", () => {
        setTimeout(() => {
          this.update();
          this.keepInputVisible();
        }, 250);
      });

      this.composer.addEventListener("pointerdown", () => {
        document.body.classList.add("zaki-composer-active");
      });

      document.addEventListener("pointerdown", event => {
        if (!this.composer.contains(event.target)) {
          document.body.classList.remove("zaki-composer-active");
        }
      });
    },

    schedule() {
      cancelAnimationFrame(this.raf);

      this.raf = requestAnimationFrame(() => {
        this.update();
      });
    },

    update() {
      if (!this.composer) return;

      const vv = window.visualViewport;

      const layoutHeight = window.innerHeight;

      let visualHeight = layoutHeight;
      let keyboardHeight = 0;

      if (vv) {
        visualHeight = Math.round(vv.height);

        keyboardHeight = Math.max(
          0,
          layoutHeight - vv.height - Math.max(0, vv.offsetTop)
        );
      }

      const keyboardOpen = keyboardHeight > 80;

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

      if (keyboardOpen) {
        this.composer.style.setProperty(
          "--zaki-composer-bottom",
          `${keyboardHeight}px`
        );
      } else {
        this.composer.style.setProperty(
          "--zaki-composer-bottom",
          "0px"
        );
      }

      this.updateButtons();

      if (keyboardOpen) {
        this.keepInputVisible();
      }
    },

    updateButtons() {
      if (!this.input) return;

      const hasText = this.input.value.trim().length > 0;

      if (this.voiceButton) {
        this.voiceButton.hidden = hasText;
        this.voiceButton.setAttribute(
          "aria-hidden",
          hasText ? "true" : "false"
        );
      }

      if (this.sendButton) {
        this.sendButton.hidden = !hasText;
        this.sendButton.setAttribute(
          "aria-hidden",
          hasText ? "false" : "true"
        );
      }
    },

    keepInputVisible() {
      if (!this.input) return;

      setTimeout(() => {
        try {
          const rect = this.input.getBoundingClientRect();
          const vv = window.visualViewport;

          const visibleBottom = vv
            ? vv.height
            : window.innerHeight;

          const safeSpace = 18;

          if (rect.bottom > visibleBottom - safeSpace) {
            this.input.scrollIntoView({
              block: "nearest",
              inline: "nearest",
              behavior: "smooth"
            });
          }
        } catch {}
      }, 40);
    },

    scrollMessagesToBottom() {
      const list = document.getElementById("messages-list");

      if (!list) return;

      requestAnimationFrame(() => {
        try {
          list.scrollTo({
            top: list.scrollHeight,
            behavior: "smooth"
          });
        } catch {
          list.scrollTop = list.scrollHeight;
        }
      });
    }
  };

  window.ZakiMobileComposer = Composer;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => Composer.init(),
      { once: true }
    );
  } else {
    Composer.init();
  }
})();
