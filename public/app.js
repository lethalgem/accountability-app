/* ========================================
   THE LEDGER — SPA Router & Utilities
   ======================================== */

const App = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),

  // ---- API ----

  async api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`/api${path}`, { ...options, headers });
    const data = await res.json();
    if (res.status === 401) {
      this.logout();
      return data;
    }
    return data;
  },

  // ---- Auth State ----

  login(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.updateNav(true);
    this.navigate('dashboard');
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.updateNav(false);
    this.navigate('login');
  },

  updateNav(loggedIn) {
    document.getElementById('mainNav').style.display = loggedIn ? '' : 'none';
    document.getElementById('mainFooter').style.display = loggedIn ? '' : 'none';
  },

  // ---- Router ----

  navigate(route) {
    window.location.hash = '#/' + route;
  },

  async handleRoute() {
    const hash = window.location.hash.slice(2) || '';
    const [route, ...params] = hash.split('/');
    const container = document.getElementById('app');

    if (!this.token && route !== 'login') {
      this.navigate('login');
      return;
    }

    if (this.token && route === 'login') {
      this.navigate('dashboard');
      return;
    }

    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === '#/' + route);
    });

    switch (route) {
      case 'login':
        LoginView.render(container);
        break;
      case 'dashboard':
        await DashboardView.render(container);
        break;
      case 'new-proposal':
        await CreateProposalView.render(container);
        break;
      case 'proposal':
        await ProposalDetailView.render(container, params[0]);
        break;
      case 'ledger':
        await LedgerView.render(container);
        break;
      default:
        this.navigate(this.token ? 'dashboard' : 'login');
    }
  },

  // ---- Helpers ----

  formatDate(timestamp) {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },

  formatDateTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  },

  timeUntil(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    if (diff < 0) return 'Overdue';
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.floor(diff / 60);
    return `${mins}m left`;
  },

  deadlineClass(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    if (diff < 0) return 'deadline-urgent';
    if (diff < 86400) return 'deadline-urgent';
    return 'deadline-ok';
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ---- Init ----

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    this.updateNav(!!this.token);
    this.handleRoute();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
