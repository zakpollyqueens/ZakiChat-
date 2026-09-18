(function () {
  "use strict";

  function init() {
    const list =
      document.getElementById("languageList");

    const search =
      document.getElementById("languageSearch");

    const message =
      document.getElementById("languageMessage");

    if (
      !list ||
      !search ||
      !window.ZakiChatI18n
    ) {
      return;
    }

    const render = query => {
      const current =
        window.ZakiChatI18n
          .getCurrentLanguage();

      const normalizedQuery =
        String(query || "")
          .trim()
          .toLowerCase();

      const languages =
        window.ZakiChatI18n
          .languages()
          .filter(language => {
            if (!normalizedQuery) {
              return true;
            }

            return [
              language.nativeName,
              language.englishName,
              language.code
            ].some(value =>
              value
                .toLowerCase()
                .includes(normalizedQuery)
            );
          });

      list.innerHTML = "";

      if (!languages.length) {
        const empty =
          document.createElement("div");

        empty.className =
          "language-empty";

        empty.textContent =
          "No matching language found.";

        list.appendChild(empty);
        return;
      }

      languages.forEach(language => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className =
          "language-option";

        button.setAttribute(
          "role",
          "option"
        );

        button.setAttribute(
          "aria-selected",
          String(
            language.code === current
          )
        );

        if (language.code === current) {
          button.classList.add("selected");
        }

        const copy =
          document.createElement("span");

        copy.className =
          "language-copy";

        const native =
          document.createElement("strong");

        native.textContent =
          language.nativeName;

        const english =
          document.createElement("small");

        english.textContent =
          language.englishName;

        copy.append(
          native,
          english
        );

        const check =
          document.createElement("span");

        check.className =
          "language-check";

        check.textContent =
          language.code === current
            ? "✓"
            : "";

        button.append(
          copy,
          check
        );

        button.addEventListener(
          "click",
          () => {
            window.ZakiChatI18n
              .setLanguage(language.code);

            render(search.value);

            message.textContent =
              window.ZakiChatI18n
                .translate("language.saved");

            window.setTimeout(() => {
              message.textContent = "";
            }, 2200);
          }
        );

        list.appendChild(button);
      });
    };

    search.addEventListener(
      "input",
      () => render(search.value)
    );

    document.addEventListener(
      "zakichat:languagechange",
      () => render(search.value)
    );

    render("");
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
