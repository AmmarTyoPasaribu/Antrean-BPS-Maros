interface GuestBookThankYouEmailParams {
  visitorName: string;
  visitDateLabel: string;
}

// Inline styles only, table-based-ish layout kept simple — this needs to
// render consistently across email clients (Gmail, Outlook, etc.), which
// don't support external stylesheets or most modern CSS.
export function renderGuestBookThankYouEmail({ visitorName, visitDateLabel }: GuestBookThankYouEmailParams): string {
  return `
<!doctype html>
<html lang="id">
  <body style="margin:0; padding:0; background-color:#E6EBF3; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E6EBF3; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #f1f5f9;">

            <!-- Header -->
            <tr>
              <td style="background-color:#0284c7; padding:28px 32px; text-align:center;">
                <div style="font-size:11px; font-weight:bold; letter-spacing:2px; color:#e0f2fe; text-transform:uppercase;">
                  Badan Pusat Statistik
                </div>
                <div style="font-size:15px; font-weight:bold; letter-spacing:1px; color:#ffffff; text-transform:uppercase; margin-top:2px;">
                  Kabupaten Maros
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <div style="width:48px; height:48px; background-color:#ecfdf5; border-radius:16px; text-align:center; line-height:48px; font-size:24px; margin-bottom:16px;">
                  ✅
                </div>
                <h1 style="font-size:18px; color:#0f172a; margin:0 0 12px 0;">Terima Kasih, ${visitorName}!</h1>
                <p style="font-size:14px; color:#334155; line-height:1.7; margin:0 0 12px 0;">
                  Terima kasih telah mengunjungi <strong>Pelayanan Statistik Terpadu (PST) BPS Kabupaten Maros</strong>
                  pada <strong>${visitDateLabel}</strong>. Kunjungan dan masukan Anda sangat berarti bagi kami dalam
                  meningkatkan kualitas pelayanan statistik.
                </p>
                <p style="font-size:14px; color:#334155; line-height:1.7; margin:0 0 20px 0;">
                  Jika ada pertanyaan lebih lanjut terkait data maupun layanan statistik, jangan ragu untuk
                  menghubungi kami kembali di kunjungan berikutnya.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff; border:1px solid #e0f2fe; border-radius:16px; margin:0 0 24px 0;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="font-size:13px; color:#0c4a6e; line-height:1.6; margin:0 0 12px 0;">
                        Jika berkenan, mohon luangkan waktu sebentar untuk mengisi <strong>Survei Kepuasan
                        Pelanggan (SKD)</strong> resmi BPS berikut ini. Masukan Anda sangat membantu kami:
                      </p>
                      <a href="https://skd.bps.go.id/skd/p/7308"
                         style="display:inline-block; background-color:#0284c7; color:#ffffff; font-size:13px; font-weight:bold; text-decoration:none; padding:10px 20px; border-radius:10px;">
                        Isi Survei Kepuasan Pelanggan (SKD)
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="font-size:14px; color:#0f172a; margin:0;">
                  Salam,<br />
                  <strong>Tim IPDS BPS Kabupaten Maros</strong><br />
                  <span style="color:#94a3b8; font-size:12px;">(Integrasi Pengolahan, Diseminasi, dan Publikasi Statistik)</span>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px; background-color:#E6EBF3; border-top:1px solid #f1f5f9; text-align:center;">
                <p style="font-size:10px; color:#94a3b8; margin:0; letter-spacing:0.5px;">
                  Email ini dikirim otomatis oleh Sistem Antrean &amp; Buku Tamu Digital BPS Kabupaten Maros.
                  Mohon tidak membalas email ini.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
