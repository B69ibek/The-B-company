# The B Company — Export House Platform

A Node/Express web app for The B Company with two separate portals:

- **Admin portal** — full access to shipments, buyers, sellers, suppliers,
  interstate trade records, client accounts, and the login/audit log.
- **Client portal** — each client only sees their own shipment records.

## 1. Install & run locally

```bash
cd the-b-company
npm install
cp .env.example .env
```

Open `.env` and set a real `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output into `SESSION_SECRET=` in `.env`.

Create the admin account (uses the ID/password you gave me — change these
env vars first if you want different ones):

```bash
ADMIN_USERNAME="The company" ADMIN_PASSWORD="luxureb19" npm run seed
```

This also creates a demo client login (`demo-client` / `ChangeMe123!`) so you
can see the client portal work — delete or change it before going live
(Admin portal → Client Accounts).

Start the server:

```bash
npm start
```

Visit `http://localhost:3000`. Admin portal at `/admin-login.html`, client
portal at `/client-login.html`.

## 2. Where your data lives

Every category is its own file, as requested, inside `/data`:

| File | Contents |
|---|---|
| `data/users.json` | Admin + client login accounts (passwords stored as bcrypt hashes, never plain text) |
| `data/shipments.json` | All shipment records |
| `data/buyers.json` | Buyer records |
| `data/sellers.json` | Seller records |
| `data/suppliers.json` | Supplier records |
| `data/interstate_trade.json` | Interstate (state-to-state) trade records |
| `data/audit_log.json` | Every login attempt — who, when, from which IP, success or failure |

You have direct file access to this folder — back it up, sync it, or version
it however you like. `.gitignore` excludes the `/data` contents from git by
default so real business data doesn't accidentally get committed; remove
that line if you do want it versioned.

## 3. Security built into the app ("firewall" at the application layer)

- Passwords hashed with bcrypt (12 rounds) — never stored or logged in plain text.
- Session cookies are `httpOnly`, `sameSite=strict`, and signed with your secret.
- Login endpoints are rate-limited (8 attempts / 15 min per IP) to block brute-force guessing.
- All other API endpoints are rate-limited too (120 req/min per IP).
- CSRF tokens required on every data-changing request (add/edit/delete).
- `helmet` sets strict HTTP security headers and a Content-Security-Policy.
- Every login attempt (success and failure) is written to `audit_log.json` with timestamp and IP, so you can spot suspicious activity.
- Client accounts can only ever read shipments tied to their own username — enforced on the server, not just hidden in the UI.
- Input is stripped of HTML/script tags before being written to disk.

### What this doesn't cover: a real network firewall

The protections above harden the *application*. A network firewall is a
separate, infrastructure-level layer that sits in front of the server and
you set up once this is deployed to a host. When you deploy:

- **Cloud hosting (AWS/GCP/Azure/DigitalOcean):** use their security group /
  firewall rules to only allow inbound traffic on ports 443 (HTTPS) and 22
  (SSH, ideally restricted to your own IP). Block everything else.
- **Your own Linux server:** enable `ufw` (`ufw allow 443`, `ufw allow 22`,
  `ufw enable`) or `firewalld`.
- **Always run behind HTTPS in production** (e.g. via Nginx + Let's Encrypt,
  or your host's managed TLS) and set `COOKIE_SECURE=true` in `.env` once you do.
- Consider a managed WAF (Cloudflare, AWS WAF) in front of the app for extra
  protection against scraping and DDoS.

## 4. Getting it live on Google

Getting found on Google search takes three separate steps — a domain, a
host, and telling Google the site exists. None of these can be done from
code; here's exactly what to do:

**a) Buy a domain** (~$10–15/year)
Namecheap or GoDaddy. Search close variants — plain "thebcompany.com" is
likely taken. Once bought, replace every `thebcompany.example` placeholder
in `public/index.html`, `public/robots.txt`, and `public/sitemap.xml` with
your real domain.

**b) Host the app** (this needs a real server, not free static hosting,
because it has a Node/Express backend)
Easiest option: [Render.com](https://render.com) — push this folder to a
GitHub repo, connect it in Render, set the `SESSION_SECRET` env var there,
and it builds + deploys automatically on every push. Then in your domain
registrar's DNS settings, point your domain at the address Render gives you
(usually a CNAME record).

**c) Fill in your real business details**
Open `public/index.html` and replace every `[bracketed placeholder]` —
services offered, phone, email, and physical address. Search engines (and
customers) need a real address to show you in local results.

**d) Tell Google the site exists**
- Create a free [Google Search Console](https://search.google.com/search-console) account, verify your domain.
- Submit `https://yourdomain.com/sitemap.xml` there.
- Also list the business on [Google Business Profile](https://www.google.com/business/) — this matters more than the website itself for showing up when someone searches your company name.

**A realistic expectation:** once live and submitted, Google typically
indexes a new page within a few days to a couple of weeks. Ranking well for
your exact business name usually happens quickly once indexed (little
competition for an exact name match); ranking for broad terms like "export
company" takes ongoing content and time — no one can promise a #1 spot on
demand, including paid SEO agencies.

## 5. Next steps before going live

1. Change the admin password after first login (currently set from the seed script).
2. Delete or change the demo client account.
3. Put the server behind HTTPS and set `COOKIE_SECURE=true`.
4. Set up regular backups of the `/data` folder (it's the entire database).
5. If you outgrow file-based storage (very large volumes, many concurrent
   editors), the `src/db.js` module is a thin wrapper — swapping it for a
   real database (Postgres, MySQL) later only touches that one file.
