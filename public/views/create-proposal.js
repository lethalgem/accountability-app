/* ========================================
   Create Proposal View
   ======================================== */

const CreateProposalView = {
  async render(container) {
    // Default deadline: 3 days from now
    const defaultDeadline = new Date(Date.now() + 3 * 86400 * 1000);
    const deadlineStr = defaultDeadline.toISOString().slice(0, 16);

    container.innerHTML = `
      <div class="fade-in stagger-1">
        <div class="page-header">
          <h1>New Proposal</h1>
        </div>
      </div>

      <div class="card fade-in stagger-2" style="max-width: 600px;">
        <form id="proposalForm">
          <div class="form-group">
            <label class="form-label" for="propTitle">Task Title</label>
            <input class="form-input" type="text" id="propTitle" placeholder="e.g. Clean the kitchen" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="propDescription">Description (optional)</label>
            <textarea class="form-input" id="propDescription" placeholder="Any additional details..." rows="3"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="propDeadline">Deadline</label>
              <input class="form-input" type="datetime-local" id="propDeadline" value="${deadlineStr}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="propPenalty">Penalty ($)</label>
              <input class="form-input" type="number" id="propPenalty" min="0" step="0.50" value="5.00" required>
            </div>
          </div>

          <div id="proposalError" class="form-error" style="display:none"></div>

          <div class="btn-group" style="margin-top: 1.5rem;">
            <button type="submit" class="btn btn-gold" id="submitBtn">Propose</button>
            <a href="#/dashboard" class="btn btn-ghost">Cancel</a>
          </div>
        </form>
      </div>
    `;

    document.getElementById('proposalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('proposalError');
      const submitBtn = document.getElementById('submitBtn');
      errEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Proposing...';

      const title = document.getElementById('propTitle').value;
      const description = document.getElementById('propDescription').value || undefined;
      const deadline = document.getElementById('propDeadline').value;
      const penalty_amount = parseFloat(document.getElementById('propPenalty').value);

      const res = await App.api('/proposals', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          deadline: new Date(deadline).toISOString(),
          penalty_amount,
        }),
      });

      if (res.success) {
        App.navigate('proposal/' + res.data.proposal.id);
      } else {
        errEl.textContent = res.error || 'Failed to create proposal';
        errEl.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Propose';
      }
    });
  },
};
