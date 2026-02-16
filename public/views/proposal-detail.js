/* ========================================
   Proposal Detail View
   ======================================== */

const ProposalDetailView = {
  async render(container, id) {
    container.innerHTML = '<p class="loading-text">Loading proposal...</p>';

    const res = await App.api(`/proposals/${id}`);
    if (!res.success) {
      container.innerHTML = `<div class="empty-state"><p>${App.escapeHtml(res.error || 'Proposal not found')}</p><a href="#/dashboard" class="btn btn-ghost">Back to Dashboard</a></div>`;
      return;
    }

    const { proposal: p, creator, assignee } = res.data;
    const isCreator = p.created_by === App.user.id;
    const isAssignee = p.assigned_to === App.user.id;
    const deadlineStr = App.formatDateTime(p.deadline);
    const deadlineCls = App.deadlineClass(p.deadline);
    const timeLeft = App.timeUntil(p.deadline);

    let actions = '';

    if (isAssignee && p.status === 'pending') {
      actions = `
        <div class="btn-group">
          <button class="btn btn-primary" id="acceptBtn">Accept</button>
          <button class="btn btn-danger" id="rejectBtn">Reject</button>
        </div>
      `;
    } else if (isAssignee && p.status === 'accepted') {
      actions = `
        <div class="btn-group">
          <button class="btn btn-gold" id="completeBtn">Mark Complete</button>
        </div>
      `;
    } else if (isCreator && p.status === 'accepted') {
      actions = `
        <div class="btn-group">
          <button class="btn btn-danger" id="failBtn">Mark Failed</button>
        </div>
      `;
    } else if (isCreator && p.status === 'completed') {
      actions = `
        <div class="btn-group">
          <button class="btn btn-primary" id="verifyBtn">Verify Completion</button>
          <button class="btn btn-danger" id="failBtn">Mark Failed</button>
        </div>
      `;
    } else if (isCreator && p.status === 'failed') {
      actions = `
        <div class="btn-group">
          <button class="btn btn-primary" id="overrideBtn">Override — They Did It</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="fade-in stagger-1">
        <div class="page-header">
          <h1>${App.escapeHtml(p.title)}</h1>
          <span class="stamp stamp-${p.status}" style="font-size: 0.85rem; padding: 0.35rem 0.8rem;">${p.status}</span>
        </div>
      </div>

      <div class="fade-in stagger-2">
        <div class="detail-meta">
          <div class="detail-meta-item">
            <span class="detail-meta-label">Proposed By</span>
            <span class="detail-meta-value">${App.escapeHtml(creator?.name || 'Unknown')}</span>
          </div>
          <div class="detail-meta-item">
            <span class="detail-meta-label">Assigned To</span>
            <span class="detail-meta-value">${App.escapeHtml(assignee?.name || 'Unknown')}</span>
          </div>
          <div class="detail-meta-item">
            <span class="detail-meta-label">Penalty</span>
            <span class="detail-meta-value penalty-amount">$${p.penalty_amount.toFixed(2)}</span>
          </div>
          <div class="detail-meta-item">
            <span class="detail-meta-label">Deadline</span>
            <span class="detail-meta-value deadline ${deadlineCls}">${deadlineStr}</span>
          </div>
          ${p.status === 'accepted' ? `
          <div class="detail-meta-item">
            <span class="detail-meta-label">Time Remaining</span>
            <span class="detail-meta-value deadline ${deadlineCls}">${timeLeft}</span>
          </div>
          ` : ''}
          <div class="detail-meta-item">
            <span class="detail-meta-label">Created</span>
            <span class="detail-meta-value">${App.formatDate(p.created_at)}</span>
          </div>
        </div>
      </div>

      ${p.description ? `
        <div class="detail-section fade-in stagger-3">
          <div class="section-header" style="margin-top: 1.5rem;">
            <h2>Description</h2>
          </div>
          <div class="detail-description">${App.escapeHtml(p.description)}</div>
        </div>
      ` : ''}

      ${actions ? `
        <div class="fade-in stagger-4" style="margin-top: 2rem;">
          <hr class="ornamental-rule">
          <div id="actionError" class="form-error" style="display:none"></div>
          ${actions}
        </div>
      ` : ''}

      <div style="margin-top: 2rem;" class="fade-in stagger-5">
        <a href="#/dashboard" class="btn btn-ghost">&larr; Back to Dashboard</a>
      </div>
    `;

    // Bind action buttons
    this.bindActions(id);
  },

  bindActions(id) {
    const actionHandler = async (action, confirmMsg) => {
      if (confirmMsg && !confirm(confirmMsg)) return;
      const errEl = document.getElementById('actionError');
      errEl.style.display = 'none';

      const res = await App.api(`/proposals/${id}/${action}`, { method: 'POST' });
      if (res.success) {
        // Re-render to show updated state
        const container = document.getElementById('app');
        await ProposalDetailView.render(container, id);
      } else {
        errEl.textContent = res.error || `Failed to ${action}`;
        errEl.style.display = '';
      }
    };

    const acceptBtn = document.getElementById('acceptBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const completeBtn = document.getElementById('completeBtn');
    const verifyBtn = document.getElementById('verifyBtn');
    const failBtn = document.getElementById('failBtn');

    if (acceptBtn) acceptBtn.addEventListener('click', () => actionHandler('accept'));
    if (rejectBtn) rejectBtn.addEventListener('click', () => actionHandler('reject', 'Reject this proposal?'));
    if (completeBtn) completeBtn.addEventListener('click', () => actionHandler('complete'));
    if (verifyBtn) verifyBtn.addEventListener('click', () => actionHandler('verify'));
    if (failBtn) failBtn.addEventListener('click', () => actionHandler('fail', 'Mark as failed? This will apply the penalty.'));

    const overrideBtn = document.getElementById('overrideBtn');
    if (overrideBtn) overrideBtn.addEventListener('click', () => actionHandler('override', 'Override failure and reverse the penalty?'));
  },
};
