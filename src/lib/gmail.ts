import nodemailer from "nodemailer";
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

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const compiler = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  } as any);

  const info: { message: Buffer } = (await compiler.sendMail({
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
  })) as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const raw = info.message.toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}
