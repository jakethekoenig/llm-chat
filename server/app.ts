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

// Logging middleware
const requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.info({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  next();
};

// Error handling middleware
const errorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error({
    timestamp: new Date().toISOString(),
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
      params: req.params
    }
  });

  // For test environment, maintain the original error format
  if (process.env.NODE_ENV === 'test') {
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Don't expose stack traces to client in production
  const isProduction = process.env.NODE_ENV === 'production';
  const clientError = {
    message: err.message,
    ...(isProduction ? {} : { stack: err.stack })
  };

  res.status(err.status || 500).json({
    error: clientError
  });
};

app.use(bodyParser.json());
app.use(cors());
app.use(requestLogger);

// Middleware to verify token
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'auth_failure',
      reason: 'missing_token',
      path: req.path
    });
    return res.sendStatus(401);
  }

  jwt.verify(token, SECRET_KEY as jwt.Secret, {}, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
    if (err || !decoded) {
      console.warn({
        timestamp: new Date().toISOString(),
        event: 'auth_failure',
        reason: 'invalid_token',
        error: err?.message,
        path: req.path
      });
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    (req as any).user = decoded;
    next();
  });
};

// Sign-in route
app.post('/api/signin', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { username, password } = req.body;
  if (!username || !password) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'signin_validation_error',
      reason: 'missing_credentials'
    });
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const user = await User.findOne({ where: { username } });
    if (user && await bcrypt.compare(password, (user as any).hashed_password)) {
      const token = jwt.sign({ id: (user as any).get('id') }, SECRET_KEY as jwt.Secret, { expiresIn: '1h' });
      console.info({
        timestamp: new Date().toISOString(),
        event: 'user_signin',
        username,
        success: true
      });
      res.json({ token });
    } else {
      console.warn({
        timestamp: new Date().toISOString(),
        event: 'signin_failure',
        username,
        reason: 'invalid_credentials'
      });
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    next(error);
  }
});

// Register route
app.post('/api/register', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'registration_validation_error',
      reason: 'missing_fields'
    });
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  try {
    const existingUser = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
    if (existingUser) {
      console.warn({
        timestamp: new Date().toISOString(),
        event: 'registration_failure',
        reason: 'user_exists',
        username,
        email
      });
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, hashed_password: hashedPassword });
    console.info({
      timestamp: new Date().toISOString(),
      event: 'user_registered',
      username,
      email
    });
    res.status(201).json({ id: (newUser as any).get('id'), username: (newUser as any).username, email: (newUser as any).email });
  } catch (error) {
    next(error);
  }
});

// Add message submission endpoint
app.post('/api/add_message', authenticateToken, [
  body('content').notEmpty().withMessage('Content is required'),
  body('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  body('parentId').optional().isInt().withMessage('Parent ID must be an integer')
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'validation_error',
      errors: errors.array(),
      path: '/api/add_message'
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { content, conversationId, parentId } = req.body;
  const userId = (req as any).user.id;

  try {
    const message = await addMessage(content, conversationId, parentId, userId);
    console.info({
      timestamp: new Date().toISOString(),
      event: 'message_added',
      messageId: message.get('id'),
      conversationId,
      userId
    });
    res.status(201).json({ id: message.get('id') });
  } catch (error) {
    next(error);
  }
});

// Get completion for message endpoint with validation
app.post('/api/get_completion_for_message', authenticateToken, [
  body('messageId').isInt().withMessage('Message ID must be an integer'),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'validation_error',
      errors: errors.array(),
      path: '/api/get_completion_for_message'
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { messageId, model, temperature } = req.body;

  try {
    const completionMessage = await generateCompletion(messageId, model, temperature);
    console.info({
      timestamp: new Date().toISOString(),
      event: 'completion_generated',
      messageId: completionMessage.get('id'),
      model,
      temperature
    });
    res.status(201).json({ id: completionMessage.get('id'), content: completionMessage.get('content')});
  } catch (error) {
    next(error);
  }
});

// Streaming endpoint with validation
app.post('/api/get_completion', authenticateToken, [
  body('model').notEmpty().withMessage('Model is required'),
  body('parentId').isInt().withMessage('Parent ID must be an integer'),
  body('temperature')
    .isFloat({ min: 0, max: 1 })
    .withMessage('Temperature must be a float between 0 and 1')
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'validation_error',
      errors: errors.array(),
      path: '/api/get_completion'
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { model, parentId, temperature } = req.body;

  try {
    const completionMessage = await generateCompletion(parentId, model, temperature);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.info({
      timestamp: new Date().toISOString(),
      event: 'stream_started',
      messageId: completionMessage.get('id'),
      model,
      temperature
    });

    const streamData = JSON.stringify({ id: completionMessage.get('id'), content: completionMessage.get('content')});
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
        console.info({
          timestamp: new Date().toISOString(),
          event: 'stream_completed',
          messageId: completionMessage.get('id')
        });
        res.end();
      }
    }, 1000);
  } catch (error) {
    next(error);
  }
});

// Route to get all conversations for a logged-in user
app.get('/api/conversations', authenticateToken, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const conversations = await Conversation.findAll({
      where: { user_id: userId },
      include: [{
        model: Message,
        required: false
      }]
    });
    console.info({
      timestamp: new Date().toISOString(),
      event: 'conversations_fetched',
      userId,
      count: conversations.length
    });
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// Route to get all messages in a specific conversation
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { conversationId } = req.params;
    
    // Validate conversation ID format
    if (isNaN(parseInt(conversationId))) {
      console.warn({
        timestamp: new Date().toISOString(),
        event: 'validation_error',
        error: 'Invalid conversation ID format',
        conversationId
      });
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const messages = await Message.findAll({
      where: { conversation_id: conversationId }
    });
    console.info({
      timestamp: new Date().toISOString(),
      event: 'messages_fetched',
      conversationId,
      count: messages.length
    });
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Create conversation with initial message endpoint
app.post('/api/create_conversation', authenticateToken, [
  body('initialMessage').notEmpty().withMessage('Initial message is required'),
  body('model').notEmpty().withMessage('Model is required'),
  body('temperature').isFloat().withMessage('Temperature must be a float')
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn({
      timestamp: new Date().toISOString(),
      event: 'validation_error',
      errors: errors.array(),
      path: '/api/create_conversation'
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { initialMessage, model, temperature } = req.body;
  const userId = (req as any).user.id;

  try {
    const defaultTitle = 'New Conversation';
    const conversation = await Conversation.create({ title: defaultTitle, user_id: userId });
    const message = await addMessage(initialMessage, conversation.get('id') as number, null, userId);
    const completionMessage = await generateCompletion(message.get('id') as number, model, temperature);
    
    console.info({
      timestamp: new Date().toISOString(),
      event: 'conversation_created',
      conversationId: conversation.get('id'),
      userId,
      initialMessageId: message.get('id'),
      completionMessageId: completionMessage.get('id')
    });
    
    res.status(201).json({ 
      conversationId: conversation.get('id'), 
      initialMessageId: message.get('id'), 
      completionMessageId: completionMessage.get('id') 
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware should be last
app.use(errorHandler);

export default app;
