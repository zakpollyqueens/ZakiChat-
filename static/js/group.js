(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const config = window.ZakiChatConfig;

    if (
      !window.supabase ||
      !config ||
      !window.ZakiMessages ||
      !window.ZakiRealtime
    ) {
      console.error("ZakiChat group: required modules unavailable.");
      return;
    }

    const db = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    window.ZakiMessages.init(config);
    window.ZakiRealtime.init(config);

    const groupId =
      new URLSearchParams(window.location.search).get("id");

    if (!groupId) {
      window.location.href = "groups.html";
      return;
    }

    const els = {
      title: document.getElementById("groupTitle"),
      avatar: document.getElementById("groupAvatar"),
      members: document.getElementById("groupMembers"),
      messages: document.getElementById("groupMessages"),
      composer: document.getElementById("groupComposer"),
      input: document.getElementById("groupMessageInput"),
      attach: document.getElementById("groupAttachButton"),
      menu: document.getElementById("groupMenuButton"),

      infoButton: document.getElementById("groupInfoButton"),
      overlay: document.getElementById("groupInfoOverlay"),
      close: document.getElementById("groupInfoClose"),

      infoAvatar: document.getElementById("groupInfoAvatar"),
      infoName: document.getElementById("groupInfoName"),
      infoDescription: document.getElementById(
        "groupInfoDescription"
      ),

      editSection: document.getElementById(
        "groupEditSection"
      ),
      editForm: document.getElementById("groupEditForm"),
      editName: document.getElementById("groupEditName"),
      editDescription: document.getElementById(
        "groupEditDescription"
      ),
      editCancel: document.getElementById(
        "groupEditCancel"
      ),
      editSave: document.getElementById("groupEditSave"),

      memberCount: document.getElementById(
        "groupMemberCount"
      ),
      memberList: document.getElementById(
        "groupMemberList"
      ),

      addButton: document.getElementById(
        "groupAddMemberButton"
      ),
      addSection: document.getElementById(
        "groupAddSection"
      ),
      memberSearch: document.getElementById(
        "groupMemberSearch"
      ),
      userResults: document.getElementById(
        "groupUserResults"
      ),

      leaveButton: document.getElementById(
        "groupLeaveButton"
      ),
      actionNote: document.getElementById(
        "groupActionNote"
      ),
      toast: document.getElementById("groupToast")
    };

    let currentUser = null;
    let currentGroup = null;
    let currentMembers = [];
    let currentUserRole = "member";
    let allProfiles = [];
    let toastTimer = null;

    function escapeText(value) {
      const div = document.createElement("div");
      div.textContent = value == null ? "" : String(value);
      return div.textContent;
    }

    function initials(name) {
      const value = String(name || "ZG").trim();

      if (!value) {
        return "ZG";
      }

      const parts = value
        .split(/\s+/)
        .filter(Boolean);

      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }

      return (
        parts[0][0] +
        parts[parts.length - 1][0]
      ).toUpperCase();
    }

    function displayName(profile) {
      return (
        profile?.full_name ||
        profile?.username ||
        "ZakiChat User"
      );
    }

    function username(profile) {
      if (!profile?.username) {
        return "";
      }

      return `@${profile.username}`;
    }

    function showToast(message) {
      if (!els.toast) {
        return;
      }

      els.toast.textContent = message;
      els.toast.classList.add("show");

      clearTimeout(toastTimer);

      toastTimer = setTimeout(() => {
        els.toast.classList.remove("show");
      }, 2600);
    }

    function setBusy(button, busy, text) {
      if (!button) {
        return;
      }

      if (busy) {
        button.dataset.originalText =
          button.textContent;
        button.disabled = true;
        button.textContent =
          text || "Please wait...";
      } else {
        button.disabled = false;
        button.textContent =
          button.dataset.originalText ||
          button.textContent;
      }
    }

    function openInfo() {
      els.overlay.hidden = false;
      document.body.classList.add("group-info-open");
      refreshInfoUI();
    }

    function closeInfo() {
      els.overlay.hidden = true;
      document.body.classList.remove("group-info-open");
      els.addSection.hidden = true;
    }

    function refreshInfoUI() {
      if (!currentGroup) {
        return;
      }

      const name = currentGroup.name || "ZakiChat Group";
      const description =
        currentGroup.description ||
        "No group description.";

      const avatar = initials(name);

      els.title.textContent = name;
      els.avatar.textContent = avatar;
      els.infoName.textContent = name;
      els.infoAvatar.textContent = avatar;
      els.infoDescription.textContent = description;

      const count = currentMembers.length;

      els.members.textContent =
        `${count} ${count === 1 ? "member" : "members"}`;

      els.memberCount.textContent =
        `${count} ${count === 1 ? "member" : "members"}`;

      const manager =
        currentUserRole === "owner" ||
        currentUserRole === "admin";

      els.editSection.hidden = !manager;
      els.addButton.hidden = !manager;

      if (currentUserRole === "owner") {
        els.leaveButton.disabled = true;
        els.leaveButton.style.opacity = ".45";
        els.actionNote.textContent =
          "The group owner must transfer ownership before leaving.";
      } else {
        els.leaveButton.disabled = false;
        els.leaveButton.style.opacity = "1";
        els.actionNote.textContent =
          "Leaving removes you from this group and its conversation.";
      }

      if (
        document.activeElement !== els.editName &&
        document.activeElement !== els.editDescription
      ) {
        els.editName.value = name;
        els.editDescription.value =
          currentGroup.description || "";
      }

      renderMembers();
    }

    function renderMembers() {
      els.memberList.innerHTML = "";

      if (!currentMembers.length) {
        const empty = document.createElement("p");
        empty.className = "group-action-note";
        empty.textContent = "No members found.";
        els.memberList.appendChild(empty);
        return;
      }

      currentMembers.forEach(member => {
        const profile =
          member.profile || {};

        const row =
          document.createElement("div");

        row.className = "group-member";

        const avatar =
          document.createElement("div");

        avatar.className =
          "group-member-avatar";

        avatar.textContent =
          initials(displayName(profile));

        const main =
          document.createElement("div");

        main.className = "group-member-main";

        const name =
          document.createElement("span");

        name.className =
          "group-member-name";

        name.textContent =
          displayName(profile);

        const user =
          document.createElement("span");

        user.className =
          "group-member-username";

        user.textContent =
          username(profile);

        main.append(name, user);

        const role =
          document.createElement("span");

        role.className =
          `group-member-role ${member.role}`;

        role.textContent =
          member.role;

        row.append(
          avatar,
          main,
          role
        );

        if (
          currentUserRole === "owner" ||
          currentUserRole === "admin"
        ) {
          if (
            member.user_id !== currentUser.id &&
            member.role !== "owner"
          ) {
            const actions =
              document.createElement("div");

            actions.className =
              "group-member-actions";

            if (currentUserRole === "owner") {
              const roleButton =
                document.createElement("button");

              roleButton.type = "button";
              roleButton.className =
                "group-member-action";

              roleButton.textContent =
                member.role === "admin"
                  ? "Demote"
                  : "Admin";

              roleButton.addEventListener(
                "click",
                () =>
                  changeRole(
                    member.user_id,
                    member.role === "admin"
                      ? "member"
                      : "admin"
                  )
              );

              actions.appendChild(roleButton);
            }

            if (
              currentUserRole === "owner" ||
              member.role === "member"
            ) {
              const removeButton =
                document.createElement("button");

              removeButton.type = "button";
              removeButton.className =
                "group-member-action danger";

              removeButton.textContent =
                "Remove";

              removeButton.addEventListener(
                "click",
                () =>
                  removeMember(
                    member.user_id,
                    displayName(profile)
                  )
              );

              actions.appendChild(removeButton);
            }

            row.appendChild(actions);
          }
        }

        els.memberList.appendChild(row);
      });
    }

    async function loadGroup() {
      const { data, error } =
        await db
          .from("groups")
          .select(`
            id,
            conversation_id,
            name,
            description,
            avatar_url,
            created_by,
            created_at,
            updated_at
          `)
          .eq("id", groupId)
          .maybeSingle();

      if (error || !data) {
        console.error(
          "ZakiChat group load:",
          error
        );

        showToast("Group could not be loaded.");
        return false;
      }

      currentGroup = data;

      const { data: membership, error: memberError } =
        await db
          .from("group_members")
          .select(`
            id,
            group_id,
            user_id,
            role,
            joined_at
          `)
          .eq("group_id", groupId);

      if (memberError) {
        console.error(
          "ZakiChat group members:",
          memberError
        );

        showToast("Unable to load group members.");
        return false;
      }

      const ids =
        (membership || []).map(
          member => member.user_id
        );

      let profiles = [];

      if (ids.length) {
        const { data: profileData } =
          await db
            .from("profiles")
            .select(
              "id,full_name,username,avatar_url"
            )
            .in("id", ids);

        profiles = profileData || [];
      }

      const profileMap =
        new Map(
          profiles.map(profile => [
            profile.id,
            profile
          ])
        );

      currentMembers =
        (membership || []).map(member => ({
          ...member,
          profile:
            profileMap.get(member.user_id) || {}
        }));

      const me =
        currentMembers.find(
          member =>
            member.user_id === currentUser.id
        );

      if (!me) {
        showToast("You are no longer a group member.");

        setTimeout(() => {
          window.location.href = "groups.html";
        }, 900);

        return false;
      }

      currentUserRole = me.role;

      refreshInfoUI();

      return true;
    }

    async function loadMessages() {
      const messages =
        await window.ZakiMessages.load(
          currentGroup.conversation_id
        );

      els.messages.innerHTML = "";

      if (!messages || !messages.length) {
        return;
      }

      const senderIds =
        [
          ...new Set(
            messages.map(
              message => message.sender_id
            )
          )
        ];

      let profiles = [];

      if (senderIds.length) {
        const { data } =
          await db
            .from("profiles")
            .select(
              "id,full_name,username,avatar_url"
            )
            .in("id", senderIds);

        profiles = data || [];
      }

      const profileMap =
        new Map(
          profiles.map(profile => [
            profile.id,
            profile
          ])
        );

      let lastDate = "";

      messages.forEach(message => {
        const date =
          new Date(message.created_at);

        const dateKey =
          date.toLocaleDateString();

        if (dateKey !== lastDate) {
          const divider =
            document.createElement("div");

          divider.className =
            "group-date-divider";

          const span =
            document.createElement("span");

          span.textContent =
            date.toLocaleDateString(
              undefined,
              {
                weekday: "short",
                month: "short",
                day: "numeric"
              }
            );

          divider.appendChild(span);
          els.messages.appendChild(divider);

          lastDate = dateKey;
        }

        const profile =
          profileMap.get(
            message.sender_id
          ) || {};

        const sent =
          message.sender_id ===
          currentUser.id;

        const wrapper =
          document.createElement("article");

        wrapper.className =
          `group-message ${
            sent ? "sent" : "received"
          }`;

        const avatar =
          document.createElement("div");

        avatar.className =
          "group-message-avatar";

        avatar.textContent =
          initials(displayName(profile));

        const bubble =
          document.createElement("div");

        bubble.className =
          "group-message-content";

        const sender =
          document.createElement("strong");

        sender.textContent =
          sent
            ? ""
            : displayName(profile);

        const content =
          document.createElement("p");

        content.textContent =
          message.content || "";

        const time =
          document.createElement("small");

        time.textContent =
          date.toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          );

        if (!sent) {
          bubble.appendChild(sender);
        }

        bubble.append(
          content,
          time
        );

        wrapper.append(
          avatar,
          bubble
        );

        els.messages.appendChild(wrapper);
      });

      els.messages.scrollTop =
        els.messages.scrollHeight;
    }

    async function sendMessage() {
      const content =
        els.input.value.trim();

      if (!content) {
        return;
      }

      els.input.value = "";

      const { error } =
        await window.ZakiMessages.send(
          currentGroup.conversation_id,
          currentUser.id,
          content
        );

      if (error) {
        console.error(
          "ZakiChat group send:",
          error
        );

        els.input.value = content;
        showToast(
          error.message ||
          "Message could not be sent."
        );
        return;
      }

      await loadMessages();
    }

    async function saveGroupDetails(event) {
      event.preventDefault();

      const name =
        els.editName.value.trim();

      const description =
        els.editDescription.value.trim();

      if (name.length < 2) {
        showToast(
          "Group name must be at least 2 characters."
        );
        return;
      }

      setBusy(
        els.editSave,
        true,
        "Saving..."
      );

      const { data, error } =
        await db.rpc(
          "update_group",
          {
            p_group_id: groupId,
            p_name: name,
            p_description:
              description || null,
            p_avatar_url:
              currentGroup.avatar_url || null
          }
        );

      setBusy(
        els.editSave,
        false
      );

      if (error) {
        console.error(
          "ZakiChat update group:",
          error
        );

        showToast(
          error.message ||
          "Group details could not be updated."
        );

        return;
      }

      currentGroup = data;

      refreshInfoUI();

      showToast(
        "Group details updated."
      );
    }

    async function loadProfilesForAdding() {
      const { data, error } =
        await db
          .from("profiles")
          .select(
            "id,full_name,username,avatar_url"
          )
          .limit(100);

      if (error) {
        console.error(
          "ZakiChat profile search:",
          error
        );

        showToast(
          "Unable to search users."
        );

        return;
      }

      const memberIds =
        new Set(
          currentMembers.map(
            member => member.user_id
          )
        );

      allProfiles =
        (data || []).filter(
          profile =>
            !memberIds.has(profile.id)
        );

      renderUserResults("");
    }

    function renderUserResults(query) {
      els.userResults.innerHTML = "";

      const needle =
        query.trim().toLowerCase();

      const results =
        allProfiles
          .filter(profile => {
            if (!needle) {
              return true;
            }

            return (
              String(
                profile.full_name || ""
              )
                .toLowerCase()
                .includes(needle) ||
              String(
                profile.username || ""
              )
                .toLowerCase()
                .includes(needle)
            );
          })
          .slice(0, 20);

      if (!results.length) {
        const empty =
          document.createElement("p");

        empty.className =
          "group-action-note";

        empty.textContent =
          "No matching users found.";

        els.userResults.appendChild(empty);
        return;
      }

      results.forEach(profile => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className =
          "group-user-result";

        const avatar =
          document.createElement("span");

        avatar.className =
          "group-user-result-avatar";

        avatar.textContent =
          initials(displayName(profile));

        const copy =
          document.createElement("span");

        copy.className =
          "group-user-result-copy";

        const name =
          document.createElement("strong");

        name.textContent =
          displayName(profile);

        const user =
          document.createElement("span");

        user.textContent =
          username(profile) ||
          "ZakiChat user";

        copy.append(name, user);
        button.append(avatar, copy);

        button.addEventListener(
          "click",
          () =>
            addMember(
              profile.id,
              displayName(profile)
            )
        );

        els.userResults.appendChild(button);
      });
    }

    async function addMember(userId, name) {
      const { error } =
        await db.rpc(
          "add_group_member",
          {
            p_group_id: groupId,
            p_user_id: userId
          }
        );

      if (error) {
     console.error(
          "ZakiChat add member:",
          error
        );

        showToast(
          error.message ||
          "Member could not be added."
        );

        return;
      }

      showToast(
        `${name} added to the group.`
      );

      els.addSection.hidden = true;

      await loadGroup();
      await loadProfilesForAdding();
    }

    async function removeMember(userId, name) {
      if (
        !window.confirm(
          `Remove ${name} from this group?`
        )
      ) {
        return;
      }

      const { error } =
        await db.rpc(
          "remove_group_member",
          {
            p_group_id: groupId,
            p_user_id: userId
          }
        );

      if (error) {
        console.error(
          "ZakiChat remove member:",
          error
        );

        showToast(
          error.message ||
          "Member could not be removed."
        );

        return;
      }

      showToast(
        `${name} was removed.`
      );

      await loadGroup();
      await loadProfilesForAdding();
    }

    async function changeRole(userId, role) {
      const { error } =
        await db.rpc(
          "set_group_member_role",
          {
            p_group_id: groupId,
            p_user_id: userId,
            p_role: role
          }
        );

      if (error) {
        console.error(
          "ZakiChat change role:",
          error
        );

        showToast(
          error.message ||
          "Member role could not be changed."
        );

        return;
      }

      showToast(
        role === "admin"
          ? "Member promoted to admin."
          : "Admin demoted to member."
      );

      await loadGroup();
    }

    async function leaveGroup() {
      if (currentUserRole === "owner") {
        showToast(
          "Transfer ownership before leaving."
        );
        return;
      }

      if (
        !window.confirm(
          "Leave this group?"
        )
      ) {
        return;
      }

      setBusy(
        els.leaveButton,
        true,
        "Leaving..."
      );

      const { error } =
        await db.rpc(
          "leave_group",
          {
            p_group_id: groupId
          }
        );

      setBusy(
        els.leaveButton,
        false
      );

      if (error) {
        console.error(
          "ZakiChat leave group:",
          error
        );

        showToast(
          error.message ||
          "Could not leave the group."
        );

        return;
      }

      window.location.href =
        "groups.html";
    }

    function subscribeRealtime() {
      window.ZakiRealtime.subscribe(
        `group-members:${groupId}`,
        "group_members",
        `group_id=eq.${groupId}`,
        async () => {
          await loadGroup();
        },
        "*"
      );

      window.ZakiRealtime.subscribe(
        `group-details:${groupId}`,
        "groups",
        `id=eq.${groupId}`,
        async () => {
          await loadGroup();
        },
        "*"
      );

      window.ZakiRealtime.subscribeToMessages(
        currentGroup.conversation_id,
        async () => {
          await loadMessages();
        }
      );
    }

    els.infoButton.addEventListener(
      "click",
      openInfo
    );

    els.menu.addEventListener(
      "click",
      openInfo
    );

    els.close.addEventListener(
      "click",
      closeInfo
    );

    els.overlay.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          els.overlay
        ) {
          closeInfo();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape" &&
          !els.overlay.hidden
        ) {
          closeInfo();
        }
      }
    );

    els.composer.addEventListener(
      "submit",
      async event => {
        event.preventDefault();
        await sendMessage();
      }
    );

    els.input.addEventListener(
      "keydown",
      async event => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          await sendMessage();
        }
      }
    );

    els.attach.addEventListener(
      "click",
      () => {
        showToast(
          "Group attachments will be connected next."
        );
      }
    );

    els.editForm.addEventListener(
      "submit",
      saveGroupDetails
    );

    els.editCancel.addEventListener(
      "click",
      () => refreshInfoUI()
    );

    els.addButton.addEventListener(
      "click",
      async () => {
        els.addSection.hidden =
          !els.addSection.hidden;

        if (!els.addSection.hidden) {
          await loadProfilesForAdding();
          els.memberSearch.focus();
        }
      }
    );

    els.memberSearch.addEventListener(
      "input",
      event => {
        renderUserResults(
          event.target.value
        );
      }
    );

    els.leaveButton.addEventListener(
      "click",
      leaveGroup
    );

    const {
      data: {
        user
      }
    } =
      await db.auth.getUser();

    if (!user) {
      window.location.href =
        "login.html";

      return;
    }

    currentUser = user;

    const loaded =
      await loadGroup();

    if (!loaded) {
      return;
    }

    await loadMessages();

    await window.ZakiMessages.markRead(
      currentGroup.conversation_id,
      currentUser.id
    );

    subscribeRealtime();

    console.log(
      "ZakiChat group management ready."
    );
  });
})();
