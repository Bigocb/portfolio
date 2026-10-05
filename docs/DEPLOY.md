# Deployment Guide

This document describes how to deploy the portfolio site to production.

## Prerequisites

- Docker and Docker Compose installed
- A domain name configured
- SSH access to your server (if using SSH deploy method)
- GitHub Actions secrets configured (if using GitHub Actions)

## Environment Variables

Create a `.env` file in the project root:

```bash
SITE_DOMAIN=yourdomain.com
```

This is used by Caddy to configure the domain and automatically set up HTTPS.

## Option A: Docker Compose (Local Deployment)

### Setup

1. Build the Docker image:
```bash
docker compose build
```

2. Start the container:
```bash
docker compose up -d
```

3. Verify it's running:
```bash
docker compose logs -f
```

The site will be available at `https://localhost` (with a self-signed certificate initially).

### Updating

1. Pull the latest code
2. Rebuild: `docker compose up -d --build`
3. Caddy automatically handles certificate renewal

### Troubleshooting

- **Port 80/443 already in use**: Check `docker compose ps` and stop other containers
- **Certificate issues**: Caddy stores certificates in the `caddy_data` volume; delete it to regenerate: `docker volume rm portfolio_caddy_data`
- **DNS issues**: Verify your domain's A record points to your server's IP

## Option B: GitHub Actions (CI/CD)

### Setup

1. Create GitHub Actions secrets:
   - `DOCKER_REGISTRY_PASSWORD`: Password for your Docker registry (e.g., GitHub Container Registry)
   - `DEPLOY_HOST`: Your server's hostname or IP
   - `DEPLOY_USER`: SSH user
   - `DEPLOY_KEY`: SSH private key (base64 encoded: `base64 -w0 ~/.ssh/id_rsa`)
   - `SITE_DOMAIN`: Your production domain

2. Update `.github/workflows/deploy.yml` with your deployment method (SSH or image tag bump)

3. Push to `main` branch to trigger deployment

### First-time Setup on Server

```bash
# SSH into your server
ssh user@example.com

# Create app directory
mkdir -p ~/portfolio
cd ~/portfolio

# Create .env file
echo "SITE_DOMAIN=example.com" > .env

# Start container (on first run, pull latest image)
docker run -d \
  --name portfolio \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v portfolio_caddy_data:/data \
  -v portfolio_caddy_config:/config \
  -e SITE_DOMAIN=example.com \
  ghcr.io/yourusername/portfolio:latest
```

### Updating

When you push to `main`, GitHub Actions:
1. Runs linting, type checks, tests
2. Builds Docker image
3. Pushes to GitHub Container Registry
4. Deploys via SSH: `docker pull && docker-compose up -d`

## DNS Configuration

Update your domain's DNS records:

```
A     example.com  -> YOUR_SERVER_IP
A     www          -> YOUR_SERVER_IP  (optional)
AAAA  example.com  -> YOUR_SERVER_IPV6  (optional)
```

Wait for DNS to propagate (typically 5 minutes to 48 hours).

## HTTPS and Certificates

Caddy automatically:
- Obtains TLS certificates from Let's Encrypt
- Renews certificates before expiration
- Stores certificates in the `caddy_data` volume

No manual certificate management needed.

## Monitoring

### Check logs
```bash
docker compose logs -f
```

### Health check
```bash
curl https://example.com/404.html
```

Should return 200 OK (or 404 for actual 404 pages).

### Caddy admin API
Caddy exposes an admin API on `localhost:2019` (not exposed externally for security).

## Rollback

To roll back to a previous version:

```bash
# List available tags
docker compose images

# Update docker-compose.yml with previous tag:
# image: ghcr.io/yourusername/portfolio:v1.0.0

# Redeploy
docker compose up -d
```

## Security Checklist

- [ ] Domain is configured with A record
- [ ] HTTPS is working (check certificate in browser)
- [ ] Security headers are present:
  - [ ] Strict-Transport-Security
  - [ ] Content-Security-Policy
  - [ ] X-Content-Type-Options
- [ ] No third-party trackers or embeds
- [ ] Git remote doesn't expose secrets
- [ ] GitHub Actions secrets are set correctly
- [ ] SSH keys are restricted to deployment user only

## Performance

Caddy automatically:
- Compresses responses (gzip, zstd)
- Caches static assets (1 year for hashed files)
- Short-caches HTML (1 hour)

Monitor performance:
```bash
curl -I https://example.com
# Check Cache-Control headers
```

## Troubleshooting

### 502 Bad Gateway
- Check if container is running: `docker compose ps`
- Check logs: `docker compose logs`
- Restart: `docker compose restart`

### Certificate not renewing
- Check Caddy logs for errors
- Ensure port 80 is accessible for ACME challenges
- Manually trigger renewal if needed

### Site not accessible
- Check firewall allows ports 80, 443
- Verify DNS is propagated: `dig example.com`
- Check Caddy config: `docker compose exec portfolio caddy list-modules`

## Updating Content

Content is in `src/content/`. To update:

1. Edit Markdown files
2. Commit and push to `main`
3. GitHub Actions automatically builds and deploys
4. Site updates within 5 minutes

No manual deployment needed after content changes.

## Maintenance

### Monthly
- Check certificate expiration (Caddy handles this)
- Review server logs for errors
- Update dependencies if needed

### Quarterly
- Test rollback procedure
- Review security headers
- Audit third-party dependencies

## Support

For Caddy issues: https://caddyserver.com/docs
For Astro issues: https://docs.astro.build
For Docker issues: https://docs.docker.com
