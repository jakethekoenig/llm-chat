import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { User } from './database/models/User';
import { Op } from 'sequelize';
import { Conversation } from './database/models/Conversation';
import { Message } from './database/models/Message';
import { addMessage, generateCompletion } from './helpers/messageHelpers';
import { body, validationResult } from 'express-validator';
dotenv.config();

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'fallback-secret-key';

// Custom logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json());
app.use(cors());

// Middleware to verify token
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY as jwt.Secret, {}, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
    if (err) return res.sendStatus(403);
    (req as any).user = decoded;
    next();
  });
};

// Sign-in route
app.post('/signin', async (req: express.Request, res: express.Response) => {
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
app.post('/register', async (req: express.Request, res: express.Response) => {
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
    res.status(201).json({ id: (newUser as any).get('id'), username: (newUser as any).username, email: (newUser as any).email });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: 'Error creating user' });
  }
});

// Add message endpoint with validation
app.post('/add_message', authenticateToken, [
  body('content').notEmpty().withMessage('Content is required'),
  body('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  body('parentId').optional().isInt().withMessage('Parent ID must be an integer')
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { content, conversationId, parentId } = req.body;
  const userId = (req as any).user.id;

  try {
    const message = await addMessage(content, conversationId, parentId, userId);
    res.status(201).json({ id: message.get('id') });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get completion for message endpoint with validation
app.post('/get_completion_for_message', authenticateToken, [
  body('messageId').isInt().withMessage('Message ID must be an integer'),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { messageId, model, temperature } = req.body;

  try {
    const completionMessage = await generateCompletion(messageId, model, temperature);
    res.status(201).json({ id: completionMessage.get('id') });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Streaming endpoint with validation
app.post('/get_completion', authenticateToken, [
  body('model').notEmpty().withMessage('Model is required'),
  body('parentId').isInt().withMessage('Parent ID must be an integer'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { model, parentId, temperature } = req.body;

  try {
    const completionMessage = await generateCompletion(parentId, model, temperature);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamData = JSON.stringify({ id: completionMessage.get('id') });
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
app.get('/conversations', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.id;
    const conversations = await Conversation.findAll({
      where: { user_id: userId }, // Ensure the user_id condition is applied
      include: [{
        model: Message,
        required: false
      }]
    });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all messages in a specific conversation
app.get('/conversations/:conversationId/messages', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.findAll({
      where: { conversation_id: conversationId }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default app;
