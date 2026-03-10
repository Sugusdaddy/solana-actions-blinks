/**
 * NFT Minting Action example
 * Allows users to mint NFTs directly from a Blink URL
 */

import express from 'express';
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { 
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata';

const app = express();
app.use(express.json());

// Configuration
const COLLECTION_NAME = 'My Awesome Collection';
const MINT_PRICE = 0.5; // SOL
const MAX_SUPPLY = 1000;
let mintedCount = 0;

// GET: Return mint action metadata
app.get('/api/actions/mint', (req, res) => {
  const remaining = MAX_SUPPLY - mintedCount;
  
  if (remaining <= 0) {
    return res.json({
      icon: 'https://your-collection.com/preview.png',
      title: `${COLLECTION_NAME} - SOLD OUT`,
      description: 'All NFTs have been minted!',
      label: 'Sold Out',
      disabled: true,
    });
  }

  res.json({
    icon: 'https://your-collection.com/preview.png',
    title: COLLECTION_NAME,
    description: `Mint your unique NFT!\n\n🎨 Price: ${MINT_PRICE} SOL\n📊 Remaining: ${remaining}/${MAX_SUPPLY}`,
    label: 'Mint Now',
    links: {
      actions: [
        {
          label: `Mint 1 NFT (${MINT_PRICE} SOL)`,
          href: '/api/actions/mint?quantity=1',
        },
        {
          label: `Mint 3 NFTs (${MINT_PRICE * 3} SOL)`,
          href: '/api/actions/mint?quantity=3',
        },
        {
          label: 'Custom amount',
          href: '/api/actions/mint?quantity={quantity}',
          parameters: [
            {
              name: 'quantity',
              label: 'How many? (1-5)',
              required: true,
            },
          ],
        },
      ],
    },
  });
});

// POST: Create mint transaction
app.post('/api/actions/mint', async (req, res) => {
  try {
    const { account } = req.body;
    const quantity = Math.min(5, Math.max(1, parseInt(req.query.quantity as string) || 1));
    
    if (mintedCount + quantity > MAX_SUPPLY) {
      return res.status(400).json({ error: 'Not enough NFTs remaining' });
    }

    // Create mint transaction (simplified)
    const transaction = new Transaction();
    // Add mint instructions here...

    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: `Successfully minted ${quantity} NFT(s)! 🎉`,
    });

    mintedCount += quantity;
  } catch (error) {
    console.error('Mint error:', error);
    res.status(500).json({ error: 'Mint failed' });
  }
});

app.listen(3001, () => console.log('NFT mint server on port 3001'));
