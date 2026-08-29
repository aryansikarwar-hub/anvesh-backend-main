import { type EmailMessage } from './mailer';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#2b241d">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#7a3e12">Anvesh</div>
    <div style="font-size:13px;color:#8a7a6b;margin-bottom:24px">Discover the places maps don't tell you about.</div>
    <div style="background:#fff;border:1px solid #ece3d6;border-radius:14px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:19px">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="font-size:12px;color:#a5978a;margin-top:20px">If you did not expect this email you can ignore it.</div>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#7a3e12;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;display:inline-block;font-weight:600">${label}</a></p>
  <p style="font-size:12px;color:#8a7a6b;word-break:break-all">${href}</p>`;
}

export function verifyEmailTemplate(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Confirm your Anvesh email',
    html: layout(
      `Welcome, ${name}`,
      `<p style="margin:0;line-height:1.6">Confirm this address and your account is ready.</p>${button(url, 'Confirm email')}`,
    ),
    text: `Welcome to Anvesh, ${name}. Confirm your email: ${url}`,
  };
}

export function resetPasswordTemplate(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Reset your Anvesh password',
    html: layout(
      'Reset your password',
      `<p style="margin:0;line-height:1.6">Hello ${name}, use the link below to set a new password. It expires shortly.</p>${button(url, 'Set a new password')}`,
    ),
    text: `Reset your Anvesh password: ${url}`,
  };
}

export function adminInviteTemplate(to: string, role: string, url: string): EmailMessage {
  return {
    to,
    subject: 'You have been invited to the Anvesh admin portal',
    html: layout(
      'Admin invitation',
      `<p style="margin:0;line-height:1.6">You have been invited as <strong>${role}</strong>. You will set a password and enrol an authenticator app.</p>${button(url, 'Accept invitation')}`,
    ),
    text: `Accept your Anvesh admin invitation (${role}): ${url}`,
  };
}

export function bookingConfirmedTemplate(
  to: string,
  data: { name: string; code: string; title: string; when: string; url: string },
): EmailMessage {
  return {
    to,
    subject: `Booking confirmed — ${data.title}`,
    html: layout(
      'Your booking is confirmed',
      `<p style="margin:0;line-height:1.6">${data.name}, your booking <strong>${data.code}</strong> for <strong>${data.title}</strong> on ${data.when} is confirmed.</p>${button(data.url, 'View booking')}`,
    ),
    text: `Booking ${data.code} confirmed: ${data.title} on ${data.when}. ${data.url}`,
  };
}

export function bookingCancelledTemplate(
  to: string,
  data: { name: string; code: string; title: string; reason: string },
): EmailMessage {
  return {
    to,
    subject: `Booking cancelled — ${data.title}`,
    html: layout(
      'Booking cancelled',
      `<p style="margin:0;line-height:1.6">${data.name}, booking <strong>${data.code}</strong> for ${data.title} has been cancelled.</p><p style="color:#8a7a6b">${data.reason}</p>`,
    ),
    text: `Booking ${data.code} for ${data.title} was cancelled. ${data.reason}`,
  };
}
