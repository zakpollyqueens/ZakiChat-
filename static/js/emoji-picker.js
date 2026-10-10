(function () {
  "use strict";

  const categories = {
    smileys: [
      "😀","😃","😄","😁","😆","😅","😂","🤣",
      "😊","😇","🙂","🙃","😉","😌","😍","🥰",
      "😘","😗","😙","😚","😋","😛","😝","😜",
      "🤪","🤨","🧐","🤓","😎","🥳","😏","😒",
      "😞","😔","😟","😕","🙁","☹️","😣","😖",
      "😫","😩","🥺","😢","😭","😤","😠","😡",
      "🤬","🤯","😳","🥵","🥶","😱","😨","😰",
      "😥","😓","🤗","🤔","🫣","🤭","🫢","🤫",
      "🤥","😶","🫠","😐","😑","😬","🙄","😯",
      "😦","😧","😮","😲","🥱","😴","🤤","😪",
      "😵","🤐","🥴","🤢","🤮","🤧","😷","🤒",
      "🤕","🤑","🤠","😈","👿","👹","👺","🤡",
      "💩","👻","💀","☠️","👽","👾","🤖","🎃",
      "😺","😸","😹","😻","😼","😽","🙀","😿",
      "😾"
    ],

    people: [
      "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️",
      "🤞","🤟","🤘","🤙","👈","👉","👆","👇",
      "☝️","👍","👎","✊","👊","🤛","🤜","👏",
      "🙌","👐","🤲","🤝","🙏","✍️","💅","🤳",
      "💪","🫶","❤️‍🔥","🫂","👀","👁️","👄","👅",
      "👶","🧒","👦","👧","🧑","👨","👩","🧓",
      "👴","👵","🙍","🙎","🙅","🙆","💁","🙋",
      "🧏","🙇","🤦","🤷","👮","👷","💂","🕵️",
      "👩‍⚕️","👨‍⚕️","👩‍🏫","👨‍🏫","👩‍💻","👨‍💻"
    ],

    animals: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
      "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
      "🙉","🙊","🐒","🐔","🐧","🐦","🐤","🦆",
      "🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝",
      "🐛","🦋","🐌","🐞","🐜","🪲","🕷️","🦂",
      "🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦀",
      "🐠","🐟","🐡","🐬","🐳","🐋","🦈","🐊",
      "🐘","🦏","🦛","🦒","🦘","🦬","🐃","🐂",
      "🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌"
    ],

    food: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇",
      "🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
      "🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️",
      "🌽","🥕","🧄","🧅","🥔","🍞","🥐","🥖",
      "🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩",
      "🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮",
      "🌯","🥗","🍿","🍣","🍤","🍜","🍝","🍚",
      "🍛","🍲","🍰","🎂","🧁","🍩","🍪","🍫",
      "🍬","🍭","☕","🧃","🥤","🧋","🍹","🍓"
    ],

    activities: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉",
      "🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏",
      "⛳","🏹","🎣","🤿","🥊","🥋","🎽","🛹",
      "🛷","⛸️","🎿","🏆","🥇","🥈","🥉","🏅",
      "🎖️","🎯","🎮","🕹️","🎲","♟️","🎭","🎨",
      "🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎸",
      "🎺","🎻","🎪","🎟️","🎫","🎉","🎊","🎈",
      "🎁","🎂","🔥","✨","🌟","💫","⭐"
    ],

    travel: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑",
      "🚒","🚐","🛻","🚚","🚛","🚜","🛵","🏍️",
      "🚲","🛴","✈️","🛫","🛬","🚁","🚀","🛸",
      "🚢","⛵","🚤","🛥️","🚂","🚆","🚇","🚉",
      "🏠","🏡","🏢","🏥","🏦","🏫","🏨","🏪",
      "⛪","🕌","🛕","🗽","🗼","🏰","🏝️","🏖️",
      "🌋","⛰️","🏕️","🌅","🌄","🌇","🌃","🌌"
    ],

    objects: [
      "⌚","📱","💻","⌨️","🖥️","🖨️","📷","📸",
      "📹","🎥","📺","📻","🎙️","☎️","📞","🔋",
      "💡","🔦","🕯️","📚","📖","📝","✏️","🖊️",
      "📌","📎","✂️","🔒","🔓","🔑","🔨","🛠️",
      "⚙️","🧰","🧲","💰","💳","🎁","🎈","🎀",
      "👑","💎","🔔","📢","📣","💬","💭","📨",
      "📩","📤","📥","📁","📂","📄","📃","🗂️"
    ],

    symbols: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
      "🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","☮️","✝️","☪️","🕉️","☯️",
      "☀️","🌙","⭐","🌟","✨","⚡","🔥","💯",
      "✅","❌","❗","❓","‼️","⁉️","⭕","🚫",
      "⚠️","🔴","🟠","🟡","🟢","🔵","🟣","⚫",
      "⚪","🟤","🔔","🔕","🔇","🔊","▶️","⏸️",
      "⏹️","⏩","⏪","🔀","🔁","♻️","✔️","➕"
    ]
  };

  const button = document.getElementById("emoji-button");
  const input = document.querySelector(".message-composer input");

  if (!button || !input) return;

  // The chat page historically omitted the picker markup, causing the
  // visible emoji button to have no handler. Build the accessible picker
  // when a page does not provide one.
  let picker = document.getElementById("emoji-picker");
  if (!picker) {
    picker = document.createElement("section");
    picker.id = "emoji-picker";
    picker.className = "emoji-picker";
    picker.hidden = true;
    picker.setAttribute("aria-label", "Emoji picker");
    picker.innerHTML = `
      <div class="emoji-tabs" role="tablist" aria-label="Emoji categories">
        <button type="button" class="emoji-tab active" data-category="smileys" role="tab">😊</button>
        <button type="button" class="emoji-tab" data-category="people" role="tab">👋</button>
        <button type="button" class="emoji-tab" data-category="animals" role="tab">🐻</button>
        <button type="button" class="emoji-tab" data-category="food" role="tab">🍎</button>
        <button type="button" class="emoji-tab" data-category="activities" role="tab">⚽</button>
        <button type="button" class="emoji-tab" data-category="travel" role="tab">🚗</button>
        <button type="button" class="emoji-tab" data-category="objects" role="tab">💡</button>
        <button type="button" class="emoji-tab" data-category="symbols" role="tab">❤️</button>
      </div>
      <div id="emoji-grid" class="emoji-grid" role="grid"></div>
    `;
    document.querySelector(".chat-shell")?.insertBefore(picker, document.getElementById("message-composer"));
  }
  const grid = document.getElementById("emoji-grid");
  if (!grid) return;

  let activeCategory = "smileys";

  function render(category) {
    activeCategory = category;
    grid.innerHTML = "";

    categories[category].forEach(function (emoji) {
      const item = document.createElement("button");

      item.type = "button";
      item.className = "emoji-item";
      item.textContent = emoji;
      item.setAttribute("aria-label", "Insert " + emoji);

      item.addEventListener("click", function () {
        insertEmoji(emoji);
      });

      grid.appendChild(item);
    });

    document.querySelectorAll(".emoji-tab").forEach(function (tab) {
      tab.classList.toggle(
        "active",
        tab.dataset.category === activeCategory
      );
    });
  }

  function insertEmoji(emoji) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;

    input.value =
      input.value.slice(0, start) +
      emoji +
      input.value.slice(end);

    input.focus();

    const position = start + emoji.length;
    input.setSelectionRange(position, position);

    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  button.addEventListener("click", function (event) {
    event.stopPropagation();

    picker.hidden = !picker.hidden;

    if (!picker.hidden) {
      render(activeCategory);
    }
  });

  document.querySelectorAll(".emoji-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      render(tab.dataset.category);
    });
  });

  document.addEventListener("click", function (event) {
    if (
      !picker.contains(event.target) &&
      event.target !== button
    ) {
      picker.hidden = true;
    }
  });

  input.addEventListener("focus", function () {
    if (!picker.hidden) {
      picker.hidden = true;
    }
  });

  render(activeCategory);
})();
