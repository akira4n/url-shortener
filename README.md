# URL Shortener

REST API for creating, managing, and monitoring short URLs. This project uses
Node.js and Express, PostgreSQL as the primary database, Redis as the cache and
rate-limit state store, and BullMQ to process click analytics asynchronously.

## Features

- Registration and login using email/password.
- Password hashing with `bcrypt`.
- Private endpoint authentication using JWT Bearer token.
- Creating short URLs with a random code or custom slug.
- Viewing the user's URL list with pagination.
- Updating and deleting one's own URLs.
- Short URL redirection with HTTP 302.
- Short URL lookup caching in Redis, including a negative cache for URLs that
  are not found.
- Asynchronous click tracking through Redis and BullMQ.
- Analytics summaries by device, browser, OS, and date range.
- Distributed rate limiting using Redis.
- Structured logging with Pino and request ID `X-Request-ID`.
- Collecting container logs in Loki through Grafana Alloy and visualizing them
  through Grafana.
- Health check for the API service.

## Architecture

```text
Client
  |
  v
Nginx :80
  |
  v
Express API :3000
  |                 \
  |                  \ redirect + publish click job
  v                   v
PostgreSQL         Redis :6379
  ^                   |
  |                   v
Prisma            BullMQ analytics-queue
                      |
                      v
                 Analytics worker
                      |
                      v
                 Click analytics -> PostgreSQL

Docker logs -> Grafana Alloy -> Loki -> Grafana (/grafana/)
```

Runtime components:

- **API server**: `src/server.js` runs Express and handles graceful shutdown
  for the HTTP server, Prisma, and Redis.
- **Application**: `src/app.js` registers the health check, middleware, and
  `/api/v1` routes.
- **PostgreSQL**: stores users, URLs, and click analytics.
- **Redis**: stores URL cache, negative cache, rate limits, and BullMQ queue
  data.
- **Analytics worker**: `src/worker.js` runs the BullMQ worker with
  concurrency 5 and writes click metadata to the database.
- **Nginx**: reverse proxy for the API and Grafana in Docker deployment.
- **Loki/Alloy/Grafana**: container-log-based observability.

### Redirect and analytics flow

1. The client requests `GET /api/v1/urls/:code`.
2. The API looks up the short code in Redis.
3. If there is a cache miss, the API retrieves the data from PostgreSQL and
   warms the cache for 24 hours.
4. If the short code does not exist, `EMPTY` is stored in Redis for 60 seconds
   as a negative cache.
5. The API adds the click event to `analytics-queue` and immediately returns a
   `302` redirect.
6. The analytics worker takes the job, reads the user agent, then stores the
   browser, OS, device type, IP, referrer, and click time in PostgreSQL.

Failure to publish the job does not prevent the redirect; the failure is logged.
BullMQ jobs have a maximum of 3 attempts with exponential backoff starting at
1 second.

## Prerequisites

To run without containers:

- Node.js 22 or newer
- PostgreSQL 17 or compatible
- Redis 7 or compatible

To run with Docker:

- Docker Engine
- Docker Compose

## Local installation and configuration

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Adjust `.env`. Example development configuration:

   ```dotenv
   POSTGRES_DB=url_shortener
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_PORT=5432

   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/url_shortener?schema=public"

   REDIS_HOST=localhost
   REDIS_PORT=6379

   PORT=3000
   JWT_SECRET=replace-with-a-long-random-secret
   JWT_EXPIRES_IN=3d

   NGINX_HTTP_PORT=80
   GRAFANA_ROOT_URL=http://localhost/grafana/
   GRAFANA_ADMIN_USER=admin
   GRAFANA_ADMIN_PASSWORD=change-this-password
   ```

   `DATABASE_URL` must use the `localhost` host when PostgreSQL is run from
   `docker-compose.dev.yml`. Use the `postgres` host when the API runs inside
   production Docker Compose.

4. Start development dependencies:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

5. Generate the Prisma Client and apply the migration:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

6. Start the API:

   ```bash
   npm start
   ```

   The API is available at `http://localhost:3000`.

7. In another terminal, start the analytics worker:

   ```bash
   npm run start:worker
   ```

### Development mode with hot reload

```bash
npm run dev
npm run dev:worker
```

Both commands use Nodemon. PostgreSQL and Redis dependencies can still be run
with `docker-compose.dev.yml`.

## Running with Docker Compose

Production mode runs the API, worker, PostgreSQL, Redis, Nginx, Loki, Grafana
Alloy, and Grafana:

```bash
cp .env.example .env
# Set DATABASE_URL with the postgres host and fill in all required secrets.
docker compose up -d --build
```

Example database values for production Compose mode:

```dotenv
DATABASE_URL="postgresql://postgres:strong-password@postgres:5432/url_shortener?schema=public"
POSTGRES_PASSWORD=strong-password
JWT_SECRET=replace-with-a-long-random-secret
GRAFANA_ADMIN_PASSWORD=replace-with-a-strong-password
```

The production image only contains runtime dependencies and does not include
the Prisma CLI as a runtime command. Migrations must be run from a separate
environment that has the Prisma CLI and network access to the database, such as
a deployment pipeline or admin host:

