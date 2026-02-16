/* ========================================
   Ledger View
   ======================================== */

const LedgerView = {
  async render(container) {
    container.innerHTML = '<p class="loading-text">Reading the books...</p>';

    const [ledgerRes, balanceRes] = await Promise.all([
      App.api('/ledger'),
      App.api('/ledger/balance'),
    ]);

    const entries = ledgerRes.data?.entries || [];
    const balance = balanceRes.data || { balance: 0, summary: 'All settled up!' };
    const absBalance = Math.abs(balance.balance);

    container.innerHTML = `
      <div class="fade-in stagger-1">
        <div class="page-header">
          <h1>The Ledger</h1>
        </div>
      </div>

      <div class="fade-in stagger-2">
        <div class="balance-card">
          <div class="balance-label">Net Balance</div>
          <div class="balance-amount">${balance.balance === 0 ? '$0.00' : (balance.balance > 0 ? '-' : '') + '$' + absBalance.toFixed(2)}</div>
          <div class="balance-summary">${App.escapeHtml(balance.summary)}</div>
        </div>
      </div>

      <div class="fade-in stagger-3">
        ${entries.length > 0 ? `
          <div class="section-header">
            <h2>Transaction History</h2>
            <span class="section-count">${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}</span>
          </div>

          <div class="card" style="padding: 0; overflow: hidden;">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map(e => {
                  const isDebit = e.from_user === App.user.id;
                  return `
                    <tr style="cursor: pointer;" data-proposal-id="${e.proposal_id}">
                      <td>${App.formatDate(e.created_at)}</td>
                      <td>${App.escapeHtml(e.reason)}</td>
                      <td style="text-align: right;">
                        <span class="${isDebit ? 'amount-debit' : 'amount-credit'}">
                          ${isDebit ? '-' : '+'}$${e.amount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">
            <div class="section-ornament">&#x2766;</div>
            <p>No transactions recorded yet.</p>
            <p>Entries appear here when tasks are marked as failed.</p>
          </div>
        `}
      </div>
    `;

    // Click rows to navigate to proposal
    container.querySelectorAll('[data-proposal-id]').forEach(row => {
      row.addEventListener('click', () => {
        App.navigate('proposal/' + row.dataset.proposalId);
      });
    });
  },
};
