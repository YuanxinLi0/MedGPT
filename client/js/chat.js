const query = (obj) =>
  Object.keys(obj)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
const colorThemes = document.querySelectorAll('[name="theme"]');
const markdown = window.markdownit();
const message_box = document.getElementById(`messages`);
const message_input = document.getElementById(`message-input`);
const box_conversations = document.querySelector(`.top`);
const spinner = box_conversations.querySelector(".spinner");
const stop_generating = document.querySelector(`.stop_generating`);
const send_button = document.querySelector(`#send-button`);
let prompt_lock = false;

hljs.addPlugin(new CopyButtonPlugin());

function resizeTextarea(textarea) {
  textarea.style.height = '20px';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

const format = (text) => {
  return text.replace(/(?:\r\n|\r|\n)/g, "<br>");
};

message_input.addEventListener("blur", () => {
  window.scrollTo(0, 0);
});

message_input.addEventListener("focus", () => {
  document.documentElement.scrollTop = document.documentElement.scrollHeight;
});

const delete_conversations = async () => {
  localStorage.clear();
  await new_conversation();
};

const handle_ask = async () => {
  message_input.style.height = `20px`;
  message_input.focus();

  window.scrollTo(0, 0);
  let message = message_input.value;

  if (message.length > 0) {
    message_input.value = ``;
    await ask_gpt(message);
  }
};

const remove_cancel_button = async () => {
  stop_generating.classList.add(`stop_generating-hiding`);

  setTimeout(() => {
    stop_generating.classList.remove(`stop_generating-hiding`);
    stop_generating.classList.add(`stop_generating-hidden`);
  }, 300);
};

const ask_gpt = async (message) => {
  try {
    // 清空输入框
    message_input.value = '';
    message_input.innerHTML = '';
    message_input.innerText = '';

    add_conversation(window.conversation_id, message.substr(0, 20));
    window.controller = new AbortController();

    const jailbreak = document.getElementById("jailbreak")?.value || "default_value";
    const model = document.getElementById("model")?.value || "default_model";
    const internet_access = document.getElementById("switch")?.checked || false;
    prompt_lock = true;
    window.token = message_id();

    stop_generating.classList.remove('stop_generating-hidden');

    message_box.innerHTML += `
      <div class="message message-user">
        <div class="user">
          ${user_image}
          <i class="fa-regular fa-phone-arrow-up-right"></i>
        </div>
        <div class="content" id="user_${window.token}">
          ${format(message)}
        </div>
      </div>
    `;

    message_box.scrollTop = message_box.scrollHeight;
    await new Promise((r) => setTimeout(r, 500));

    // 服务器响应的代码部分
    message_box.innerHTML += `
      <div class="message message-gpt">  
        <div class="user">
          ${gpt_image} <i class="fa-regular fa-phone-arrow-down-left"></i>
        </div>
        <div class="content" id="gpt_${window.token}">
          <div id="cursor"></div>
        </div>
      </div>
    `;

    message_box.scrollTop = message_box.scrollHeight;

    const response = await fetch('http://172.16.29.157:8000/backend-api/v2/conversation', {
      method: 'POST',
      signal: window.controller.signal,
      headers: {
        'content-type': 'application/json',
        'accept': 'text/event-stream',
      },
      body: JSON.stringify({
        jailbreak: jailbreak,
        model: model,
        meta: {
          content: {
            internet_access: internet_access,
            conversation: await get_conversation(window.conversation_id),
            parts: [{ content: message, role: 'user' }],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误,状态码: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      text += chunk;

      // 实时更新内容
      document.getElementById(`gpt_${window.token}`).innerHTML = markdown.render(text);
      message_box.scrollTo({ top: message_box.scrollHeight, behavior: 'auto' });
    } while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      text += chunk;

      // 实时更新内容
      document.getElementById(`gpt_${window.token}`).innerHTML = markdown.render(text);
      message_box.scrollTo({ top: message_box.scrollHeight, behavior: 'auto' });
    }

    add_message(window.conversation_id, 'user', message);
    add_message(window.conversation_id, 'assistant', text);

    message_box.scrollTop = message_box.scrollHeight;
    await remove_cancel_button();
    prompt_lock = false;

    await load_conversations(20, 0);
  } catch (e) {
    console.error("Error in ask_gpt function:", e);
    add_message(window.conversation_id, "user", message);
    await remove_cancel_button();
    prompt_lock = false;

    let cursorDiv = document.getElementById('cursor');
    if (cursorDiv) cursorDiv.parentNode.removeChild(cursorDiv);

    if (e.name != 'AbortError') {
      let error_message = 'Oops! Something went wrong, please try again / reload.';
      document.getElementById(`gpt_${window.token}`).innerHTML = error_message;
      add_message(window.conversation_id, 'assistant', error_message);
    } else {
      document.getElementById(`gpt_${window.token}`).innerHTML += ' [aborted]';
      add_message(window.conversation_id, 'assistant', text + ' [aborted]');
    }
  }
};



const clear_conversations = async () => {
  const elements = box_conversations.childNodes;
  let index = elements.length;

  if (index > 0) {
    while (index--) {
      const element = elements[index];
      if (
        element.nodeType === Node.ELEMENT_NODE &&
        element.tagName.toLowerCase() !== `button`
      ) {
        box_conversations.removeChild(element);
      }
    }
  }
};

const clear_conversation = async () => {
  let messages = message_box.getElementsByTagName(`div`);

  while (messages.length > 0) {
    message_box.removeChild(messages[0]);
  }
};

const show_option = async (conversation_id) => {
  const conv = document.getElementById(`conv-${conversation_id}`);
  const yes = document.getElementById(`yes-${conversation_id}`);
  const not = document.getElementById(`not-${conversation_id}`);

  if (conv && yes && not) {
    conv.style.display = "none";
    yes.style.display = "block";
    not.style.display = "block";
  }
};

const hide_option = async (conversation_id) => {
  const conv = document.getElementById(`conv-${conversation_id}`);
  const yes = document.getElementById(`yes-${conversation_id}`);
  const not = document.getElementById(`not-${conversation_id}`);

  if (conv && yes && not) {
    conv.style.display = "block";
    yes.style.display = "none";
    not.style.display = "none";
  }
};

const delete_conversation = async (conversation_id) => {
  localStorage.removeItem(`conversation:${conversation_id}`);

  const conversation = document.getElementById(`convo-${conversation_id}`);
  if (conversation) {
    conversation.remove();
  }

  if (window.conversation_id == conversation_id) {
    await new_conversation();
  }

  await load_conversations(20, 0, true);
};

const set_conversation = async (conversation_id) => {
  history.pushState({}, null, `/chat/${conversation_id}`);
  window.conversation_id = conversation_id;

  await clear_conversation();
  await load_conversation(conversation_id);
  await load_conversations(20, 0, true);
};

const new_conversation = async () => {
  history.pushState({}, null, `/chat/`);
  window.conversation_id = uuid();

  await clear_conversation();
  await load_conversations(20, 0, true);
};

const load_conversation = async (conversation_id) => {
  let conversation = await JSON.parse(
    localStorage.getItem(`conversation:${conversation_id}`)
  );
  console.log(conversation, conversation_id);

  if (conversation) {
    for (const item of conversation.items) {
      message_box.innerHTML += `
        <div class="message">
          <div class="user">
            ${item.role == "assistant" ? gpt_image : user_image}
            ${item.role == "assistant"
          ? `<i class="fa-regular fa-phone-arrow-down-left"></i>`
          : `<i class="fa-regular fa-phone-arrow-up-right"></i>`
        }
          </div>
          <div class="content">
            ${item.role == "assistant"
          ? markdown.render(item.content)
          : item.content
        }
          </div>
        </div>
      `;
    }

    document.querySelectorAll(`code`).forEach((el) => {
      hljs.highlightElement(el);
    });

    message_box.scrollTo({ top: message_box.scrollHeight, behavior: "smooth" });

    setTimeout(() => {
      message_box.scrollTop = message_box.scrollHeight;
    }, 500);
  }
};

const get_conversation = async (conversation_id) => {
  let conversation = await JSON.parse(
    localStorage.getItem(`conversation:${conversation_id}`)
  );
  return conversation ? conversation.items : [];
};

const add_conversation = async (conversation_id, title) => {
  if (localStorage.getItem(`conversation:${conversation_id}`) == null) {
    localStorage.setItem(
      `conversation:${conversation_id}`,
      JSON.stringify({
        id: conversation_id,
        title: title,
        items: [],
      })
    );
  }
};

const add_message = async (conversation_id, role, content) => {
  let before_adding = JSON.parse(
    localStorage.getItem(`conversation:${conversation_id}`)
  );

  if (before_adding) {
    before_adding.items.push({
      role: role,
      content: content,
    });

    localStorage.setItem(
      `conversation:${conversation_id}`,
      JSON.stringify(before_adding)
    ); // update conversation
  }
};

const load_conversations = async (limit, offset, loader) => {
  let conversations = [];
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith("conversation:")) {
      let conversation = localStorage.getItem(localStorage.key(i));
      conversations.push(JSON.parse(conversation));
    }
  }

  await clear_conversations();

  for (const conversation of conversations) {
    box_conversations.innerHTML += `
    <div class="convo" id="convo-${conversation.id}">
      <div class="left" onclick="set_conversation('${conversation.id}')">
        <i class="fa-regular fa-comments"></i>
        <span class="convo-title">${conversation.title}</span>
      </div>
      <i onclick="show_option('${conversation.id}')" class="fa-regular fa-trash" id="conv-${conversation.id}"></i>
      <i onclick="delete_conversation('${conversation.id}')" class="fa-regular fa-check" id="yes-${conversation.id}" style="display:none;"></i>
      <i onclick="hide_option('${conversation.id}')" class="fa-regular fa-x" id="not-${conversation.id}" style="display:none;"></i>
    </div>
    `;
  }

  document.querySelectorAll(`code`).forEach((el) => {
    hljs.highlightElement(el);
  });
};

document.getElementById(`cancelButton`)?.addEventListener(`click`, async () => {
  window.controller.abort();
  console.log(`aborted ${window.conversation_id}`);
});

function h2a(str1) {
  var hex = str1.toString();
  var str = "";

  for (var n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }

  return str;
}

const uuid = () => {
  return `xxxxxxxx-xxxx-4xxx-yxxx-${Date.now().toString(16)}`.replace(
    /[xy]/g,
    function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
  );
};

const message_id = () => {
  const random_bytes = (Math.floor(Math.random() * 1338377565) + 2956589730).toString(2);
  const unix = Math.floor(Date.now() / 1000).toString(2);

  return BigInt(`0b${unix}${random_bytes}`).toString();
};

window.onload = async () => {
  await load_settings_localstorage();

  let conversations = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith("conversation:")) {
      conversations += 1;
    }
  }

  if (conversations == 0) localStorage.clear();

  await setTimeout(() => {
    load_conversations(20, 0);
  }, 1);

  if (!window.location.href.endsWith(`#`)) {
    if (/\/chat\/.+/.test(window.location.href)) {
      await load_conversation(window.conversation_id);
    }
  }

  message_input?.addEventListener(`keydown`, async (evt) => {
    if (prompt_lock) return;
    if (evt.keyCode === 13 && !evt.shiftKey) {
      evt.preventDefault();
      console.log('pressed enter');
      await handle_ask();
    } else {
      message_input.style.removeProperty("height");
      message_input.style.height = message_input.scrollHeight + 4 + "px";
    }
  });

  send_button?.addEventListener(`click`, async () => {
    console.log("clicked send");
    if (prompt_lock) return;
    await handle_ask();
  });

  await register_settings_localstorage();
};

document.querySelector(".mobile-sidebar")?.addEventListener("click", (event) => {
  const sidebar = document.querySelector(".conversations");

  if (sidebar.classList.contains("shown")) {
    sidebar.classList.remove("shown");
    event.target.classList.remove("rotated");
  } else {
    sidebar.classList.add("shown");
    event.target.classList.add("rotated");
  }

  window.scrollTo(0, 0);
});

const register_settings_localstorage = async () => {
  const settings_ids = ["switch", "model", "jailbreak"];
  const settings_elements = settings_ids.map((id) => document.getElementById(id)).filter(element => element !== null);
  settings_elements.map((element) =>
    element.addEventListener(`change`, async (event) => {
      switch (event.target.type) {
        case "checkbox":
          localStorage.setItem(event.target.id, event.target.checked);
          break;
        case "select-one":
          localStorage.setItem(event.target.id, event.target.selectedIndex);
          break;
        default:
          console.warn("Unresolved element type");
      }
    })
  );
};

const load_settings_localstorage = async () => {
  const settings_ids = ["switch", "model", "jailbreak"];
  const settings_elements = settings_ids.map((id) => document.getElementById(id)).filter(element => element !== null);
  settings_elements.map((element) => {
    if (localStorage.getItem(element.id)) {
      switch (element.type) {
        case "checkbox":
          element.checked = localStorage.getItem(element.id) === "true";
          break;
        case "select-one":
          element.selectedIndex = parseInt(localStorage.getItem(element.id));
          break;
        default:
          console.warn("Unresolved element type");
      }
    }
  });
};

// Theme storage for recurring viewers
const storeTheme = function (theme) {
  localStorage.setItem("theme", theme);
};

// set theme when visitor returns
const setTheme = function () {
  const activeTheme = localStorage.getItem("theme");
  colorThemes.forEach((themeOption) => {
    if (themeOption.id === activeTheme) {
      themeOption.checked = true;
    }
  });
  document.documentElement.className = activeTheme;
};

colorThemes.forEach((themeOption) => {
  themeOption.addEventListener("click", () => {
    storeTheme(themeOption.id);
    document.documentElement.className = themeOption.id;
  });
});

document.onload = setTheme();



