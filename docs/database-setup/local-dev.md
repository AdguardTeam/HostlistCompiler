# Local Development Database Setup

## Option A: Docker (Recommended)

Run PostgreSQL locally via Docker. No installation needed.

```bash
# Start PostgreSQL 17 in Docker
docker run -d \
  --name adblock-postgres \
  -e POSTGRES_USER=adblock \
  -e POSTGRES_PASSWORD=adblock \
  -e POSTGRES_DB=adblock_dev \
  -p 5432:5432 \
  postgres:17-alpine

# Verify it's running
docker ps | grep adblock-postgres
```

Connection string: `postgresql://adblock:adblock@127.0.0.1:5432/adblock_dev`

### Docker Compose (alternative)

Add to a `docker-compose.yml` at the project root:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: adblock
      POSTGRES_PASSWORD: adblock
      POSTGRES_DB: adblock_dev
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose up -d
```

## Option B: Native PostgreSQL (macOS)

```bash
# Install via Homebrew
brew install postgresql@17

# Start the service
brew services start postgresql@17

# Create the development database
createdb adblock_dev
createuser adblock --createdb
psql -c "ALTER USER adblock PASSWORD 'adblock';"
```

Connection string: `postgresql://adblock:adblock@127.0.0.1:5432/adblock_dev`

## Configure Environment

Set `DATABASE_URL` in your `.env.local` (not committed to git):

```bash
DATABASE_URL="postgresql://adblock:adblock@127.0.0.1:5432/adblock_dev"
DIRECT_DATABASE_URL="postgresql://adblock:adblock@127.0.0.1:5432/adblock_dev"
```

The `.envrc` file loads `.env.local` automatically via `direnv`.

## Apply Migrations

```bash
# Generate Prisma client + apply migrations
npx prisma migrate dev

# Or just apply existing migrations without creating new ones
npx prisma migrate deploy

# Open Prisma Studio to browse data
npx prisma studio
```

## Seed Data (optional)

```bash
# Seed with sample filter sources
npx prisma db seed
```

## Wrangler Local Dev

Wrangler uses `localConnectionString` for Hyperdrive when running `wrangler dev`:

```toml
# wrangler.toml — already configured
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "126a652809674e4abc722e9777ee4140"
localConnectionString = "postgresql://adblock:adblock@127.0.0.1:5432/adblock_dev"
```

When you run `npm run dev` (which calls `wrangler dev`), the Hyperdrive binding resolves to your local PostgreSQL instance.

## Switching Environments

| Environment | DATABASE_URL | How |
|-------------|-------------|-----|
| Local dev | `postgresql://adblock:adblock@localhost:5432/adblock_dev` | `.env.local` |
| CI/staging | PlanetScale `development` branch connection string | GitHub Actions secret |
| Production | PlanetScale `main` branch connection string | `wrangler secret put DATABASE_URL` |

The Prisma schema provider is always `postgresql` — only the connection string changes.

## Troubleshooting

**"Connection refused" on port 5432:**
- Docker: `docker ps` to verify the container is running
- Native: `brew services list` to check PostgreSQL status

**"Database does not exist":**
- Run `createdb adblock_dev` or restart the Docker container

**Prisma migration errors:**
- `npx prisma migrate reset` to drop and recreate the database (destructive!)
- Check that `DATABASE_URL` in `.env.local` is correct
