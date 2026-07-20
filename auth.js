// Auth: login / signup screen + session gate

function renderAuthScreen(mode = "login") {
  const el = document.getElementById("screen-auth");
  el.innerHTML = `
    <div class="body-pad" style="padding-top:calc(60px + env(safe-area-inset-top));">
      <div style="text-align:center; margin-bottom:28px;">
        <div class="seal" style="margin:0 auto 14px; width:44px; height:44px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke="#141F38" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h1 style="font-size:26px;">Atlas</h1>
        <div class="tag" style="color:var(--muted); margin-top:4px;">Your vehicle's history, in your hands</div>
      </div>

      <div class="mode-toggle">
        <button id="auth-mode-login" class="${mode === "login" ? "active" : ""}" onclick="renderAuthScreen('login')">Log in</button>
        <button id="auth-mode-signup" class="${mode === "signup" ? "active" : ""}" onclick="renderAuthScreen('signup')">Sign up</button>
      </div>

      <div class="field" style="margin-top:16px;"><label>Email</label><input type="email" id="auth-email" placeholder="you@example.com"></div>
      <div class="field"><label>Password</label><input type="password" id="auth-password" placeholder="••••••••"></div>

      <div id="authError" style="display:none; color:var(--coral); font-size:13px; margin-bottom:10px;"></div>

      <button class="wiz-next" style="width:100%; margin-top:6px;" id="authSubmitBtn" onclick="submitAuth('${mode}')">
        ${mode === "login" ? "Log in" : "Create account"}
      </button>

      ${mode === "signup" ? `<div class="hint" style="text-align:center; margin-top:14px;">You may need to confirm your email before logging in, depending on the project's settings.</div>` : ""}
    </div>
  `;
}

async function submitAuth(mode) {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const errBox = document.getElementById("authError");
  const btn = document.getElementById("authSubmitBtn");
  errBox.style.display = "none";

  if (!email || !password) {
    errBox.textContent = "Enter both email and password.";
    errBox.style.display = "block";
    return;
  }

  btn.textContent = "Please wait…";
  btn.disabled = true;

  const { data, error } = mode === "login"
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });

  btn.disabled = false;
  btn.textContent = mode === "login" ? "Log in" : "Create account";

  if (error) {
    errBox.textContent = error.message;
    errBox.style.display = "block";
    return;
  }

  if (mode === "signup" && !data.session) {
    errBox.style.display = "block";
    errBox.style.color = "var(--teal)";
    errBox.textContent = "Account created — check your email to confirm, then log in.";
    return;
  }

  enterApp();
}

async function signOut() {
  await sb.auth.signOut();
  document.getElementById("screen-detail").classList.remove("active");
  document.getElementById("screen-onboarding").classList.remove("active");
  document.getElementById("screen-search").classList.remove("active");
  document.getElementById("screen-auth").classList.add("active");
  renderAuthScreen("login");
}

async function checkSessionAndBoot() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    enterApp();
  } else {
    document.getElementById("screen-auth").classList.add("active");
    renderAuthScreen("login");
  }
}

function enterApp() {
  document.getElementById("screen-auth").classList.remove("active");
  document.getElementById("screen-search").classList.add("active");
  renderRecentList();
}
