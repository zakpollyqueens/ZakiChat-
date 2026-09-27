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

      if (!this.composer || !this.input) {
        return;
      }

      this.bind();
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

          setTimeout(() => {
            this.update();
            this.scrollInputIntoView();
          }, 80);
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
          }, 120);
        }
      );

      this.input.addEventListener(
        "input",
        () => {
          this.updateButtons();
          this.update();
        }
      );

      this.input.addEventListener(
        "click",
        () => {
          this.scrollInputIntoView();
        }
      );

      this.viewport?.addEventListener(
        "resize",
        () => this.schedule()
      );

      this.viewport?.addEventListener(
        "scroll",
        () => this.schedule()
      );

      window.addEventListener(
        "resize",
        () => this.schedule()
      );

      window.addEventListener(
        "orientationchange",
        () => {
          setTimeout(
            () => this.update(),
            180
          );
        }
      );

      this.composer.addEventListener(
        "pointerdown",
        () => {
          document.body.classList.add(
            "zaki-composer-active"
          );
        }
      );

      document.addEventListener(
        "pointerdown",
        event => {
          if (
            !this.composer.contains(
              event.target
            )
          ) {
            document.body.classList.remove(
              "zaki-composer-active"
            );
          }
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

      const vv =
        window.visualViewport;

      let viewportHeight =
        window.innerHeight;

      let keyboardHeight = 0;

      if (vv) {
        viewportHeight =
          Math.round(vv.height);

        const layoutHeight =
          window.innerHeight;

        keyboardHeight =
          Math.max(
            0,
            layoutHeight -
              vv.height -
              Math.max(
                0,
                vv.offsetTop
              )
          );
      }

      document.documentElement.style.setProperty(
        "--zaki-visual-height",
        `${viewportHeight}px`
      );

      document.documentElement.style.setProperty(
        "--zaki-keyboard-height",
        `${keyboardHeight}px`
      );

      const keyboardOpen =
        keyboardHeight > 80;

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
          hasText ? "true" : "false"
        );
      }

      if (this.sendButton) {
        this.sendButton.hidden =
          !hasText;

        this.sendButton.setAttribute(
          "aria-hidden",
          hasText ? "false" : "true"
        );
      }
    },

    scrollInputIntoView() {
      if (!this.input) {
        return;
      }

      setTimeout(() => {
        try {
          this.input.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth"
          });
        } catch {
          try {
            this.input.scrollIntoView();
          } catch {}
        }
      }, 60);
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
