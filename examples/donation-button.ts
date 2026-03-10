/**
 * Complete donation button example using Solana Actions
 * Deploy this server and share the Blink URL on Twitter/Discord
 */

import express from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const app = express();
app.use(express.json());

// CORS headers required for Solana Actions
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Action-Version', '1');
  res.setHeader('X-Blockchain-Ids', 'solana:mainnet');
  next();
});

// Configuration
const RECIPIENT = new PublicKey('YOUR_WALLET_ADDRESS');
const CONNECTION = new Connection('https://api.mainnet-beta.solana.com');

const DONATION_OPTIONS = [
  { label: '☕ Buy me a coffee', amount: 0.1 },
  { label: '🍕 Buy me lunch', amount: 1 },
  { label: '🚀 Support the project', amount: 5 },
  { label: '💎 Generous donation', amount: 10 },
];

// GET: Return action metadata
app.get('/api/actions/donate', (req, res) => {
  res.json({
    icon: 'https://your-domain.com/logo.png',
    title: 'Support My Work',
    description: 'Your donation helps me create more open source tools for the Solana ecosystem',
    label: 'Donate',
    links: {
      actions: DONATION_OPTIONS.map(opt => ({
        label: `${opt.label} (${opt.amount} SOL)`,
        href: `/api/actions/donate?amount=${opt.amount}`,
      })),
    },
  });
});

// POST: Create donation transaction
app.post('/api/actions/donate', async (req, res) => {
  try {
    const { account } = req.body;
    const amount = parseFloat(req.query.amount as string) || 0.1;

    if (!account) {
      return res.status(400).json({ error: 'Account required' });
    }

    const sender = new PublicKey(account);
    
    // Create transfer instruction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: RECIPIENT,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    // Set recent blockhash and fee payer
    const { blockhash } = await CONNECTION.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sender;

    // Return serialized transaction
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: `Thank you for donating ${amount} SOL! 🙏`,
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// OPTIONS handler
app.options('*', (req, res) => res.status(200).end());

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Donation server running on port ${PORT}`);
  console.log(`Blink URL: solana-action:https://your-domain.com/api/actions/donate`);
});
