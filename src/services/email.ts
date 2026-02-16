export class EmailService {
  private fromEmail = 'accountability@iancash.me';

  constructor(private apiKey: string) {}

  async sendProposalNotification(to: string, proposerName: string, title: string, penalty: number): Promise<void> {
    await this.send(
      to,
      `New proposal from ${proposerName}: ${title}`,
      `<h2>New Task Proposed</h2>
       <p><strong>${proposerName}</strong> has proposed a task for you:</p>
       <p><strong>${title}</strong></p>
       <p>Penalty: <strong>$${penalty.toFixed(2)}</strong></p>
       <p>Log in to accept or reject this proposal.</p>`
    );
  }

  async sendStatusNotification(to: string, userName: string, title: string, status: string): Promise<void> {
    await this.send(
      to,
      `${userName} ${status} your proposal: ${title}`,
      `<h2>Proposal ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
       <p><strong>${userName}</strong> has <strong>${status}</strong> your proposal: <strong>${title}</strong></p>`
    );
  }

  async sendCompletionNotification(to: string, completerName: string, title: string): Promise<void> {
    await this.send(
      to,
      `${completerName} completed: ${title} — Please verify`,
      `<h2>Task Completed</h2>
       <p><strong>${completerName}</strong> says they completed: <strong>${title}</strong></p>
       <p>Log in to verify or mark as failed.</p>`
    );
  }

  async sendFailureNotification(to: string, title: string, penalty: number): Promise<void> {
    await this.send(
      to,
      `Task failed: ${title} — $${penalty.toFixed(2)} penalty`,
      `<h2>Task Failed</h2>
       <p>The task <strong>${title}</strong> has been marked as failed.</p>
       <p>A penalty of <strong>$${penalty.toFixed(2)}</strong> has been recorded.</p>`
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey || this.apiKey.startsWith('re_your_')) return;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to,
          subject,
          html,
        }),
      });
    } catch (e) {
      console.error('Email send failed:', e);
    }
  }
}
