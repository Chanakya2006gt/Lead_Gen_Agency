import http from "http";

export class MockSiteServer {
  private server: http.Server | null = null;
  private port: number;

  constructor(port = 3099) {
    this.port = port;
  }

  public start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = req.url || "/";

        if (url === "/sites/broken-legacy") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Legacy Dental Center - Old Site</title>
              <!-- Notice: Intentionally missing viewport meta tag -->
              <style>
                html, body { width: 1200px; min-width: 1200px; font-family: Arial; margin: 0; padding: 0; }
                .hero { background: #eee; padding: 40px; }
              </style>
              <script>
                console.error("Uncaught TypeError: jQuery(...).datepicker is not a function");
              </script>
            </head>
            <body>
              <nav>
                <a href="/">Home</a>
                <a href="/missing-services-404">Services</a>
                <a href="/missing-contact-404">Contact</a>
              </nav>
              <div class="hero">
                <h1>Welcome to Precision Dental Care</h1>
                <p>Call our front desk during work hours (9am - 4pm).</p>
                <!-- Notice: Plain text phone, no tel: link, no online booking -->
                <p>Phone: 555-345-6789</p>
              </div>
            </body>
            </html>
          `);
        } else if (url === "/sites/whatsapp-heavy") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Elite Custom Works</title>
            </head>
            <body>
              <h1>Elite Custom Fabrication & Roofing</h1>
              <p>For custom RFQ, blueprints, and quotation estimates, message our WhatsApp dispatch team directly.</p>
              <a href="https://wa.me/15554567890?text=I%20need%20a%20quotation" class="whatsapp-btn">Chat on WhatsApp for Quote</a>
              <form action="/submit-quote" method="POST">
                <input type="text" placeholder="Project specs / measurements" />
                <button type="submit">Request Detailed RFQ Estimate</button>
              </form>
            </body>
            </html>
          `);
        } else if (url === "/sites/modern-no-booking") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Metro Clinic</title>
            </head>
            <body>
              <h1>Metro Healthcare Associates</h1>
              <a href="tel:+15555678901">Call Us Directly: 555-567-8901</a>
              <p>Our brochure site. We offer General Medicine, Pediatrics, and Orthopedics.</p>
            </body>
            </html>
          `);
        } else if (url === "/sites/modern-high-converting") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Heritage Studio</title>
            </head>
            <body>
              <h1>Heritage Design Studio</h1>
              <a href="tel:+15556789012">Call Now</a>
              <form id="booking-calendar">
                <input type="text" name="name" placeholder="Your Name" />
                <button type="submit">Schedule Appointment Online</button>
              </form>
            </body>
            </html>
          `);
        } else if (url.includes("404")) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Page Not Found (404)");
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Default Test Page</h1></body></html>");
        }
      });

      this.server.listen(this.port, () => {
        resolve(`http://localhost:${this.port}`);
      });

      this.server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          // Port already in use, reuse
          resolve(`http://localhost:${this.port}`);
        } else {
          reject(err);
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