```bash
DATABASE_URL="postgresql://postgres:strong-password@<database-host>:5432/url_shortener?schema=public" \
  npx prisma migrate deploy
```

If migrations are run before API deployment, ensure the database is available
and `DATABASE_URL` points to a database endpoint accessible by the migration
environment. For setups that require a migration job inside Compose, create a
dedicated image/job that installs the Prisma CLI; do not rely on implicit
package downloads from the production container.

The main endpoints are then available through Nginx:

- API: `http://localhost`
- Health check: `http://localhost/api/health`
- Grafana: `http://localhost/grafana/`

The Nginx port can be changed with `NGINX_HTTP_PORT`. PostgreSQL and Redis
containers in production mode are only available on the internal Compose
network. Data is stored in the following named volumes:

- `postgres_data`
- `redis_data`
- `loki_data`
- `alloy_data`
- `grafana_data`

## Environment variables

| Variable                 |      Required | Default                       | Description                          |
| ------------------------ | ---------: | ----------------------------- | ----------------------------------- |
| `POSTGRES_DB`            |      No | `url_shortener`               | PostgreSQL database name            |
| `POSTGRES_USER`          |      No | `postgres`                    | PostgreSQL user                     |
| `POSTGRES_PASSWORD`      | Production | -                             | PostgreSQL password                 |
| `POSTGRES_PORT`          |      No | `5432`                        | PostgreSQL port in dev mode       |
| `DATABASE_URL`           |         Ya | -                             | Prisma PostgreSQL connection string |
| `REDIS_HOST`             |      No | `127.0.0.1`                   | Redis host                          |
| `REDIS_PORT`             |      No | `6379`                        | Redis port                          |
| `PORT`                   |      No | `3000`                        | HTTP API port                       |
| `NODE_ENV`               |      No | `development` implicitly | `production` is used in the image   |
| `JWT_SECRET`             |         Ya | -                             | Secret for signing JWT            |
| `JWT_EXPIRES_IN`         |      No | `3d`                          | JWT lifetime, e.g. `3d`     |
| `NGINX_HTTP_PORT`        |      No | `80`                          | Host port for Nginx               |
| `GRAFANA_ROOT_URL`       |      No | `http://localhost/grafana/`   | Grafana base URL                   |
| `GRAFANA_ADMIN_USER`     |      No | `admin`                       | Grafana admin user                  |
| `GRAFANA_ADMIN_PASSWORD` | Production | -                             | Grafana admin password              |

Do not commit `.env`, JWT secret, the database passwords, or the Grafana password.
The `.env` file is already ignored by Git.

## API reference

Base URL:

```text
/api/v1
```

Successful JSON responses use the following common shape:

```json
{
  "success": true,
  "message": "Operation completed.",
  "data": {}
}
```

Errors use the following shape:

```json
{
  "success": false,
  "message": "Error message."
}
```

Validation errors return HTTP `400`. Server errors with status `500`
do not expose internal details and only return `Internal Server Error`.

### Health check

#### `GET /api/health`

Authentication is not required.

```bash
curl http://localhost:3000/api/health
```

Response `200`:

```json
{
  "success": true,
  "message": "Service is healthy"
}
```

### Authentication

#### `POST /api/v1/auth/register`

Creates a new user. Fields:

- `name`: string, 2-100 characters.
- `email`: valid email; stored in lowercase.
- `password`: 8-72 characters.

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "password": "password123"
  }'
```

The `201` response contains `data.user` and a JWT:

```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    },
    "token": "eyJ..."
  }
}
```

An email that is already in use returns `409`.

#### `POST /api/v1/auth/login`

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "ada@example.com",
    "password": "password123"
  }'
```

The `200` response has the same `data` shape as registration. Invalid
credentials return `401`.

Use the token on private endpoints:

```http
Authorization: Bearer <token>
```

### URL management

All of the following endpoints require Bearer token.

#### `POST /api/v1/urls`

Creates a short URL. `customSlug` is optional. If it is not provided, the
service generates a random code.

Input rules:

- `originalUrl` must be a URL with the `http` or `https` protocol.
- `customSlug` is optional, 3-20 characters, and may contain only letters, numbers, and hyphens.

```bash
curl -X POST http://localhost:3000/api/v1/urls \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "originalUrl": "https://example.com/articles/hello",
    "customSlug": "hello-article"
  }'
```

The `201` response returns the URL record, including `id`, `userId`,
`originalUrl`, `shortCode`, `createdAt`, and `updatedAt`. A custom slug that is
already in use returns `409`.

#### `GET /api/v1/urls`

Retrieves URLs belonging to the currently logged-in user.

Query parameters:

- `page`: integer with a minimum of 1, default `1`.
- `limit`: integer 1-100, default `10`.

```bash
curl 'http://localhost:3000/api/v1/urls?page=1&limit=10' \
  -H 'Authorization: Bearer <token>'
```

The `200` response returns the `data` array and pagination `meta`:

