/* ========================================
   Login / Register View
   ======================================== */

const LoginView = {
  render(container) {
    container.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card fade-in">
          <h1 class="auth-title">The Ledger</h1>
          <p class="auth-subtitle">Couples Accountability</p>

          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">Sign In</button>
            <button class="auth-tab" data-tab="register">Register</button>
          </div>

          <form id="loginForm">
            <div class="form-group">
              <label class="form-label" for="loginEmail">Email</label>
              <input class="form-input" type="email" id="loginEmail" placeholder="your@email.com" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="loginPassword">Password</label>
              <input class="form-input" type="password" id="loginPassword" placeholder="Enter password" required>
            </div>
            <div id="loginError" class="form-error" style="display:none"></div>
            <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; margin-top:0.5rem;">
              Sign In
            </button>
          </form>

          <form id="registerForm" style="display:none">
            <div class="form-group">
              <label class="form-label" for="regName">Name</label>
              <input class="form-input" type="text" id="regName" placeholder="Your name" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="regEmail">Email</label>
              <input class="form-input" type="email" id="regEmail" placeholder="your@email.com" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="regPassword">Password</label>
              <input class="form-input" type="password" id="regPassword" placeholder="Min 6 characters" required minlength="6">
            </div>
            <div id="registerError" class="form-error" style="display:none"></div>
            <button type="submit" class="btn btn-gold" style="width:100%; justify-content:center; margin-top:0.5rem;">
              Create Account
            </button>
          </form>
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        container.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('loginForm').style.display = target === 'login' ? '' : 'none';
        document.getElementById('registerForm').style.display = target === 'register' ? '' : 'none';
      });
    });

    // Login submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('loginError');
      errEl.style.display = 'none';

      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      const res = await App.api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.success) {
        App.login(res.data.token, res.data.user);
      } else {
        errEl.textContent = res.error || 'Login failed';
        errEl.style.display = '';
      }
    });

    // Register submit
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('registerError');
      errEl.style.display = 'none';

      const name = document.getElementById('regName').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPassword').value;

      const res = await App.api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      if (res.success) {
        App.login(res.data.token, res.data.user);
      } else {
        errEl.textContent = res.error || 'Registration failed';
        errEl.style.display = '';
      }
    });
  },
};
