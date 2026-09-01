import http from "http";

export class MockSiteServer {
  private server: http.Server | null = null;
  private readonly port: number;

  constructor(port = 3099) {
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        const url = req.url || "/";

        if (url === "/sites/broken-legacy") {
          // Missing viewport meta, horizontal overflow, no tel link
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Broken Legacy Site</title>
                <!-- Missing viewport meta -->
              </head>
              <body>
                <div style="width: 1200px; background: #eee;">
                  <h1>Old Desktop Site</h1>
                  <p>Call us at 555-1234 (plain text)</p>
                  <a href="/non-existent-broken-page">Broken Link</a>
                </div>
              </body>
            </html>
          `);
          return;
        }

        if (url === "/sites/whatsapp-heavy") {
          // Modern responsive, WhatsApp link, no web booking
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WhatsApp Heavy Site</title>
              </head>
              <body>
                <h1>Elite Auto Service</h1>
                <a href="https://wa.me/15554567890">Chat on WhatsApp</a>
                <a href="tel:+15554567890">Call Now</a>
              </body>
            </html>
          `);
          return;
        }

        if (url === "/sites/modern-no-booking") {
          // Modern responsive, click-to-call, no interactive booking
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Metro Clinic</title>
              </head>
              <body>
                <h1>Metro Dental Clinic</h1>
                <a href="tel:+15555678901">Call Reception</a>
              </body>
            </html>
          `);
          return;
        }

        if (url === "/sites/modern-high-converting") {
          // Full modern setup
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Heritage Studio</title>
              </head>
              <body>
                <h1>Heritage Studio</h1>
                <a href="tel:+15556789012">Call Us</a>
                <form action="/book" method="POST">
                  <input type="date" name="appointmentDate" required />
                  <button type="submit">Confirm Booking</button>
                </form>
              </body>
            </html>
          `);
          return;
        }

        // 404 handler
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
