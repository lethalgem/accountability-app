/* ========================================
   Dashboard View
   ======================================== */

const DashboardView = {
  async render(container) {
    container.innerHTML = '<p class="loading-text">Opening the ledger...</p>';

    // Fetch data in parallel
    const [proposalsRes, balanceRes] = await Promise.all([
      App.api('/proposals'),
      App.api('/ledger/balance'),
    ]);

    const proposals = proposalsRes.data?.proposals || [];
    const balance = balanceRes.data || { balance: 0, summary: 'All settled up!' };

    const needsVerification = proposals.filter(p => p.status === 'completed' && p.created_by === App.user.id);
    const pendingResponse = proposals.filter(p => p.status === 'pending' && p.assigned_to === App.user.id);
    const sentPending = proposals.filter(p => p.status === 'pending' && p.created_by === App.user.id);
    const active = proposals.filter(p => p.status === 'accepted');
    const awaitingVerification = proposals.filter(p => p.status === 'completed' && p.assigned_to === App.user.id);
    const recent = proposals.filter(p => ['verified', 'failed', 'rejected'].includes(p.status)).slice(0, 5);

    const hasItems = needsVerification.length + pendingResponse.length + sentPending.length + active.length + awaitingVerification.length > 0;
    const absBalance = Math.abs(balance.balance);

    container.innerHTML = `
      <div class="fade-in stagger-1">
        <div class="balance-card">
          <div class="balance-label">Current Balance</div>
          <div class="balance-amount">${balance.balance === 0 ? '$0.00' : (balance.balance > 0 ? '-' : '') + '$' + absBalance.toFixed(2)}</div>
          <div class="balance-summary">${App.escapeHtml(balance.summary)}</div>
        </div>
      </div>

      ${needsVerification.length > 0 ? `
        <div class="fade-in stagger-2">
          <div class="section-header">
            <h2>Awaiting Your Verification</h2>
            <span class="section-count">${needsVerification.length} task${needsVerification.length !== 1 ? 's' : ''}</span>
          </div>
          ${needsVerification.map(p => this.renderProposalCard(p)).join('')}
        </div>
      ` : ''}

      ${pendingResponse.length > 0 ? `
        <div class="fade-in stagger-2">
          <div class="section-header">
            <h2>Pending Your Response</h2>
            <span class="section-count">${pendingResponse.length} proposal${pendingResponse.length !== 1 ? 's' : ''}</span>
          </div>
          ${pendingResponse.map(p => this.renderProposalCard(p)).join('')}
        </div>
      ` : ''}

      ${sentPending.length > 0 ? `
        <div class="fade-in stagger-3">
          <div class="section-header">
            <h2>Awaiting Partner's Response</h2>
            <span class="section-count">${sentPending.length} proposal${sentPending.length !== 1 ? 's' : ''}</span>
          </div>
          ${sentPending.map(p => this.renderProposalCard(p)).join('')}
        </div>
      ` : ''}

      ${active.length > 0 ? `
        <div class="fade-in stagger-3">
          <div class="section-header">
            <h2>Active Tasks</h2>
            <span class="section-count">${active.length} task${active.length !== 1 ? 's' : ''}</span>
          </div>
          ${active.map(p => this.renderProposalCard(p)).join('')}
        </div>
      ` : ''}

      ${awaitingVerification.length > 0 ? `
        <div class="fade-in stagger-4">
          <div class="section-header">
            <h2>Submitted for Verification</h2>
            <span class="section-count">${awaitingVerification.length} task${awaitingVerification.length !== 1 ? 's' : ''}</span>
          </div>
          ${awaitingVerification.map(p => this.renderProposalCard(p)).join('')}
        </div>
      ` : ''}

      ${!hasItems ? `
        <div class="empty-state fade-in stagger-2">
          <div class="section-ornament">&#x2766;</div>
          <p>No active tasks or pending proposals.</p>
          <a href="#/new-proposal" class="btn btn-gold">Propose a Task</a>
        </div>
      ` : ''}

      ${recent.length > 0 ? `
        <div class="fade-in stagger-5">
          <hr class="ornamental-rule">
          <div class="section-header">
            <h2>Recent History</h2>
          </div>
          ${recent.map(p => this.renderProposalCard(p, 'history')).join('')}
        </div>
      ` : ''}
    `;

    // Add click handlers to cards
    container.querySelectorAll('[data-proposal-id]').forEach(card => {
      card.addEventListener('click', () => {
        App.navigate('proposal/' + card.dataset.proposalId);
      });
    });
  },

  renderProposalCard(p) {
    const isAssignedToMe = p.assigned_to === App.user.id;
    const role = isAssignedToMe ? 'You' : App.user.name;
    const deadlineStr = App.timeUntil(p.deadline);
    const deadlineCls = App.deadlineClass(p.deadline);

    return `
      <div class="card card-clickable" data-proposal-id="${p.id}">
        <div class="card-header">
          <span class="card-title">${App.escapeHtml(p.title)}</span>
          <span class="stamp stamp-${p.status}">${p.status}</span>
        </div>
        <div class="meta">
          <span class="meta-item">
            <span class="meta-label">Penalty</span>
            <span class="penalty-amount">$${p.penalty_amount.toFixed(2)}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">Deadline</span>
            <span class="deadline ${deadlineCls}">${p.status === 'accepted' ? deadlineStr : App.formatDate(p.deadline)}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">${isAssignedToMe ? 'Assigned to' : 'Proposed by'}</span>
            <span>${isAssignedToMe ? 'You' : 'Partner'}</span>
          </span>
        </div>
      </div>
    `;
  },
};
