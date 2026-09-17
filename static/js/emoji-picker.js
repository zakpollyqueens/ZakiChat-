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

  const picker = document.getElementById("emoji-picker");
  const button = document.getElementById("emoji-button");
  const grid = document.getElementById("emoji-grid");
  const input = document.querySelector(".message-composer input");

  if (!picker || !button || !grid || !input) return;

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
