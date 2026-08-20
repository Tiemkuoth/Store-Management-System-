# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Environment and Fallback Mode

This project supports a resilient backend mode when MySQL is unavailable.

Supported database environment variables:

- `DB_HOST` — MySQL host (default: `127.0.0.1`)
- `DB_PORT` — MySQL port (default: `3306`)
- `DB_USER` — MySQL username (default: `root`)
- `DB_PASSWORD` — MySQL password (default: empty)
- `DB_NAME` — MySQL database name (default: `store_management_db`)

If the server cannot connect to MySQL after three retries, it automatically falls back to a persistent JSON store at `server/db/fallback-store.json`.

If MySQL is installed through XAMPP, you can also configure the socket path with:
- `DB_SOCKET=C:/xampps/mysql/mysql.sock`

The backend will prefer socket connection when `DB_SOCKET` is set, but defaults to TCP otherwise.

The frontend displays `Resilient Local Mode` when this fallback mode is active, and it continues to serve API requests using the local JSON store.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Migration / Transfer Checklist

If you move this project to another machine and want the same users and dashboard data, follow these steps:

- Copy repository to the target machine and install dependencies:

	```bash
	git clone <repo> "C:\path\to\project"
	cd "C:\path\to\project"
	npm install
	```

- Provide database environment variables (if using MySQL) in `.env` or system vars:

	- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

- Transfer data:

	- If using fallback JSON store: copy `server/db/fallback-store.json` into the same path on the target machine.
	- If using MySQL: export/import with `mysqldump`.

- Seed or initialize the DB/fallback store (safe if run on a machine without MySQL):

	```bash
	node scripts/init_db.js
	```

- Start the server:

	```bash
	npm run server
	```

- Default seeded accounts (when using fallback):

	- `admin` / `admin123`
	- `manager` / `manager123`

Notes:

- Passwords stored as bcrypt hashes must be preserved when copying MySQL data. The server accepts legacy plaintext password entries and will re-hash them on the first successful login.
- If tests fail due to Windows temp permissions, set the `TMP`/`TEMP` environment variables to a writable local folder before running tests.

### Security Warning: Plaintext Passwords

- Storing passwords in plaintext (or transferring them as plaintext) is a serious security risk. Only use plaintext passwords for quick local testing in isolated environments.
- If you used the `scripts/reset_users.js` script, the `password_hash` column now contains plaintext values. Before deploying or sharing this database, convert these to bcrypt hashes.

Quick re-hash example (Node):

```bash
node -e "const b = require('bcryptjs'); console.log(b.hashSync('admin123',10));"
```

Then update the database (MySQL example):

```sql
UPDATE users SET password_hash = '<bcrypt-hash>' WHERE username = 'admin';
```

Recommendations:

- Do not commit files containing plaintext passwords into version control.
- Transfer `server/db/fallback-store.json` securely and remove plaintext passwords from it as soon as practical.
- For production, always store only bcrypt (or equivalent) hashes and enforce secure password policies.

### MySQL export/import scripts

Use the included scripts to export and import MySQL data.

- PowerShell (Windows):

	Export:
	```powershell
	# uses DB_HOST, DB_USER, DB_NAME env vars unless overridden
	.\scripts\export_mysql.ps1 -Output .\store_dump.sql
	```

	Import:
	```powershell
	.\scripts\import_mysql.ps1 -SqlDump .\store_dump.sql
	```

- Node (cross-platform):

	Export using Node helper (requires `minimist` package — already in dev deps? If not, install `npm i minimist`):

	```bash
	node scripts/mysql_export.js --out=store_dump.sql --user=root --db=store_management_db
	```

Keep the SQL dump safe — importing will overwrite or add rows depending on dump contents.
