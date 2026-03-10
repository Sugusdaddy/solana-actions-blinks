import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// ============================================================================
// TYPES - Following Solana Actions Specification
// ============================================================================

export interface ActionGetResponse {
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: {
    actions: LinkedAction[];
  };
  error?: ActionError;
}

export interface LinkedAction {
  href: string;
  label: string;
  parameters?: ActionParameter[];
}

export interface ActionParameter {
  name: string;
  label?: string;
  required?: boolean;
}

export interface ActionPostRequest {
  account: string;
}

export interface ActionPostResponse {
  transaction: string;
  message?: string;
  redirect?: string;
}

export interface ActionError {
  message: string;
}

// ============================================================================
// SERVER - Express middleware and utilities
// ============================================================================

// CORS headers required by Actions spec
export function createActionsMiddleware() {
  return cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Encoding'],
    exposedHeaders: ['X-Action-Version', 'X-Blockchain-Ids'],
  });
}

// Create an Actions-compatible Express server
export function createActionServer(port?: number) {
  const app = express();
  
  app.use(express.json());
  app.use(createActionsMiddleware());
  
  // Add required headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Action-Version', '1');
    res.setHeader('X-Blockchain-Ids', 'solana:mainnet');
    next();
  });
  
  // OPTIONS handler for all routes
  app.options('*', (req, res) => {
    res.status(200).end();
  });
  
  return app;
}

// ============================================================================
// CLIENT - Blink URL resolution and execution
// ============================================================================

const BLINK_PREFIX = 'solana-action:';

// Check if URL is a Blink
export function isBlinkUrl(url: string): boolean {
  return url.startsWith(BLINK_PREFIX) || url.includes(BLINK_PREFIX);
}

// Parse Blink URL to get action URL
export function parseBlinkUrl(blinkUrl: string): string {
  if (blinkUrl.startsWith(BLINK_PREFIX)) {
    return blinkUrl.slice(BLINK_PREFIX.length);
  }
  
  const match = blinkUrl.match(new RegExp(`${BLINK_PREFIX}(https?://[^\\s]+)`));
  return match ? match[1] : blinkUrl;
}

// Create Blink URL from action URL
export function createBlinkUrl(actionUrl: string): string {
  return `${BLINK_PREFIX}${actionUrl}`;
}

// Blink client for resolving and executing actions
export class BlinkClient {
  private cache: Map<string, ActionGetResponse> = new Map();
  private cacheTimeout = 60000; // 1 minute

  // Resolve a Blink URL to action metadata
  async resolve(blinkUrl: string): Promise<ActionGetResponse> {
    const actionUrl = parseBlinkUrl(blinkUrl);
    
    // Check cache
    const cached = this.cache.get(actionUrl);
    if (cached) return cached;

    const response = await fetch(actionUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve action: ${response.status}`);
    }

    const action: ActionGetResponse = await response.json();
    
    // Cache result
    this.cache.set(actionUrl, action);
    setTimeout(() => this.cache.delete(actionUrl), this.cacheTimeout);

    return action;
  }

  // Execute an action and get transaction
  async execute(
    action: LinkedAction,
    account: string,
    params?: Record<string, string>
  ): Promise<ActionPostResponse> {
    let href = action.href;
    
    // Replace parameter placeholders
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`{${key}}`, encodeURIComponent(value));
      }
    }

    const response = await fetch(href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ account }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Action execution failed');
    }

    return response.json();
  }

  // Full flow: resolve and execute
  async resolveAndExecute(
    blinkUrl: string,
    actionIndex: number,
    account: string,
    params?: Record<string, string>
  ): Promise<ActionPostResponse> {
    const action = await this.resolve(blinkUrl);
    
    if (!action.links?.actions || !action.links.actions[actionIndex]) {
      throw new Error('Action not found');
    }

    return this.execute(action.links.actions[actionIndex], account, params);
  }
}

// ============================================================================
// BUILDERS - Helpers for creating responses
// ============================================================================

// Create a simple donation action
export function createDonationAction(options: {
  recipientAddress: string;
  icon: string;
  title: string;
  description: string;
  amounts?: number[];
}): ActionGetResponse {
  const { recipientAddress, icon, title, description, amounts = [0.1, 1, 5] } = options;
  
  return {
    icon,
    title,
    description,
    label: 'Donate',
    links: {
      actions: amounts.map(amount => ({
        label: `Donate ${amount} SOL`,
        href: `/api/actions/donate?to=${recipientAddress}&amount=${amount}`,
      })),
    },
  };
}

// Create donation transaction
export async function createDonationTransaction(
  connection: Connection,
  from: string,
  to: string,
  amount: number
): Promise<string> {
  const fromPubkey = new PublicKey(from);
  const toPubkey = new PublicKey(to);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

// Create a mint NFT action
export function createMintAction(options: {
  collectionName: string;
  icon: string;
  price: number;
  maxPerWallet?: number;
}): ActionGetResponse {
  const { collectionName, icon, price, maxPerWallet } = options;
  
  return {
    icon,
    title: `Mint ${collectionName}`,
    description: `Price: ${price} SOL${maxPerWallet ? ` • Max ${maxPerWallet} per wallet` : ''}`,
    label: 'Mint',
    links: {
      actions: [
        {
          label: `Mint for ${price} SOL`,
          href: '/api/actions/mint',
        },
      ],
    },
  };
}

// Create a swap action
export function createSwapAction(options: {
  fromToken: string;
  toToken: string;
  icon: string;
  amounts?: number[];
}): ActionGetResponse {
  const { fromToken, toToken, icon, amounts = [0.1, 1, 10] } = options;
  
  return {
    icon,
    title: `Swap ${fromToken} to ${toToken}`,
    description: `Best rates via Jupiter`,
    label: 'Swap',
    links: {
      actions: amounts.map(amount => ({
        label: `Swap ${amount} ${fromToken}`,
        href: `/api/actions/swap?from=${fromToken}&to=${toToken}&amount=${amount}`,
      })),
    },
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateAccount(account: string): boolean {
  try {
    new PublicKey(account);
    return true;
  } catch {
    return false;
  }
}

export function validateActionGetResponse(response: any): response is ActionGetResponse {
  return (
    typeof response === 'object' &&
    typeof response.icon === 'string' &&
    typeof response.title === 'string' &&
    typeof response.description === 'string' &&
    typeof response.label === 'string'
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Server
  createActionServer,
  createActionsMiddleware,
  
  // Client
  BlinkClient,
  isBlinkUrl,
  parseBlinkUrl,
  createBlinkUrl,
  
  // Builders
  createDonationAction,
  createDonationTransaction,
  createMintAction,
  createSwapAction,
  
  // Validation
  validateAccount,
  validateActionGetResponse,
};