```json
{
  "success": true,
  "message": "URL list retrieved successfully.",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### `PATCH /api/v1/urls/:id`

Updates `originalUrl`, `customSlug`, or both. Both fields are optional,
but at least one change should be submitted.

```bash
curl -X PATCH http://localhost:3000/api/v1/urls/<url-id> \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "originalUrl": "https://example.com/articles/updated",
    "customSlug": "updated-article"
  }'
```

Users can only update their own URLs. A missing URL returns `404`, access to
another user’s URL returns `403`, and a duplicate slug returns `409`.

#### `DELETE /api/v1/urls/:id`

```bash
curl -X DELETE http://localhost:3000/api/v1/urls/<url-id> \
  -H 'Authorization: Bearer <token>'
```

Response `200`:

```json
{
  "success": true,
  "message": "URL deleted successfully."
}
```

Deleting a URL also deletes related analytics through the foreign key cascade
and removes the Redis cache for that short code.

### Redirect public

#### `GET /api/v1/urls/:code`

This endpoint does not require authentication.

```bash
curl -i http://localhost:3000/api/v1/urls/hello-article
```

If found, the API returns `302` with a `Location` header pointing to the
original URL. The request is also scheduled for tracking by the analytics worker.
A missing short code returns `404`.

### Analytics

#### `GET /api/v1/analytics/:urlId`

Requires a Bearer token and can only be used by the URL owner.

Optional query parameters:

- `startDate`: ISO date `YYYY-MM-DD`.
- `endDate`: ISO date `YYYY-MM-DD`.
- If both are present, `startDate` must be less than or equal to `endDate`.

```bash
curl 'http://localhost:3000/api/v1/analytics/<url-id>?startDate=2026-01-01&endDate=2026-12-31' \
  -H 'Authorization: Bearer <token>'
```

The `200` response has the following shape:

```json
{
  "success": true,
  "message": "Analytics summary retrieved successfully.",
  "data": {
    "totalClicks": 12,
    "byDevice": [
      {
        "deviceType": "mobile",
        "_count": {
          "_all": 7
        }
      }
    ],
    "byBrowser": [],
    "byOs": []
  }
}
```

The `browser`, `os`, or `deviceType` values may be `null` when metadata is
unavailable from the user agent.

## Rate limiting

All limiters use a Redis store so counters can be shared across API instances:

| Area            |               Limit | Key           |
| --------------- | ------------------: | --------------- |
| Login           | 5 requests / 3 minutes | IP + email      |
| Register        | 5 requests / 3 minutes | IP              |
| Redirect public |  60 requests / minute | IP              |
| URL CRUD        |  20 requests / minute | User ID or IP |
| Analytics       |  15 requests / minute | User ID or IP |

The response when the limit is exceeded is HTTP `429`, and standard rate-limit
response headers are enabled. Because the application uses `trust proxy`, proxy
configuration must be correct so `req.ip` cannot be spoofed through an incorrect
deployment.

## Database and migrations

The Prisma schema is located at [prisma/schema.prisma](prisma/schema.prisma).

Main models:

- `User`: user identity and URL relation.
- `Url`: original URL, unique short code, and owner.
- `ClickAnalytic`: click event with time, referrer, IP, browser, OS, and
  device type.

Relations use cascade delete from users to URLs and from URLs to analytics.
Important indexes exist on `Url.userId` and the combination of
`ClickAnalytic.urlId, clickedAt`.

Prisma commands:

```bash
npx prisma generate
npx prisma migrate dev --name migration_name
npx prisma migrate deploy
npx prisma migrate status
npx prisma studio
```

Use `migrate dev` for development when creating a new migration.
Use `migrate deploy` for deployment environments. Do not edit the production
database manually without a tracked migration.

## Testing

Tests use Jest and Supertest:

```bash
npm test
```

Tests run serially with `--runInBand`. Integration tests require PostgreSQL and
Redis accessible through `.env`, as well as a database with the schema/migration
already applied. Current test coverage includes:

- Unit tests for the auth service, URL service, analytics service, and analytics worker.
- Integration tests for registration, login, password hashing, and route protection.
- Integration tests for creation, pagination, update, deletion, ownership, and
  URL validation.
- Integration tests for redirects, BullMQ job publishing, and analytics persistence.
- Integration tests for redirect caching.

Example for running test dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy
npm test
```

Integration tests clean up the user fixtures, URLs, Redis keys, and analytics jobs
they create. Avoid using the production database for tests.

## Observability

The application logger uses Pino and `pino-http`:

- Every request receives `X-Request-ID`.
- Successful requests are logged at the `info`.
- `4xx` statuses are logged at the `warn`.
- Errors or `5xx` statuses are logged at the `error`.
- Authorization header, password, and token are redacted from logs.

In production Docker Compose:

1. Docker container logs are discovered by Grafana Alloy through the read-only
   Docker socket.
2. Alloy adds the labels `container`, `service`, and `environment`.
3. Alloy sends logs to Loki.
4. Grafana uses Loki as the default data source.

Grafana is available at `/grafana/` through Nginx. Initial credentials are
defined by `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`. Loki is configured with a retention period of 336 hours (14 days) using filesystem storage.
