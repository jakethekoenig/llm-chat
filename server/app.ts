import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { User } from './database/models/User';
import { Op } from 'sequelize';
import { Conversation } from './database/models/Conversation';
import { Message } from './database/models/Message';
import { addMessage, generateCompletion } from './helpers/messageHelpers';
import { body, validationResult } from 'express-validator';
import { 
  convertMessageToApiFormat, 
  convertConversationToApiFormat, 
  convertUserToApiFormat,
  convertIdToNumber 
} from './helpers/typeConverters';

const app = express();

// Get SECRET_KEY from environment - no fallback for security
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is required');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting - more permissive in test environment
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 100, // Much higher limit for tests
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv ? () => true : undefined, // Skip rate limiting in tests
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 5, // Much higher limit for tests
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv ? () => true : undefined, // Skip rate limiting in tests
});

app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' })); // Add size limit
app.use(cors());

// Middleware to verify token
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY as jwt.Secret, {}, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
    if (err || !decoded) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    (req as any).user = decoded;
    next();
  });
};

// Sign-in route
app.post('/api/signin', authLimiter, async (req: express.Request, res: express.Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const user = await User.findOne({ where: { username } });
    if (user && await bcrypt.compare(password, (user as any).hashed_password)) {
      const token = jwt.sign({ id: (user as any).get('id') }, SECRET_KEY as jwt.Secret, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register route
app.post('/api/register', authLimiter, async (req: express.Request, res: express.Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  try {
    const existingUser = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, hashed_password: hashedPassword });
    res.status(201).json(convertUserToApiFormat(newUser));
  } catch (error) {
    res.status(400).json({ error: 'Error creating user' });
  }
});

// Add message submission endpoint
app.post('/api/add_message', authenticateToken, [
  body('content').notEmpty().withMessage('Content is required'),
  body('conversationId').custom((value) => {
    if (!value) throw new Error('Conversation ID is required');
    if (isNaN(parseInt(value))) throw new Error('Conversation ID must be a valid number');
    return true;
  }),
  body('parentId').optional().custom((value) => {
    if (value && isNaN(parseInt(value))) throw new Error('Parent ID must be an integer');
    return true;
  })
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { content, conversationId, parentId } = req.body;
  const userId = (req as any).user.id;

  try {
    const dbConversationId = convertIdToNumber(conversationId);
    const dbParentId = parentId ? convertIdToNumber(parentId) : null;
    const message = await addMessage(content, dbConversationId, dbParentId, userId);
    const formattedMessage = convertMessageToApiFormat(message);
    res.status(201).json(formattedMessage);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get completion for message endpoint with validation
app.post('/api/get_completion_for_message', authenticateToken, [
  body('messageId').custom((value) => {
    if (!value) throw new Error('Message ID is required');
    if (isNaN(parseInt(value))) throw new Error('Message ID must be a valid number');
    return true;
  }),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { messageId, model, temperature } = req.body;

  try {
    const dbMessageId = convertIdToNumber(messageId);
    const completionMessage = await generateCompletion(dbMessageId, model, temperature);
    res.status(201).json({ id: (completionMessage.get('id') as number).toString(), content: completionMessage.get('content') as string});
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Streaming endpoint with validation
app.post('/api/get_completion', authenticateToken, [
  body('model').notEmpty().withMessage('Model is required'),
  body('parentId').custom((value) => {
    if (!value) throw new Error('Parent ID is required');
    if (isNaN(parseInt(value))) throw new Error('Parent ID must be a valid number');
    return true;
  }),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { model, parentId, temperature } = req.body;

  try {
    const dbParentId = convertIdToNumber(parentId);
    const completionMessage = await generateCompletion(dbParentId, model, temperature);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamData = JSON.stringify({ id: (completionMessage.get('id') as number).toString(), content: completionMessage.get('content') as string});
    res.write(`data: ${streamData}\n\n`);

    // Placeholder for actual streaming logic
    const messages = [
      { chunk: 'Example stream data part 1' },
      { chunk: 'Example stream data part 2' },
      { chunk: 'Example stream data part 3' }
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < messages.length) {
        const chunkData = JSON.stringify(messages[index]);
        res.write(`data: ${chunkData}\n\n`);
        index++;
      } else {
        clearInterval(interval);
        res.end();
      }
    }, 1000);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all conversations for a logged-in user
app.get('/api/conversations', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.id;
    const conversations = await Conversation.findAll({
      where: { user_id: userId }, // Ensure the user_id condition is applied
      include: [{
        model: Message,
        required: false
      }]
    });
    
    const formattedConversations = conversations.map(convertConversationToApiFormat);
    res.json(formattedConversations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all messages in a specific conversation
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId } = req.params;
    const dbConversationId = convertIdToNumber(conversationId);
    const messages = await Message.findAll({
      where: { conversation_id: dbConversationId }
    });
    
    const formattedMessages = messages.map(convertMessageToApiFormat);
    res.json(formattedMessages);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create conversation with initial message endpoint
app.post('/api/create_conversation', authenticateToken, [
  body('initialMessage').notEmpty().withMessage('Initial message is required'),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { initialMessage, model, temperature } = req.body;
  const userId = (req as any).user.id;

  try {
    const defaultTitle = 'New Conversation';
    const conversation = await Conversation.create({ title: defaultTitle, user_id: userId });
    const message = await addMessage(initialMessage, conversation.get('id') as number, null, userId);
    const completionMessage = await generateCompletion(message.get('id') as number, model, temperature);
    res.status(201).json({ 
      conversationId: (conversation.get('id') as number).toString(), 
      initialMessageId: (message.get('id') as number).toString(), 
      completionMessageId: (completionMessage.get('id') as number).toString() 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default app;
