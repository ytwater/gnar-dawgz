# Push Notifications Setup

This guide will help you set up browser push notifications for the Gnar Dawgs application.

## Prerequisites

- Node.js and pnpm installed
- Cloudflare account (for production deployment)

## Generating VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for web push notifications. You need to generate a public/private key pair.

### Option 1: Using web-push CLI (Recommended)

```bash
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

This will output something like:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls

=======================================
```

### Option 2: Using npx (No Installation Required)

```bash
npx web-push generate-vapid-keys
```

## Adding VAPID Keys to Your Environment

### Development (.dev.vars)

Add the following to your `.dev.vars` file:

```
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:your-email@example.com
```

Replace:
- `<your-public-key>` with the public key from the generation step
- `<your-private-key>` with the private key from the generation step
- `your-email@example.com` with your actual email or website URL (e.g., `https://gnar-dawgs.com`)

### Production (Cloudflare Secrets)

For production, add the VAPID keys as Cloudflare secrets:

```bash
# Set VAPID public key
wrangler secret put VAPID_PUBLIC_KEY

# Set VAPID private key
wrangler secret put VAPID_PRIVATE_KEY

# Set VAPID subject
wrangler secret put VAPID_SUBJECT
```

When prompted, paste the corresponding values.

## Database Migration

Run the database migration to create the `push_subscriptions` table:

### Development

```bash
pnpm db:migrate:dev
```

### Production

```bash
pnpm db:migrate:prod
```

## Testing Push Notifications

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Navigate to `/profile` in your browser

3. Click the notification toggle to enable notifications

4. Grant permission when prompted by the browser

5. Click "Send Test Notification" to test

## Important Notes

### Browser Support

- Push notifications work in modern browsers (Chrome, Firefox, Edge, Safari 16+)
- Requires HTTPS (or localhost for development)
- Users must grant permission for notifications

### Service Worker

The service worker is located at `/public/service-worker.ts`. It handles:
- Receiving push notifications
- Displaying notifications
- Handling notification clicks

### Limitations

- The current implementation uses a placeholder for sending notifications
- For production use, you should install the `web-push` library for proper encryption:
  ```bash
  pnpm add web-push
  ```

### Future Improvements

1. **Install web-push library**: The current `api.push.test.ts` has placeholder code. Install `web-push` and implement proper notification sending with encryption.

2. **Notification preferences**: Add more granular notification settings (e.g., notification types, quiet hours)

3. **Notification history**: Store sent notifications in the database for user reference

4. **Batch notifications**: Send notifications to multiple users efficiently

## Troubleshooting

### Notifications not appearing

1. Check browser console for errors
2. Verify VAPID keys are set correctly
3. Ensure service worker is registered (check in DevTools > Application > Service Workers)
4. Check notification permissions in browser settings

### Service worker not registering

1. Ensure you're on HTTPS or localhost
2. Check the service worker file path is correct (`/service-worker.js`)
3. Clear browser cache and reload

### Database errors

1. Ensure migrations have been run
2. Check database connection in Cloudflare D1
3. Verify schema is up to date with `pnpm db:generate`

## Security Considerations

- **Never commit VAPID private keys** to version control
- Use Cloudflare secrets for production keys
- Rotate keys periodically for security
- Validate all user input in API routes
- Rate limit notification sending to prevent abuse
