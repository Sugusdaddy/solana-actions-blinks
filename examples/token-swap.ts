/**
 * Quick Token Swap Action
 * One-click swaps from any social media post
 */

import express from 'express';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';

const app = express();
app.use(express.json());

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const CONNECTION = new Connection('https://api.mainnet-beta.solana.com');

// Token mints
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

// GET: Swap metadata
app.get('/api/actions/swap', (req, res) => {
  const from = (req.query.from as string)?.toUpperCase() || 'SOL';
  const to = (req.query.to as string)?.toUpperCase() || 'USDC';

  res.json({
    icon: 'https://jup.ag/favicon.ico',
    title: `Swap ${from} → ${to}`,
    description: `Quick swap powered by Jupiter`,
    label: 'Swap',
    links: {
      actions: [
        { label: `Swap 0.1 ${from}`, href: `/api/actions/swap?from=${from}&to=${to}&amount=0.1` },
        { label: `Swap 0.5 ${from}`, href: `/api/actions/swap?from=${from}&to=${to}&amount=0.5` },
        { label: `Swap 1 ${from}`, href: `/api/actions/swap?from=${from}&to=${to}&amount=1` },
        {
          label: 'Custom amount',
          href: `/api/actions/swap?from=${from}&to=${to}&amount={amount}`,
          parameters: [{ name: 'amount', label: `Amount in ${from}`, required: true }],
        },
      ],
    },
  });
});

// POST: Create swap transaction
app.post('/api/actions/swap', async (req, res) => {
  try {
    const { account } = req.body;
    const from = (req.query.from as string)?.toUpperCase() || 'SOL';
    const to = (req.query.to as string)?.toUpperCase() || 'USDC';
    const amount = parseFloat(req.query.amount as string) || 0.1;

    const inputMint = TOKENS[from as keyof typeof TOKENS];
    const outputMint = TOKENS[to as keyof typeof TOKENS];

    if (!inputMint || !outputMint) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Get decimals (simplified)
    const decimals = from === 'BONK' ? 5 : from === 'USDC' ? 6 : 9;
    const lamports = Math.floor(amount * 10 ** decimals);

    // Get quote from Jupiter
    const quoteResponse = await fetch(
      `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${lamports}&slippageBps=50`
    );
    const quote = await quoteResponse.json();

    // Get swap transaction
    const swapResponse = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: account,
        wrapAndUnwrapSol: true,
      }),
    });
    const { swapTransaction } = await swapResponse.json();

    res.json({
      transaction: swapTransaction,
      message: `Swapping ${amount} ${from} for ${to}`,
    });
  } catch (error) {
    console.error('Swap error:', error);
    res.status(500).json({ error: 'Swap failed' });
  }
});

app.listen(3002, () => console.log('Swap server on port 3002'));
