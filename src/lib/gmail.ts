import MailComposer from "nodemailer/lib/mail-composer";
import { google } from "googleapis";

function getOAuth2Client() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } =
    process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error(
      "未設定 Gmail OAuth2 環境變數（GMAIL_CLIENT_ID、GMAIL_CLIENT_SECRET、GMAIL_REFRESH_TOKEN）",
    );
  }
  const client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return client;
}

export async function sendViaGmail(params: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  icsContent?: string;
}) {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  const composer = new MailComposer({
    from: params.from,
    to: params.to.join(", "),
    subject: params.subject,
    text: params.text,
    html: params.html,
    ...(params.icsContent
      ? {
          icalEvent: {
            method: "REQUEST",
            filename: "meeting.ics",
            content: params.icsContent,
          },
        }
      : {}),
  });

  const rawBuffer = await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });

  const raw = rawBuffer.toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}
