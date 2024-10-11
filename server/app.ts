import express from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { User } from './database/models/User';
import { Op } from 'sequelize';
import { Conversation } from './database/models/Conversation';
import { Message } from './database/models/Message';
import { addMessage, generateCompletion } from './helpers/messageHelpers';
import { body, validationResult } from 'express-validator';

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'fallback-secret-key';

app.use(bodyParser.json());
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
app.post('/api/signin', async (req: express.Request, res: express.Response) => {
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
app.post('/api/register', async (req: express.Request, res: express.Response) => {
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
    res.status(400).json({ error: 'Error creating user' });
  }
});

// Add message submission endpoint
app.post('/api/add_message', authenticateToken, [
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
app.post('/api/get_completion_for_message', authenticateToken, [
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
    res.status(201).json({ id: completionMessage.id, content: completionMessage.content });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Streaming endpoint with validation
app.post('/api/get_completion', authenticateToken, [
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
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    const stream = await openai.createChatCompletion({
      model,
      messages: [{ role: 'user', content: completionMessage.content }],
      temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const data = JSON.stringify({ content: chunk.choices[0]?.delta?.content || '' });
      res.write(`data: ${data}\n\n`);
    }

    // After streaming is complete, save the full response to the database
    await Message.update(
      { content: completionMessage.content },
      { where: { id: completionMessage.id } }
    );

    res.end();
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
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get all messages in a specific conversation
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req: express.Request, res: express.Response) => {
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
    const message = await addMessage(initialMessage, conversation.id as number, null, userId);
    const completionMessage = await generateCompletion(message.id as number, model, temperature);
    res.status(201).json({ conversationId: conversation.id, initialMessageId: message.id, completionMessageId: completionMessage.id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default app;
