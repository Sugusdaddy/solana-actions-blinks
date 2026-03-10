# Solana Actions and Blinks

Full implementation of Solana Actions and Blinks (Blockchain Links) protocol. Enables any URL to trigger wallet transactions - from social media posts, QR codes, or any web surface.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-black?style=flat&logo=solana&logoColor=14F195)
![License](https://img.shields.io/badge/License-MIT-green)

## What are Blinks?

Blinks (Blockchain Links) turn any URL into a transaction interface. When a wallet (like Phantom) detects a Blink URL, it unfurls into an interactive transaction card.

```
Regular link:  https://yoursite.com/donate
    ↓
Blink URL:     solana-action:https://yoursite.com/api/actions/donate
    ↓
In wallet:     [Interactive card with "Donate 1 SOL" button]
```

## Use Cases

- Donate buttons in tweets
- NFT minting from Discord messages
- Token airdrops via QR codes
- DAO voting in Telegram
- In-game purchases from streaming overlays

## Quick Start

### Server (Action Provider)

```typescript
import { createActionServer, ActionGetResponse } from '@sugusdaddy/solana-actions-blinks';

const server = createActionServer();

// Define your action
server.get('/api/actions/donate', async (req): Promise<ActionGetResponse> => {
  return {
    icon: 'https://yoursite.com/logo.png',
    title: 'Donate to Project',
    description: 'Support open source development',
    label: 'Donate',
    links: {
      actions: [
        { label: 'Donate 0.1 SOL', href: '/api/actions/donate?amount=0.1' },
        { label: 'Donate 1 SOL', href: '/api/actions/donate?amount=1' },
        { label: 'Donate 5 SOL', href: '/api/actions/donate?amount=5' },
      ],
    },
  };
});

// Handle the transaction request
server.post('/api/actions/donate', async (req): Promise<ActionPostResponse> => {
  const { account } = req.body;
  const amount = parseFloat(req.query.amount) || 1;
  
  const transaction = await createDonationTx(account, amount);
  
  return {
    transaction: transaction.serialize().toString('base64'),
    message: `Thank you for donating ${amount} SOL!`,
  };
});

server.listen(3000);
```

### Client (Blink Resolution)

```typescript
import { BlinkClient, resolveAction } from '@sugusdaddy/solana-actions-blinks';

const client = new BlinkClient();

// Resolve a blink URL
const action = await client.resolve('solana-action:https://yoursite.com/api/actions/donate');

console.log(action);
// {
//   icon: 'https://yoursite.com/logo.png',
//   title: 'Donate to Project',
//   description: 'Support open source development',
//   actions: [
//     { label: 'Donate 0.1 SOL', ... },
//     { label: 'Donate 1 SOL', ... },
//   ],
// }

// Execute an action
const result = await client.execute(action.actions[1], wallet);
// Returns signed transaction for wallet to send
```

## Protocol Specification

### Action URL Format

```
solana-action:<action-url>

Examples:
solana-action:https://jupiter.com/api/actions/swap?input=SOL&output=USDC
solana-action:https://tensor.trade/api/actions/buy?mint=abc123
solana-action:https://yoursite.com/api/actions/vote?proposal=1
```

### GET Response (Action Metadata)

```typescript
interface ActionGetResponse {
  // Display icon (absolute URL)
  icon: string;
  
  // Action title
  title: string;
  
  // Description
  description: string;
  
  // Default button label
  label: string;
  
  // Disable state
  disabled?: boolean;
  
  // Available actions
  links?: {
    actions: LinkedAction[];
  };
  
  // Error state
  error?: ActionError;
}

interface LinkedAction {
  href: string;       // Action endpoint
  label: string;      // Button label
  parameters?: ActionParameter[];  // Input fields
}

interface ActionParameter {
  name: string;       // Parameter name
  label?: string;     // Display label
  required?: boolean; // Is required
}
```

### POST Request (Execute Action)

```typescript
interface ActionPostRequest {
  // User's wallet address (base58)
  account: string;
}

interface ActionPostResponse {
  // Serialized transaction (base64)
  transaction: string;
  
  // Success message
  message?: string;
  
  // Redirect URL after completion
  redirect?: string;
}
```

## Server Implementation

### Express Middleware

```typescript
import express from 'express';
import { createActionsMiddleware } from '@sugusdaddy/solana-actions-blinks';

const app = express();

// Add CORS headers required by Actions spec
app.use(createActionsMiddleware());

// Your action endpoints
app.get('/api/actions/mint', async (req, res) => {
  res.json({
    icon: 'https://...',
    title: 'Mint NFT',
    description: 'Mint a unique NFT',
    label: 'Mint Now',
  });
});

app.post('/api/actions/mint', async (req, res) => {
  const { account } = req.body;
  const tx = await createMintTransaction(account);
  
  res.json({
    transaction: tx.serialize().toString('base64'),
  });
});
```

### actions.json Registration

```json
{
  "rules": [
    {
      "pathPattern": "/api/actions/**",
      "apiPath": "/api/actions/**"
    }
  ]
}
```

Host at `/.well-known/actions.json` for wallet discovery.

## Client Implementation

### React Hook

```typescript
import { useAction } from '@sugusdaddy/solana-actions-blinks/react';

function BlinkCard({ url }: { url: string }) {
  const { action, loading, error, execute } = useAction(url);
  
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  
  return (
    <div className="blink-card">
      <img src={action.icon} alt={action.title} />
      <h3>{action.title}</h3>
      <p>{action.description}</p>
      
      {action.actions.map((btn, i) => (
        <button key={i} onClick={() => execute(btn)}>
          {btn.label}
        </button>
      ))}
    </div>
  );
}
```

### URL Detection

```typescript
import { isBlinkUrl, parseBlinkUrl } from '@sugusdaddy/solana-actions-blinks';

// Detect Blink URLs in text
const text = 'Check out this mint: solana-action:https://nft.com/api/actions/mint';

if (isBlinkUrl(text)) {
  const actionUrl = parseBlinkUrl(text);
  // actionUrl = 'https://nft.com/api/actions/mint'
}
```

## Examples

### Donation Button

```typescript
// GET /api/actions/donate
{
  icon: 'https://myproject.com/logo.png',
  title: 'Support Development',
  description: 'Your donation helps us build cool stuff',
  label: 'Donate',
  links: {
    actions: [
      { label: '☕ 0.1 SOL', href: '/api/actions/donate?amount=0.1' },
      { label: '🍕 1 SOL', href: '/api/actions/donate?amount=1' },
      { label: '🚀 10 SOL', href: '/api/actions/donate?amount=10' },
    ],
  },
}
```

### NFT Mint with Parameters

```typescript
// GET /api/actions/mint
{
  icon: 'https://collection.com/preview.png',
  title: 'Mint Cool NFT',
  description: 'Limited edition of 1000',
  label: 'Mint',
  links: {
    actions: [
      {
        label: 'Mint NFT',
        href: '/api/actions/mint?quantity={quantity}',
        parameters: [
          {
            name: 'quantity',
            label: 'How many?',
            required: true,
          },
        ],
      },
    ],
  },
}
```

### Token Swap

```typescript
// GET /api/actions/swap
{
  icon: 'https://dex.com/logo.png',
  title: 'Quick Swap',
  description: 'Swap SOL to USDC instantly',
  label: 'Swap',
  links: {
    actions: [
      { label: 'Swap 0.1 SOL', href: '/api/actions/swap?amount=0.1&from=SOL&to=USDC' },
      { label: 'Swap 1 SOL', href: '/api/actions/swap?amount=1&from=SOL&to=USDC' },
    ],
  },
}
```

## Security Considerations

1. **CORS**: Actions must include proper CORS headers
2. **HTTPS**: All action URLs must use HTTPS
3. **Validation**: Validate account addresses server-side
4. **Rate Limiting**: Protect against abuse
5. **Transaction Simulation**: Show users what they're signing

## Architecture

```
src/
├── server/
│   ├── middleware.ts    # Express middleware
│   ├── handlers.ts      # Request handlers
│   └── validation.ts    # Input validation
├── client/
│   ├── resolver.ts      # Blink URL resolution
│   ├── executor.ts      # Action execution
│   └── detector.ts      # URL detection
├── actions/
│   ├── types.ts         # Protocol types
│   └── builders.ts      # Response builders
└── index.ts
```

## Resources

- [Solana Actions Spec](https://solana.com/docs/advanced/actions)
- [Dialect Blinks](https://docs.dialect.to/blinks)
- [Phantom Blinks Support](https://phantom.app)

## License

MIT License

---

Built by [@Sugusdaddy](https://github.com/Sugusdaddy)
